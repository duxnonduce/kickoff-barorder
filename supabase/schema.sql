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
  qr_token text not null default gen_random_uuid()::text,
  valid_from timestamptz,
  valid_until timestamptz,
  archived_at timestamptz,
  created_at timestamptz default now()
);
create unique index if not exists tables_qr_token_key on tables (qr_token);

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
  image_url text,
  price numeric(10,2) not null,
  available boolean not null default true,
  prep_min int default 5,
  cost_price numeric(10,2),
  happy_price numeric(10,2),
  happy_from time,
  happy_until time,
  suggested_product_id uuid references products(id),
  allowed_zones text[] not null default '{}',
  station text not null default 'bar' check (station in ('bar', 'cucina')),
  tag_vegetarian boolean not null default false,
  tag_vegan boolean not null default false,
  tag_gluten_free boolean not null default false,
  tag_spicy boolean not null default false,
  tag_recommended boolean not null default false,
  tag_new boolean not null default false,
  tag_bestseller boolean not null default false,
  visible_from time,
  visible_until time,
  track_stock boolean not null default false,
  stock_qty int,
  low_stock_threshold int not null default 5,
  unavailable_note text,
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
    check (status in ('in_attesa','accettato','pronto','in_consegna','completato','rifiutato')),
  total numeric(10,2) not null,
  note text,
  customer_id uuid references customers(id),
  customer_name text,
  customer_phone text,
  customer_email text,
  requested_time timestamptz, -- null = "il prima possibile"
  client_request_id text,
  reject_reason text,
  coupon_code text,
  discount_amount numeric(10,2) not null default 0,
  rating int check (rating between 1 and 5),
  rating_comment text,
  rated_at timestamptz,
  reprint_requested_at timestamptz,
  reprint_count int not null default 0,
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  created_at timestamptz default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
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

-- ---------- COUPON ----------
-- Nessuna policy RLS pubblica: i codici si verificano solo tramite
-- l'API /api/coupons/validate (Service Role).
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  max_uses int,
  times_used int not null default 0,
  min_order_total numeric(10,2),
  created_at timestamptz default now()
);

-- ---------- RICHIESTE ASSISTENZA ----------
create table if not exists assistance_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables(id),
  type text not null check (type in ('staff', 'bill')),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- ---------- STAFF & REGISTRO ATTIVITÀ ----------
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'entrambi' check (role in ('bar', 'admin', 'entrambi')),
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  staff_name text,
  action text not null,
  details text,
  created_at timestamptz default now()
);

-- ---------- STATO SERVIZIO (riga singola: pausa / solo ritiro) ----------
create table if not exists service_status (
  id int primary key default 1,
  paused boolean not null default false,
  pause_reason text,
  paused_until timestamptz,
  delivery_disabled boolean not null default false,
  updated_at timestamptz default now()
);

insert into service_status (id) values (1) on conflict (id) do nothing;

-- ---------- NOTIFICHE PUSH ----------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (order_id, endpoint)
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
  publish_from timestamptz,
  publish_until timestamptz,
  target text not null default 'all' check (target in ('all', 'piscina', 'campi', 'bar')),
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
alter table coupons enable row level security;
-- coupons: nessuna policy pubblica di proposito (vedi commento sulla tabella)
alter table assistance_requests enable row level security;
create policy "lettura pubblica richieste assistenza" on assistance_requests for select using (true);
create policy "creazione pubblica richieste assistenza" on assistance_requests for insert with check (true);
alter table staff enable row level security;
create policy "lettura pubblica staff" on staff for select using (true);
-- scrittura staff: solo via Service Role
alter table activity_log enable row level security;
alter table service_status enable row level security;
create policy "lettura pubblica stato servizio" on service_status for select using (true);
-- scrittura: solo via Service Role
alter table push_subscriptions enable row level security;
create policy "creazione pubblica iscrizioni push" on push_subscriptions for insert with check (true);
-- nessuna select/update/delete pubblica: solo via Service Role
-- nessuna policy pubblica: solo via Service Role

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
alter publication supabase_realtime add table assistance_requests;
alter publication supabase_realtime add table service_status;

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

-- Scala automaticamente lo stock (per i prodotti con track_stock attivo)
-- e disattiva il prodotto quando arriva a zero. Fatto con un trigger per
-- essere atomico anche con più ordini contemporanei.
create or replace function kickoff_decrement_stock() returns trigger as $$
begin
  update products
  set
    stock_qty = greatest(coalesce(stock_qty, 0) - new.qty, 0),
    available = case
      when track_stock and greatest(coalesce(stock_qty, 0) - new.qty, 0) <= 0 then false
      else available
    end
  where id = new.product_id and track_stock = true;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_kickoff_decrement_stock on order_items;
create trigger trg_kickoff_decrement_stock
  after insert on order_items
  for each row execute function kickoff_decrement_stock();

-- Limite ordini attivi per cliente (max 3 pendenti/in preparazione
-- contemporaneamente per numero di telefono), per evitare abusi.
create or replace function kickoff_check_order_limit() returns trigger as $$
declare
  active_count int;
begin
  select count(*) into active_count
  from orders
  where customer_phone = new.customer_phone
    and status in ('in_attesa', 'accettato', 'pronto');

  if active_count >= 3 then
    raise exception 'ORDER_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kickoff_check_order_limit on orders;
create trigger trg_kickoff_check_order_limit
  before insert on orders
  for each row execute function kickoff_check_order_limit();
