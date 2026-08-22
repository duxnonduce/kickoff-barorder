-- ============================================================
-- KICKOFF ORDINA — migrazione 0005
-- Note per singolo prodotto, motivo del rifiuto, preferiti cliente
-- Esegui questo file nel SQL Editor di Supabase (dopo 0004)
-- ============================================================

-- ---------- NOTE PER SINGOLO PRODOTTO ----------
-- Prima solo l'ordine intero aveva una nota; ora ogni riga puo' averne una
-- (es. "senza maionese" solo sul panino, non su tutto l'ordine).
alter table order_items add column if not exists note text;

-- ---------- MOTIVO DEL RIFIUTO ----------
alter table orders add column if not exists reject_reason text;

-- ---------- PREFERITI CLIENTE ----------
alter table customers add column if not exists favorite_product_ids uuid[] not null default '{}';
