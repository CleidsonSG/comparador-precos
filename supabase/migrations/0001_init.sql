-- Comparador de Preços de Supermercado — esquema inicial
-- Regras: RLS em todas as tabelas; nunca armazenar CPF; preços em centavos (integer).

create extension if not exists pgcrypto;

-- ---------- Perfil ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  uf char(2) not null default 'RJ',
  city text,
  share_prices boolean not null default false,  -- opt-in preços colaborativos
  created_at timestamptz not null default now()
);

-- ---------- Mercados e produtos ----------
create table public.stores (
  id bigint generated always as identity primary key,
  cnpj char(14) not null unique,
  name text not null,
  city text,
  uf char(2),
  created_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  gtin text unique,                 -- null quando "SEM GTIN"
  name text not null,
  brand text,
  size_value numeric,
  size_unit text,                   -- g, kg, ml, l, un
  category text,
  created_at timestamptz not null default now()
);

-- ---------- Notas fiscais (NFC-e) ----------
create type public.receipt_source as enum ('qr', 'access_key', 'xml', 'pdf', 'manual', 'paid_lookup');
create type public.receipt_status as enum ('pending', 'parsed', 'failed');

create table public.receipts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_key char(44) not null,
  store_id bigint references public.stores(id),
  issued_at timestamptz,
  total_cents integer,
  source public.receipt_source not null,
  status public.receipt_status not null default 'pending',
  parser_version text,
  created_at timestamptz not null default now(),
  unique (user_id, access_key)
);
create index receipts_user_issued_idx on public.receipts (user_id, issued_at desc);
create index receipts_store_idx on public.receipts (store_id);

create table public.receipt_items (
  id bigint generated always as identity primary key,
  receipt_id bigint not null references public.receipts(id) on delete cascade,
  product_id bigint references public.products(id),
  gtin text,
  description text not null,
  quantity numeric not null,
  unit text,
  unit_price_cents integer not null,
  total_cents integer not null,
  discount_cents integer not null default 0,
  is_promo boolean not null default false
);
create index receipt_items_receipt_idx on public.receipt_items (receipt_id);
create index receipt_items_product_idx on public.receipt_items (product_id);

-- Notas que falharam na leitura automática, reprocessadas quando o leitor for corrigido
create table public.pending_receipts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  qr_url text,
  access_key char(44),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index pending_receipts_user_idx on public.pending_receipts (user_id);

-- ---------- Preços observados (nota ou prateleira) ----------
create type public.price_source as enum ('receipt', 'shelf');

create table public.price_observations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id),
  store_id bigint not null references public.stores(id),
  price_cents integer not null check (price_cents > 0),
  source public.price_source not null,
  is_promo boolean not null default false,
  observed_at timestamptz not null default now(),
  shared boolean not null default false,
  hidden boolean not null default false,       -- escondido por moderação
  confirmations integer not null default 0
);
create index price_obs_user_idx on public.price_observations (user_id, observed_at desc);
create index price_obs_product_store_idx on public.price_observations (product_id, store_id, observed_at desc);
create index price_obs_store_idx on public.price_observations (store_id);

create table public.price_reports (
  id bigint generated always as identity primary key,
  observation_id bigint not null references public.price_observations(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  suggested_price_cents integer,
  created_at timestamptz not null default now(),
  unique (observation_id, reporter_id)
);
create index price_reports_obs_idx on public.price_reports (observation_id);

-- ---------- Recursos pagos opcionais: consentimento, preços, créditos ----------
create type public.paid_feature as enum ('ocr_advanced', 'nfce_paid_lookup');
create type public.consent_status as enum ('accepted', 'declined');

create table public.feature_pricing (
  id bigint generated always as identity primary key,
  feature public.paid_feature not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  version integer not null,
  active_from timestamptz not null default now(),
  unique (feature, version)
);

-- Ausência de linha = "não decidido". O app não repete o aviso depois de aceitar ou recusar.
create table public.feature_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature public.paid_feature not null,
  status public.consent_status not null,
  accepted_unit_price_cents integer,
  pricing_version integer,
  terms_version text,
  auto_mode boolean not null default false,     -- OCR: usar automático com baixa confiança
  monthly_cap_cents integer,                    -- teto mensal opcional
  decided_at timestamptz not null default now(),
  cancelled_at timestamptz,
  primary key (user_id, feature)
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta_cents integer not null,                 -- positivo = recarga, negativo = uso
  reason text not null,                         -- topup, ocr_advanced, nfce_paid_lookup, manual_grant
  feature public.paid_feature,
  external_ref text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

create view public.credit_balance with (security_invoker = true) as
  select user_id, coalesce(sum(delta_cents), 0)::integer as balance_cents
  from public.credit_ledger group by user_id;

-- ---------- Saúde do leitor (monitor diário) ----------
create table public.reader_health (
  id bigint generated always as identity primary key,
  uf char(2) not null,
  parser_version text not null,
  ok boolean not null,
  detail text,
  checked_at timestamptz not null default now()
);
create index reader_health_uf_idx on public.reader_health (uf, checked_at desc);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.pending_receipts enable row level security;
alter table public.price_observations enable row level security;
alter table public.price_reports enable row level security;
alter table public.feature_pricing enable row level security;
alter table public.feature_consents enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.reader_health enable row level security;

create policy profiles_own on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Mercados e produtos: leitura para autenticados; escrita só por funções do servidor (service role)
create policy stores_read on public.stores for select to authenticated using (true);
create policy products_read on public.products for select to authenticated using (true);
create policy pricing_read on public.feature_pricing for select to authenticated using (true);

create policy receipts_own on public.receipts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy receipt_items_own on public.receipt_items for all to authenticated
  using (exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = (select auth.uid())));

create policy pending_own on public.pending_receipts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Preços: o usuário vê os próprios; os compartilhados (não escondidos) de outros aparecem pela view abaixo
create policy price_obs_own on public.price_observations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy reports_insert on public.price_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);
create policy reports_own_read on public.price_reports for select to authenticated
  using ((select auth.uid()) = reporter_id);

-- Consentimento: o usuário lê o próprio; gravação feita por função do servidor, que valida preço e versão
create policy consents_read on public.feature_consents for select to authenticated
  using ((select auth.uid()) = user_id);

-- Créditos: o usuário só lê; movimentações apenas pelo servidor
create policy ledger_read on public.credit_ledger for select to authenticated
  using ((select auth.uid()) = user_id);

-- reader_health: sem política para usuários; acesso só pelo service role

-- ---------- Preços colaborativos (sem dados pessoais) ----------
create view public.shared_prices with (security_invoker = false) as
  select o.product_id, o.store_id, o.price_cents, o.source, o.is_promo, o.observed_at, o.confirmations
  from public.price_observations o
  where o.shared and not o.hidden;

revoke all on public.shared_prices from anon;
grant select on public.shared_prices to authenticated;
