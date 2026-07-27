-- ============================================================
-- KICKOFF ORDINA — migrazione 0002
-- Registrazione cliente (nome, email, telefono) + orario richiesto
-- Esegui questo file nel SQL Editor di Supabase (dopo schema.sql)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- CLIENTI ----------
-- Nessuna policy RLS pubblica: i dati si leggono/scrivono solo tramite
-- le API route (Service Role), mai direttamente dal browser col client anon.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text not null unique,
  created_at timestamptz default now()
);

alter table customers enable row level security;
-- Nessuna policy = nessun accesso pubblico (solo via Service Role nelle API route)

-- ---------- ORDINI: aggiungo riferimento cliente e orario richiesto ----------
alter table orders add column if not exists customer_id uuid references customers(id);
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_phone text;
alter table orders add column if not exists customer_email text;
alter table orders add column if not exists requested_time timestamptz; -- null = "il prima possibile"
