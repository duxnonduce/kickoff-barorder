-- ============================================================
-- KICKOFF ORDINA — migrazione 0009
-- Fondamenta per Analytics: timestamp di completamento ordine
-- (serve per il tempo medio di preparazione) e costo prodotto
-- facoltativo (serve per calcolare il margine).
-- Esegui questo file nel SQL Editor di Supabase (dopo 0008)
-- ============================================================

alter table orders add column if not exists completed_at timestamptz;
alter table products add column if not exists cost_price numeric(10,2);
