-- Adds `outstanding` (expected rent - paid rent) to property_overview so the Godowns list can filter on "Rent due".
-- Same view as before; the new column is appended last, so existing columns and dependants are untouched.
create or replace view public.property_overview with (security_invoker = true) as
select
  p.id, p.name, p.property_type, p.address, p.description, p.status, p.monthly_rent, p.created_at,
  t.name as tenant_name, t.rental_start_date, t.rental_end_date,
  coalesce((select sum(c.expected_amount) from public.rent_charges c where c.property_id = p.id), 0) as expected_total,
  coalesce((select sum(r.amount) from public.rent_payments r where r.property_id = p.id), 0) as paid_total,
  coalesce((select sum(a.amount) from public.advance_movements a where a.property_id = p.id and a.kind = 'received'), 0) as advance_received,
  coalesce((select sum(a.amount) from public.advance_movements a where a.property_id = p.id and a.kind = 'adjusted'), 0) as advance_adjusted,
  coalesce((select sum(a.amount) from public.advance_movements a where a.property_id = p.id and a.kind = 'returned'), 0) as advance_returned,
  coalesce((select sum(c.expected_amount) from public.rent_charges c where c.property_id = p.id), 0)
    - coalesce((select sum(r.amount) from public.rent_payments r where r.property_id = p.id), 0) as outstanding
from public.properties p
left join public.tenants t on t.property_id = p.id;
