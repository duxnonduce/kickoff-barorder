-- ============================================================
-- KICKOFF ORDINA — migrazione 0020
-- QR antifrode: ogni postazione ha un token separato dall'id, che
-- l'admin può rigenerare in qualsiasi momento invalidando il QR
-- vecchio (utile se qualcuno lo fotografa e prova a ordinare da casa).
-- QR temporanei per eventi: una postazione può avere una finestra di
-- validità (es. "Area Atleti" valida solo durante un torneo).
-- Esegui questo file nel SQL Editor di Supabase (dopo 0019)
-- ============================================================

alter table tables add column if not exists qr_token text not null default gen_random_uuid()::text;
create unique index if not exists tables_qr_token_key on tables (qr_token);

alter table tables add column if not exists valid_from timestamptz;
alter table tables add column if not exists valid_until timestamptz;
