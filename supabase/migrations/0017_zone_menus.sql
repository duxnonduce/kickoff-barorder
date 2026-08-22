-- ============================================================
-- KICKOFF ORDINA — migrazione 0017
-- Menu diverso per zona: un prodotto puo' essere limitato a
-- specifiche zone (es. cocktail solo in piscina, "menu atleta"
-- solo ai campi). Array vuoto = visibile ovunque (comportamento
-- di default, nessuna rottura per i prodotti gia' esistenti).
-- Esegui questo file nel SQL Editor di Supabase (dopo 0016)
-- ============================================================

alter table products add column if not exists allowed_zones text[] not null default '{}';
