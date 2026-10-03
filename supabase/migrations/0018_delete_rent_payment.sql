-- Admin can delete a recorded rent payment. The payment row AND its ledger transaction are removed together,
-- so the rent charge's paid/outstanding figures and Finance totals update automatically.
create or replace function public.delete_rent_payment(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tx_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select transaction_id into v_tx_id from public.rent_payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  delete from public.rent_payments where id = p_payment_id;
  delete from public.transactions where id = v_tx_id;
end $$;
revoke all on function public.delete_rent_payment(uuid) from public, anon;
grant execute on function public.delete_rent_payment(uuid) to authenticated;
