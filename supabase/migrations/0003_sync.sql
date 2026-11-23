-- Sincronização do aparelho com a conta: campos da nota guardada, vínculos, carrinho e perfil automático.
-- Só acrescenta; nada existente é apagado ou alterado de forma incompatível.

-- ---------- Campos que a nota do aparelho já tem ----------
alter table public.stores add column address text;

alter table public.receipts
  add column number text,
  add column series text,
  add column discount_cents integer not null default 0,
  add column payable_cents integer,
  add column validated boolean not null default false,
  add column saved_at timestamptz not null default now();

alter table public.receipt_items
  add column line integer,
  add column unit_raw text;

-- Preço que veio de uma nota é apagado junto com ela
alter table public.price_observations
  add column receipt_id bigint references public.receipts(id) on delete cascade;
create index price_obs_receipt_idx on public.price_observations (receipt_id);

alter type public.receipt_source add value if not exists 'pasted_text';

-- ---------- Vínculo confirmado pelo usuário: código de barras -> itens (cnpj:código interno) ----------
create table public.product_links (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  barcode text not null check (barcode ~ '^[0-9]{8,14}$'),
  name text not null check (length(name) between 1 and 200),
  keys text[] not null check (cardinality(keys) between 1 and 100),
  confirmed_at timestamptz not null default now(),
  primary key (user_id, barcode)
);
alter table public.product_links enable row level security;
create policy product_links_own on public.product_links for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Carrinho ----------
create table public.cart_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  barcode text not null,
  name text not null check (length(name) between 1 and 200),
  qty integer not null check (qty between 1 and 99),
  shelf_cents integer not null check (shelf_cents > 0),
  store_cnpj text not null default '',
  store_name text not null default '',
  created_at timestamptz not null default now()
);
create index cart_items_user_idx on public.cart_items (user_id);
alter table public.cart_items enable row level security;
create policy cart_items_own on public.cart_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Perfil criado no primeiro login ----------
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Gravação da nota (chamada só pela função save-receipt, com a chave de serviço) ----------
-- A função do servidor valida o usuário e a nota; aqui a gravação é atômica.
create function public.save_receipt(p_user uuid, p jsonb)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  v_store bigint;
  v_receipt bigint;
  v_sp bigint;
  v_issued timestamptz := nullif(p->>'issuedAt', '')::timestamptz;
  it jsonb;
begin
  select id into v_receipt from public.receipts where user_id = p_user and access_key = p->>'accessKey';
  if v_receipt is not null then
    return v_receipt; -- já guardada
  end if;

  insert into public.stores (cnpj, name, address, uf)
  values (p->>'storeCnpj', p->>'storeName', nullif(p->>'storeAddress', ''), p->>'uf')
  on conflict (cnpj) do update set name = excluded.name, address = coalesce(excluded.address, public.stores.address)
  returning id into v_store;

  insert into public.receipts (user_id, access_key, store_id, issued_at, total_cents, discount_cents, payable_cents,
                               number, series, validated, parser_version, source, status, saved_at)
  values (p_user, p->>'accessKey', v_store, v_issued, (p->>'totalCents')::int, (p->>'discountCents')::int,
          (p->>'payableCents')::int, p->>'number', p->>'series', (p->>'validated')::boolean, p->>'parserVersion',
          'pasted_text', 'parsed', coalesce(nullif(p->>'savedAt', '')::timestamptz, now()))
  returning id into v_receipt;

  for it in select * from jsonb_array_elements(p->'items') loop
    insert into public.store_products (store_id, store_code, description, unit)
    values (v_store, it->>'storeCode', it->>'description', it->>'unit')
    on conflict (store_id, store_code) do update set description = excluded.description, unit = excluded.unit
    returning id into v_sp;

    insert into public.receipt_items (receipt_id, store_product_id, store_code, line, description, quantity, unit, unit_raw,
                                      unit_price_cents, total_cents)
    values (v_receipt, v_sp, it->>'storeCode', (it->>'line')::int, it->>'description', (it->>'quantity')::numeric,
            it->>'unit', it->>'unitRaw', (it->>'unitPriceCents')::int, (it->>'totalCents')::int);

    if (it->>'unitPriceCents')::int > 0 then
      insert into public.price_observations (user_id, store_product_id, store_id, price_cents, source, observed_at, receipt_id)
      values (p_user, v_sp, v_store, (it->>'unitPriceCents')::int, 'receipt', coalesce(v_issued, now()), v_receipt);
    end if;
  end loop;

  return v_receipt;
end $$;
revoke execute on function public.save_receipt(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_receipt(uuid, jsonb) to service_role;
