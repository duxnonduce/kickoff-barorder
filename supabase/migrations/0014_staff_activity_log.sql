-- ============================================================
-- KICKOFF ORDINA — migrazione 0014
-- Anagrafica staff e registro attività, per sapere chi ha fatto cosa
-- (es. "Ordine #183 accettato da Mario", "Prezzo modificato da Luca").
-- I PIN bar/admin restano come "porta d'ingresso" invariati: questo è
-- un livello in più, non li sostituisce.
-- Esegui questo file nel SQL Editor di Supabase (dopo 0013)
-- ============================================================

-- ---------- STAFF ----------
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'entrambi' check (role in ('bar', 'admin', 'entrambi')),
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table staff enable row level security;
create policy "lettura pubblica staff" on staff for select using (true);
-- scrittura: solo via Service Role (pannello admin)

-- ---------- REGISTRO ATTIVITÀ ----------
-- Nessuna policy pubblica: si scrive e si legge solo tramite le API
-- route (Service Role), mai direttamente dal browser.
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  staff_name text,
  action text not null,
  details text,
  created_at timestamptz default now()
);

alter table activity_log enable row level security;
