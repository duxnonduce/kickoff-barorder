-- ============================================================
-- KICKOFF ORDINA — migrazione 0015
-- Annunci programmati (pubblica da/fino a) e mirati per zona
-- (es. un avviso solo per la piscina, uno solo per i tavoli bar).
-- Esegui questo file nel SQL Editor di Supabase (dopo 0014)
-- ============================================================

alter table announcements add column if not exists publish_from timestamptz;
alter table announcements add column if not exists publish_until timestamptz;
alter table announcements add column if not exists target text not null default 'all'
  check (target in ('all', 'piscina', 'campi', 'bar'));
