-- ============================================================
-- KICKOFF ORDINA — migrazione 0008
-- Menu intelligente: descrizione, foto, allergeni/tag, fasce orarie
-- di visibilità, gestione magazzino con disattivazione automatica.
-- Esegui questo file nel SQL Editor di Supabase (dopo 0007)
-- ============================================================

alter table products add column if not exists description text;
alter table products add column if not exists image_url text;

-- Tag/allergeni semplici (checkbox in admin, badge lato cliente)
alter table products add column if not exists tag_vegetarian boolean not null default false;
alter table products add column if not exists tag_vegan boolean not null default false;
alter table products add column if not exists tag_gluten_free boolean not null default false;
alter table products add column if not exists tag_spicy boolean not null default false;
alter table products add column if not exists tag_recommended boolean not null default false;
alter table products add column if not exists tag_new boolean not null default false;
alter table products add column if not exists tag_bestseller boolean not null default false;

-- Visibilità per fascia oraria (es. cornetti solo 07:00-11:00). Se entrambi
-- null, il prodotto è visibile sempre (rispettando comunque available).
alter table products add column if not exists visible_from time;
alter table products add column if not exists visible_until time;

-- Magazzino facoltativo: solo per prodotti facilmente conteggiabili
-- (bevande in bottiglia, gelati confezionati, snack...). Se track_stock
-- è false, stock_qty viene ignorato e il prodotto funziona come sempre.
alter table products add column if not exists track_stock boolean not null default false;
alter table products add column if not exists stock_qty int;
alter table products add column if not exists low_stock_threshold int not null default 5;

-- Messaggio libero mostrato al posto di "Non disponibile", es.
-- "Di nuovo disponibile dalle 16:00" invece di un generico stop.
alter table products add column if not exists unavailable_note text;

-- ---------- SCALA AUTOMATICA DELLO STOCK ----------
-- Ogni volta che un cliente ordina un prodotto con track_stock attivo,
-- lo stock scala da solo e il prodotto si disattiva quando arriva a zero.
-- Fatto con un trigger (non lato client) per essere atomico e affidabile
-- anche con più ordini contemporanei.
create or replace function kickoff_decrement_stock() returns trigger as $$
begin
  update products
  set
    stock_qty = greatest(coalesce(stock_qty, 0) - new.qty, 0),
    available = case
      when track_stock and greatest(coalesce(stock_qty, 0) - new.qty, 0) <= 0 then false
      else available
    end
  where id = new.product_id and track_stock = true;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_kickoff_decrement_stock on order_items;
create trigger trg_kickoff_decrement_stock
  after insert on order_items
  for each row execute function kickoff_decrement_stock();
