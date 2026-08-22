-- ============================================================
-- KICKOFF ORDINA — migrazione 0004
-- Fondamenta tecniche: idempotenza ordini, soft delete postazioni,
-- consenso privacy clienti
-- Esegui questo file nel SQL Editor di Supabase (dopo 0003)
-- ============================================================

-- ---------- IDEMPOTENZA ORDINI ----------
-- Evita ordini duplicati se il cliente preme "Invia" due volte
-- (doppio tap, connessione lenta che fa sembrare non sia partito).
alter table orders add column if not exists client_request_id text;
create unique index if not exists orders_client_request_id_key
  on orders (client_request_id) where client_request_id is not null;

-- ---------- SOFT DELETE POSTAZIONI ----------
-- "Eliminare" una postazione da ora la nasconde invece di cancellarla:
-- cosi' gli ordini storici collegati restano leggibili e consultabili.
alter table tables add column if not exists archived_at timestamptz;
alter table products add column if not exists archived_at timestamptz;

-- ---------- CONSENSO PRIVACY CLIENTI ----------
alter table customers add column if not exists privacy_accepted_at timestamptz;
alter table customers add column if not exists marketing_consent boolean not null default false;
alter table customers add column if not exists marketing_consent_at timestamptz;
