-- 0004_transport_masters.sql  (Phase 5a)
-- Transport master data: vehicles and drivers. Customers are the shared `customers` table from
-- 0001 (reused, never duplicated; see DECISIONS D-016/D-017). Trips, fuel, tolls and vehicle loans
-- come in later migrations.
--
-- Total investment is NOT stored: it is derived (purchase_price + container_price) in
-- src/features/transport/transportEngine.ts so it can never drift from its parts.

create table public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(btrim(name)) > 0),
  registration_number text not null check (length(btrim(registration_number)) > 0),
  purchase_price      numeric(14, 2) not null default 0 check (purchase_price >= 0),
  purchase_date       date,
  container_price     numeric(14, 2) not null default 0 check (container_price >= 0),
  container_details   text,
  status              text not null default 'active' check (status in ('active', 'inactive', 'sold')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- Same vehicle however it is typed: "TN 38 AB 1234", "tn38ab1234" and "TN-38-AB-1234" collide.
create unique index vehicles_registration_key
  on public.vehicles (upper(regexp_replace(registration_number, '[\s-]+', '', 'g')));
create index vehicles_name_idx on public.vehicles (lower(name));
create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

create table public.drivers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  mobile     text check (mobile is null or mobile ~ '^[0-9]{10}$'),
  address    text,
  status     text not null default 'active' check (status in ('active', 'inactive')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Driver payment is per trip (SESSION.md), so there is no salary column here.
create unique index drivers_mobile_key on public.drivers (mobile) where mobile is not null;
create index drivers_name_idx on public.drivers (lower(name));
create trigger drivers_set_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();

-- ---------- RLS: authenticated admin only ----------
alter table public.vehicles enable row level security;
alter table public.drivers  enable row level security;

create policy vehicles_admin_all on public.vehicles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy drivers_admin_all on public.drivers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.vehicles, public.drivers from anon;
