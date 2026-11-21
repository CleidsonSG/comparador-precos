-- Produto identificado por mercado + código interno (a página da NFC-e do RJ não traz GTIN).
-- O GTIN fica opcional e liga o produto do mercado ao produto global.

create table public.store_products (
  id bigint generated always as identity primary key,
  store_id bigint not null references public.stores(id),
  store_code text not null,
  description text not null,
  unit text,
  product_id bigint references public.products(id),
  gtin text,
  created_at timestamptz not null default now(),
  unique (store_id, store_code)
);
create index store_products_product_idx on public.store_products (product_id);

alter table public.store_products enable row level security;
-- Leitura para usuários logados; escrita só pelas funções do servidor (service role).
create policy store_products_read on public.store_products for select to authenticated using (true);

alter table public.receipt_items
  add column store_product_id bigint references public.store_products(id),
  add column store_code text;
create index receipt_items_store_product_idx on public.receipt_items (store_product_id);

alter table public.price_observations
  add column store_product_id bigint references public.store_products(id),
  alter column product_id drop not null,
  add constraint price_obs_has_product check (product_id is not null or store_product_id is not null);
create index price_obs_store_product_idx on public.price_observations (store_product_id, observed_at desc);
