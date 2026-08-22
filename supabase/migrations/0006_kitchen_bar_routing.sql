-- ============================================================
-- KICKOFF ORDINA — migrazione 0006
-- Comande separate bar/cucina: ogni prodotto ha una postazione
-- di preparazione, cosi' lo scontrino/la vista ordine si dividono
-- automaticamente senza bisogno di un secondo schermo dedicato.
-- Esegui questo file nel SQL Editor di Supabase (dopo 0005)
-- ============================================================

alter table products add column if not exists station text not null default 'bar'
  check (station in ('bar', 'cucina'));

-- Salvo anche sulla riga ordine (order_items), come per nome/prezzo:
-- se in futuro sposti un prodotto da bar a cucina, gli ordini vecchi
-- devono continuare a stampare dove sono stati effettivamente preparati.
alter table order_items add column if not exists station text not null default 'bar'
  check (station in ('bar', 'cucina'));

-- Snapshot anche del tempo di preparazione, per calcolare il tempo
-- stimato dell'ordine senza dover risalire al prodotto attuale.
alter table order_items add column if not exists prep_min int not null default 5;
