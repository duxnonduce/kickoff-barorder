-- ============================================================
-- KICKOFF ORDINA — migrazione 0016
-- Limite ordini attivi per cliente: evita che qualcuno intasi la
-- coda con troppi ordini pendenti dallo stesso numero di telefono.
-- Fatto con un trigger (non lato client) per essere affidabile anche
-- se qualcuno prova a bypassare l'interfaccia.
-- Esegui questo file nel SQL Editor di Supabase (dopo 0015)
-- ============================================================

create or replace function kickoff_check_order_limit() returns trigger as $$
declare
  active_count int;
begin
  select count(*) into active_count
  from orders
  where customer_phone = new.customer_phone
    and status in ('in_attesa', 'accettato', 'pronto');

  if active_count >= 3 then
    raise exception 'ORDER_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kickoff_check_order_limit on orders;
create trigger trg_kickoff_check_order_limit
  before insert on orders
  for each row execute function kickoff_check_order_limit();
