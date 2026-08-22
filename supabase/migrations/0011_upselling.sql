-- ============================================================
-- KICKOFF ORDINA — migrazione 0011
-- Upselling/cross-selling: ogni prodotto puo' avere un prodotto
-- "suggerito" che viene proposto al cliente quando lo aggiunge
-- al carrello (es. Toast -> suggerisce Coca-Cola).
-- Esegui questo file nel SQL Editor di Supabase (dopo 0010)
-- ============================================================

alter table products add column if not exists suggested_product_id uuid references products(id);
