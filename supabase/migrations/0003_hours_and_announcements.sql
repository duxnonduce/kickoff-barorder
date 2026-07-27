-- ============================================================
-- KICKOFF ORDINA — migrazione 0003
-- Orari di apertura per giorno + avvisi/comunicazioni
-- Esegui questo file nel SQL Editor di Supabase (dopo 0002)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ORARI DI APERTURA ----------
-- day_of_week: 0 = domenica, 1 = lunedì, ... 6 = sabato (come JS Date.getDay())
create table if not exists opening_hours (
  day_of_week int primary key check (day_of_week between 0 and 6),
  open_time time not null default '08:00',
  close_time time not null default '23:00',
  closed boolean not null default false
);

insert into opening_hours (day_of_week, open_time, close_time, closed)
select d, '08:00', '23:00', false
from generate_series(0, 6) as d
on conflict (day_of_week) do nothing;

alter table opening_hours enable row level security;
create policy "lettura pubblica orari" on opening_hours for select using (true);
-- nessuna policy di update pubblica: si modifica solo via Service Role (API route)

-- ---------- AVVISI / COMUNICAZIONI ----------
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table announcements enable row level security;
create policy "lettura pubblica avvisi" on announcements for select using (true);
-- nessuna policy di insert/update pubblica: si modifica solo via Service Role
