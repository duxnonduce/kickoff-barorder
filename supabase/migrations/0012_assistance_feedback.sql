-- ============================================================
-- KICKOFF ORDINA — migrazione 0012
-- Chiamata staff / richiesta conto, e feedback post-ordine.
-- Esegui questo file nel SQL Editor di Supabase (dopo 0011)
-- ============================================================

-- ---------- RICHIESTE ASSISTENZA ----------
create table if not exists assistance_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables(id),
  type text not null check (type in ('staff', 'bill')),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

alter table assistance_requests enable row level security;
create policy "lettura pubblica richieste assistenza" on assistance_requests for select using (true);
create policy "creazione pubblica richieste assistenza" on assistance_requests for insert with check (true);
-- risoluzione: solo via Service Role (API route con PIN bar)

-- ---------- FEEDBACK POST-ORDINE ----------
alter table orders add column if not exists rating int check (rating between 1 and 5);
alter table orders add column if not exists rating_comment text;
alter table orders add column if not exists rated_at timestamptz;

alter publication supabase_realtime add table assistance_requests;
