-- ============================================================
-- KICKOFF ORDINA — migrazione 0018
-- Operatività rapida bar: pausa ordini con motivo, modalità solo
-- ritiro, priorità ordine (urgente/normale).
-- Esegui questo file nel SQL Editor di Supabase (dopo 0017)
-- ============================================================

-- ---------- STATO SERVIZIO (riga singola) ----------
create table if not exists service_status (
  id int primary key default 1,
  paused boolean not null default false,
  pause_reason text,
  paused_until timestamptz,
  delivery_disabled boolean not null default false,
  updated_at timestamptz default now()
);

insert into service_status (id) values (1) on conflict (id) do nothing;

alter table service_status enable row level security;
create policy "lettura pubblica stato servizio" on service_status for select using (true);
-- scrittura: solo via Service Role (pannello bar)

alter publication supabase_realtime add table service_status;

-- ---------- PRIORITÀ ORDINE ----------
alter table orders add column if not exists priority text not null default 'normal'
  check (priority in ('normal', 'urgent'));
