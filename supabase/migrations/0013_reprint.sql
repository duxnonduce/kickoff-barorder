-- ============================================================
-- KICKOFF ORDINA — migrazione 0013
-- Ristampa comanda: il bar puo' richiedere una nuova stampa dello
-- scontrino/comanda in qualsiasi momento, con conteggio delle ristampe
-- per evitare confusione ("Scontrino #184 ristampato 2 volte").
-- Esegui questo file nel SQL Editor di Supabase (dopo 0012)
-- ============================================================

alter table orders add column if not exists reprint_requested_at timestamptz;
alter table orders add column if not exists reprint_count int not null default 0;
