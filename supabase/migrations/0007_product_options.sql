-- ============================================================
-- KICKOFF ORDINA — migrazione 0007
-- Varianti e aggiunte per prodotto.
-- Es. "Caffè" -> gruppo "Tipo" (scelta singola: normale/macchiato/decaffeinato)
--     "Piadina" -> gruppo "Aggiunte" (scelta multipla: mozzarella +1, patatine +1)
-- Esegui questo file nel SQL Editor di Supabase (dopo 0006)
-- ============================================================

-- ---------- GRUPPI DI OPZIONI (uno per prodotto, es. "Tipo", "Aggiunte") ----------
create table if not exists product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  name text not null,
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  required boolean not null default false,
  sort_order int not null default 0
);

-- ---------- OPZIONI DENTRO OGNI GRUPPO ----------
create table if not exists product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references product_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0,
  sort_order int not null default 0
);

-- ---------- OPZIONI SCELTE, SNAPSHOT SULLA RIGA ORDINE ----------
-- Stesso principio delle altre snapshot: se in futuro cambi il prezzo
-- di un'aggiunta, gli ordini vecchi devono restare quelli che erano.
create table if not exists order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references order_items(id) on delete cascade,
  group_name text not null,
  option_name text not null,
  price_delta numeric(10,2) not null default 0
);

alter table product_option_groups enable row level security;
alter table product_options enable row level security;
alter table order_item_options enable row level security;

create policy "lettura pubblica gruppi opzioni" on product_option_groups for select using (true);
create policy "lettura pubblica opzioni" on product_options for select using (true);
-- scrittura gruppi/opzioni: solo via Service Role (pannello admin)

create policy "creazione opzioni scelte pubblica" on order_item_options for insert with check (true);
create policy "lettura opzioni scelte pubblica" on order_item_options for select using (true);
