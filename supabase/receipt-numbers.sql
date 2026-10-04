-- Run after receipts.sql. Existing archived PDFs and numbers remain unchanged.
begin;
create table if not exists public.cloud_receipt_numbers (
  serial_number bigint generated always as identity primary key,
  request_id uuid not null unique,
  cashier_id uuid not null
);
alter table public.cloud_receipt_numbers enable row level security;
revoke all on public.cloud_receipt_numbers from anon,authenticated;
revoke all on sequence public.cloud_receipt_numbers_serial_number_seq from anon,authenticated;

create or replace function public.cloud_receipt_reserve(p_request_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing_number text;
  existing_owner uuid;
  serial bigint;
begin
  perform public.cloud_receipts_ready();
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select number,cashier_id into existing_number,existing_owner from public.cloud_receipts where id=p_request_id;
  if found then
    if existing_owner <> auth.uid() then raise exception 'Request belongs to another cashier'; end if;
    return existing_number;
  end if;
  select serial_number,cashier_id into serial,existing_owner
    from public.cloud_receipt_numbers where request_id=p_request_id;
  if found then
    if existing_owner <> auth.uid() then raise exception 'Request belongs to another cashier'; end if;
  else
    insert into public.cloud_receipt_numbers(request_id,cashier_id)
      values(p_request_id,auth.uid()) returning serial_number into serial;
  end if;
  return lpad(serial::text,greatest(6,length(serial::text)),'0');
end $$;
revoke all on function public.cloud_receipt_reserve(uuid) from public,anon;
grant execute on function public.cloud_receipt_reserve(uuid) to authenticated;

create or replace function public.cloud_receipt_submit(
  p_request_id uuid, p_date text, p_items jsonb, p_receipt jsonb
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  prior public.cloud_receipts%rowtype;
  amount numeric;
  result text;
  date_type text;
begin
  perform public.cloud_receipts_ready();
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into prior from public.cloud_receipts where id=p_request_id;
  if found then
    if prior.cashier_id <> auth.uid() or prior.sale_date <> p_date::date or prior.items <> p_items then
      raise exception 'Request ID already used for another sale';
    end if;
    return 'OK';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'Invalid purchase items';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) item
    where coalesce((item->>'quantity')::numeric,0)<=0 or coalesce((item->>'amount')::numeric,0)<=0) then
    raise exception 'Invalid quantity or amount';
  end if;
  select sum((item->>'amount')::numeric) into amount from jsonb_array_elements(p_items) item;
  if coalesce(p_receipt->>'number','') <> coalesce(
      (select lpad(serial_number::text,greatest(6,length(serial_number::text)),'0')
       from public.cloud_receipt_numbers where request_id=p_request_id and cashier_id=auth.uid()),
      'CD-' || replace(p_date,'-','') || '-' || p_request_id::text)
    or (p_receipt->>'total')::numeric is distinct from amount
    or p_receipt->'items' is distinct from p_items
    or coalesce(p_receipt->>'pdf_base64','') not like 'JVBERi0%'
    or length(p_receipt->>'pdf_base64') > 15000000 then
    raise exception 'Invalid receipt';
  end if;
  -- Support the two date signatures used by earlier CLOUD deployments.
  if to_regprocedure('public.cloud_submit(uuid,date,jsonb)') is not null then date_type := 'date';
  elsif to_regprocedure('public.cloud_submit(uuid,text,jsonb)') is not null then date_type := 'text';
  else raise exception 'Unsupported cloud_submit signature; inspect the existing function before installation';
  end if;
  execute 'select public.cloud_submit($1,$2::' || date_type || ',$3)' into result using p_request_id,p_date,p_items;
  if result is distinct from 'OK' then raise exception 'Sale was not saved: %',result; end if;
  insert into public.cloud_receipts(id,number,created_at,sale_date,cashier_id,cashier,items,total,pdf_base64)
  values(p_request_id,p_receipt->>'number',(p_receipt->>'created_at')::timestamptz,p_date::date,auth.uid(),
    coalesce(auth.jwt()->>'email',auth.uid()::text),p_items,amount,p_receipt->>'pdf_base64');
  return 'OK';
end $$;

notify pgrst, 'reload schema';
commit;
