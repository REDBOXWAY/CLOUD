-- Run once in this project's Supabase SQL Editor before enabling receipt sales.
-- Keeps the existing cloud_submit function and its transaction/idempotency rules.
begin;
do $$ begin
  if to_regprocedure('public.cloud_submit(uuid,date,jsonb)') is null
     and to_regprocedure('public.cloud_submit(uuid,text,jsonb)') is null then
    raise exception 'Unsupported cloud_submit signature; migration cancelled without changes';
  end if;
end $$;
create table if not exists public.cloud_receipts (
  id uuid primary key,
  number text not null unique,
  created_at timestamptz not null,
  sale_date date not null,
  cashier_id uuid not null,
  cashier text not null,
  items jsonb not null,
  total numeric(14,2) not null check (total > 0),
  pdf_base64 text not null,
  saved_at timestamptz not null default now()
);
alter table public.cloud_receipts enable row level security;
revoke all on public.cloud_receipts from anon, authenticated;

create or replace function public.cloud_receipts_ready() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.cloud_read(p_action => 'access', p_barcode => '');
  return true;
end $$;

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
  if coalesce(p_receipt->>'number','') <> 'CD-' || replace(p_date,'-','') || '-' || p_request_id::text
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

create or replace function public.cloud_receipts_list(p_number text default '',p_date date default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  perform public.cloud_receipts_ready();
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into result from (
    select id,number,created_at,total from public.cloud_receipts
    where (p_number='' or strpos(lower(number),lower(p_number))>0)
      and (p_date is null or (created_at at time zone 'Asia/Baku')::date=p_date)
    order by created_at desc,id desc limit 50 offset greatest(0,p_offset)
  ) t;
  return result;
end $$;
create or replace function public.cloud_receipts_get(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  perform public.cloud_receipts_ready();
  select jsonb_build_object('id',id,'number',number,'pdf_base64',pdf_base64) into result
    from public.cloud_receipts where id=p_id;
  return result;
end $$;
revoke all on function public.cloud_receipts_ready() from public,anon;
revoke all on function public.cloud_receipt_submit(uuid,text,jsonb,jsonb) from public,anon;
revoke all on function public.cloud_receipts_list(text,date,integer) from public,anon;
revoke all on function public.cloud_receipts_get(uuid) from public,anon;
grant execute on function public.cloud_receipts_ready() to authenticated;
grant execute on function public.cloud_receipt_submit(uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.cloud_receipts_list(text,date,integer) to authenticated;
grant execute on function public.cloud_receipts_get(uuid) to authenticated;
create index if not exists cloud_receipts_created_idx on public.cloud_receipts(created_at desc,id desc);
notify pgrst, 'reload schema';
commit;
