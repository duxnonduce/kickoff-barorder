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
  created_at timestamptz default now()
);

-- ---------- SEQUENZA CODICE ORDINE (#41, #42, ...) ----------
create sequence if not exists order_code_seq start 41;

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
  qty int not null
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

create policy "lettura pubblica zone" on zones for select using (true);
create policy "lettura pubblica postazioni" on tables for select using (true);
create policy "lettura pubblica categorie" on categories for select using (true);
create policy "lettura pubblica prodotti" on products for select using (true);

create policy "creazione ordini pubblica" on orders for insert with check (true);
create policy "lettura ordini pubblica" on orders for select using (true);
-- update/delete su orders: nessuna policy pubblica -> solo via Service Role (API route)

create policy "creazione righe ordine pubblica" on order_items for insert with check (true);
create policy "lettura righe ordine pubblica" on order_items for select using (true);

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
