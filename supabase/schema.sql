-- ============================================================
-- KICKOFF ORDINA — schema iniziale
-- Esegui questo file nel SQL Editor di Supabase (una volta sola)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ZONE (Piscina / Campi / Bar) ----------
create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('piscina','campi','bar')),
  surcharge numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

-- ---------- POSTAZIONI (ombrelloni, spogliatoi, tavoli) ----------
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references zones(id) on delete cascade,
  label text not null,
  archived_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- CATEGORIE MENU ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

-- ---------- PRODOTTI ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  name text not null,
  description text,
  price numeric(10,2) not null,
  available boolean not null default true,
  prep_min int default 5,
  station text not null default 'bar' check (station in ('bar', 'cucina')),
  archived_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- SEQUENZA CODICE ORDINE (#41, #42, ...) ----------
create sequence if not exists order_code_seq start 41;

-- ---------- CLIENTI ----------
-- Nessuna policy RLS pubblica: i dati si leggono/scrivono solo tramite
-- le API route (Service Role), mai direttamente dal browser col client anon.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text not null unique,
  privacy_accepted_at timestamptz,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  favorite_product_ids uuid[] not null default '{}',
  created_at timestamptz default now()
);

alter table customers enable row level security;
-- Nessuna policy = nessun accesso pubblico (solo via Service Role nelle API route)

-- ---------- ORDINI ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text not null default ('#' || nextval('order_code_seq')::text),
  table_id uuid references tables(id),
  zone_id uuid references zones(id),
  type text not null check (type in ('ritiro','consegna')),
  status text not null default 'in_attesa'
    check (status in ('in_attesa','accettato','pronto','completato','rifiutato')),
  total numeric(10,2) not null,
  note text,
  customer_id uuid references customers(id),
  customer_name text,
  customer_phone text,
  customer_email text,
  requested_time timestamptz, -- null = "il prima possibile"
  client_request_id text,
  reject_reason text,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  printed_at timestamptz
);

-- ---------- RIGHE ORDINE ----------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  price numeric(10,2) not null,
  qty int not null,
  note text,
  station text not null default 'bar' check (station in ('bar', 'cucina')),
  prep_min int not null default 5
);

-- ---------- VARIANTI E AGGIUNTE ----------
create table if not exists product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  name text not null,
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  required boolean not null default false,
  sort_order int not null default 0
);

create table if not exists product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references product_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0,
  sort_order int not null default 0
);

create table if not exists order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references order_items(id) on delete cascade,
  group_name text not null,
  option_name text not null,
  price_delta numeric(10,2) not null default 0
);

-- ---------- ORARI DI APERTURA ----------
-- day_of_week: 0 = domenica, 1 = lunedì, ... 6 = sabato (come JS Date.getDay())
create table if not exists opening_hours (
  day_of_week int primary key check (day_of_week between 0 and 6),
  open_time time not null default '08:00',
  close_time time not null default '23:00',
  closed boolean not null default false
);

-- ---------- AVVISI / COMUNICAZIONI ----------
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- v1 semplice: lettura pubblica di menu/zone/postazioni,
-- scrittura ordini pubblica (il cliente non ha login),
-- update di ordini/prodotti riservato alle API route con
-- Service Role Key (bar/admin protetti da PIN lato app).
-- ============================================================

alter table zones enable row level security;
alter table tables enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table opening_hours enable row level security;
alter table announcements enable row level security;
alter table product_option_groups enable row level security;
alter table product_options enable row level security;
alter table order_item_options enable row level security;

create policy "lettura pubblica zone" on zones for select using (true);
create policy "lettura pubblica postazioni" on tables for select using (true);
create policy "lettura pubblica categorie" on categories for select using (true);
create policy "lettura pubblica prodotti" on products for select using (true);
create policy "lettura pubblica orari" on opening_hours for select using (true);
create policy "lettura pubblica avvisi" on announcements for select using (true);
create policy "lettura pubblica gruppi opzioni" on product_option_groups for select using (true);
create policy "lettura pubblica opzioni" on product_options for select using (true);

create policy "creazione ordini pubblica" on orders for insert with check (true);
create policy "lettura ordini pubblica" on orders for select using (true);
-- update/delete su orders: nessuna policy pubblica -> solo via Service Role (API route)

create policy "creazione righe ordine pubblica" on order_items for insert with check (true);
create policy "lettura righe ordine pubblica" on order_items for select using (true);

create policy "creazione opzioni scelte pubblica" on order_item_options for insert with check (true);
create policy "lettura opzioni scelte pubblica" on order_item_options for select using (true);

-- ============================================================
-- REALTIME: abilita la pubblicazione per la dashboard del bar
-- ============================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table products;

-- ============================================================
-- DATI DI PARTENZA (puoi modificarli/eliminarli dal pannello Admin)
-- ============================================================
insert into zones (name, type, surcharge) values
  ('Piscina', 'piscina', 1.0),
  ('Campi', 'campi', 1.0),
  ('Tavoli Bar', 'bar', 0);

insert into categories (name, sort_order) values
  ('Bevande', 1), ('Panini & Piadine', 2), ('Snack', 3), ('Pizze', 4);

insert into opening_hours (day_of_week, open_time, close_time, closed)
select d, '08:00', '23:00', false
from generate_series(0, 6) as d
on conflict (day_of_week) do nothing;

-- Idempotenza: evita ordini duplicati da doppio invio
create unique index if not exists orders_client_request_id_key
  on orders (client_request_id) where client_request_id is not null;
