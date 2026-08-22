-- ============================================================
-- KICKOFF ORDINA — migrazione 0019
-- Stato ordine più dettagliato ("in consegna" distinto da "pronto",
-- solo per gli ordini con consegna) e notifiche push vere.
-- Esegui questo file nel SQL Editor di Supabase (dopo 0018)
-- ============================================================

-- ---------- STATO "IN CONSEGNA" ----------
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('in_attesa', 'accettato', 'pronto', 'in_consegna', 'completato', 'rifiutato'));

-- ---------- NOTIFICHE PUSH ----------
-- Un cliente può avere una "iscrizione" push per ogni ordine che sta
-- seguendo. Nessuna policy di lettura pubblica: gli endpoint push sono
-- dati sensibili, si leggono solo via Service Role (per inviare la
-- notifica quando lo stato dell'ordine cambia).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (order_id, endpoint)
);

alter table push_subscriptions enable row level security;
create policy "creazione pubblica iscrizioni push" on push_subscriptions for insert with check (true);
-- nessuna select/update/delete pubblica: solo via Service Role
