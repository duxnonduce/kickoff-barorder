-- ============================================================
-- KICKOFF ORDINA — migrazione 0010
-- Coupon sconto, happy hour automatica per prodotto.
-- Esegui questo file nel SQL Editor di Supabase (dopo 0009)
-- ============================================================

-- ---------- COUPON ----------
-- Nessuna policy RLS pubblica di proposito: i codici si verificano solo
-- tramite l'API /api/coupons/validate (Service Role), mai leggibili
-- direttamente dal browser — altrimenti basterebbe ispezionare le
-- richieste di rete per scoprire tutti i codici attivi.
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

alter table coupons enable row level security;
-- nessuna policy = nessun accesso pubblico diretto

-- ---------- HAPPY HOUR PER PRODOTTO ----------
-- Se impostati, in quella fascia oraria il prodotto costa happy_price
-- invece del prezzo pieno, in automatico, senza codice sconto.
alter table products add column if not exists happy_price numeric(10,2);
alter table products add column if not exists happy_from time;
alter table products add column if not exists happy_until time;

-- ---------- SCONTO SULL'ORDINE ----------
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists discount_amount numeric(10,2) not null default 0;
