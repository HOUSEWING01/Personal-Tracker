# Database Schema

Status: Migration 0001 written and tested on PostgreSQL 16 (stubbed auth). NOT yet applied to a real Supabase project (see TODO P0).

## Conventions
UUID PKs (`gen_random_uuid()`), FKs, CHECK constraints for non-negative amounts/quantities, `created_at`/`updated_at timestamptz` with `set_updated_at()` trigger, indexes on FKs and filter columns, RLS on every table. Money: `numeric(14,2)` INR. Business dates: `date`.

## Migration 0001_foundation.sql
**Security**
- `admin_users(user_id → auth.users, created_at)`: RLS on, no policies (clients cannot touch it).
- `is_admin()`: SECURITY DEFINER, `search_path=public`, executable by `authenticated` only.
- Every table policy: `for all to authenticated using (is_admin()) with check (is_admin())`. `anon` has all privileges revoked.

**Enums**
- `business_module`: property, transport, sheets, gold_loans, general
- `transaction_type`: income, expense, investment, loan_received, loan_repayment, customer_payment, refund, adjustment

**customers**: id, name (non-blank), mobile (nullable, exactly 10 digits, unique when present), address, notes, timestamps. Index on `lower(name)`.

**transactions**: id, type, amount, module, entity_type, entity_id, transaction_date, payment_method, description, timestamps.
- Amount > 0 for every type; `adjustment` may be negative but never 0.
- `entity_type` and `entity_id` are both set or both null (traceability to the source record).
- Indexes: date desc; (module, date desc); type; (entity_type, entity_id).

## Planned (added with each module's migration, see D-007)
- Transport: vehicles, drivers, trips, fuel_logs, tolls, vehicle_loans, loan_payments (all built)
- Sheets: sheet_products, sheet_variants, sheet_inventory, sheet_rentals, sheet_returns
- Gold: gold_loans, gold_loan_payments (built, migration 0011)

## Migration 0002_transaction_totals.sql
`transaction_totals(p_from date, p_to date, p_module business_module)` returns `(type, total numeric)` grouped by type. SECURITY INVOKER (RLS applies; non-admin gets 0 rows). Execute granted to `authenticated` only. Tested in `supabase/tests/0002_transaction_totals.test.sql` (PG16).

## Migration 0003_property_rental.sql (Phase 4)
| Table | Purpose / key rules |
|---|---|
| `properties` | name (unique, case-insensitive), `property_type` (shop/godown/house/land/other), address, description, `status` (active/inactive), `monthly_rent` > 0 |
| `tenants` | ONE per property (`property_id` unique). name, mobile (10 digits), address, notes, `rental_start_date`, `rental_end_date` (>= start). Rental dates live here because they describe the tenancy (D-012) |
| `rent_charges` | one row per property per month: `period` (always the 1st), `expected_amount` > 0 (snapshot of the rent when created). Unique (property_id, period) |
| `rent_payments` | amount > 0, payment_date, payment_method, notes, `transaction_id` (unique FK to the ledger entry). FK (property_id, period) to `rent_charges` |
| `advance_movements` | history: `kind` received / adjusted / returned, amount > 0, date, notes. Remaining = received - adjusted - returned |

Views (SECURITY INVOKER, RLS applies, raw sums only): `property_overview` (property + tenant name/dates + expected, paid, advance sums), `rent_charge_status` (charge + paid_amount + last_payment_date). Outstanding and remaining advance are derived in `propertyEngine.ts`, not in SQL.

Write model: `properties` and `tenants` have an admin-all policy. `rent_charges`, `rent_payments`, `advance_movements` have an admin SELECT-only policy; all writes go through SECURITY DEFINER functions that re-check `is_admin()` (search_path pinned), execute granted to `authenticated` only:
- `ensure_rent_charges(p_property_id default null)` creates missing monthly charges from the tenancy start month to min(end month, current IST month), at the property's current rent. Idempotent. Active properties only. Returns rows added.
- `record_rent_payment(property, period, amount, date, method, notes)` locks the charge row, rejects amounts above the month's outstanding, then inserts the ledger entry (`customer_payment`, module `property`, `entity_type='rent_payment'`, `entity_id`=payment id) and the payment in ONE transaction. Returns the payment id.
- `record_advance_movement(property, kind, amount, date, notes)` locks the property row; `adjusted` and `returned` cannot exceed the remaining advance. `received` / `returned` also post a `deposit_received` / `deposit_returned` ledger entry in the same transaction (`advance_movements.transaction_id`); `adjusted` posts nothing (D-029).

Tests: `supabase/tests/0003_property_rental.test.sql` (35 self-checking cases, PG16).

## Migration 0004_transport_masters.sql (Phase 5a)
| Table | Purpose / key rules |
|---|---|
| `vehicles` | name, `registration_number` (unique ignoring case, spaces, hyphens), `purchase_price` >= 0, `purchase_date`, `container_price` >= 0, `container_details`, `status` (active/inactive/sold), notes. **No total column**: investment is derived (D-016) |
| `drivers` | name, mobile (10 digits, unique when present), address, `status` (active/inactive), notes. No salary: pay is per trip |
| `customers` | existing shared table from 0001, reused as-is (D-017) |

RLS: admin-all on `drivers`; `vehicles` was admin-all in 0004 and became read-only in 0005. Anon has no privileges. Tests: `supabase/tests/0004_transport_masters.test.sql` (self-checking, **not yet run on PG16**, see PROJECT_STATE).

## Migration 0005_vehicle_investment.sql (Phase 5a-2)
- `vehicles.purchase_date` is NOT NULL (earlier rows without one were set to their creation date, IST).
- Unique index `transactions_vehicle_investment_key` on `(entity_type, entity_id)` for `vehicle_purchase` / `vehicle_container`: one ledger row per vehicle part.
- `save_vehicle(name, registration, purchase_price, purchase_date, container_price, container_details, status, notes, id default null)`: SECURITY DEFINER, `is_admin()` re-checked, search_path pinned, execute for `authenticated` only. Creates or edits the vehicle, then calls `sync_vehicle_investments`. Returns the vehicle id.
- `sync_vehicle_investments(vehicle_id)`: internal (execute revoked from all client roles). For each part: price > 0 inserts or updates the `investment` entry (module `transport`, date = purchase date, description `Vehicle purchase|container - name (reg)`); price 0 deletes the entry.
- RLS: policy `vehicles_admin_all` replaced by `vehicles_admin_read` (SELECT only). All vehicle writes go through `save_vehicle`.
- Existing vehicles are synced once by the migration itself.
- Tests: `supabase/tests/0005_vehicle_investment.test.sql` (30 self-checking cases; **not yet run on PG16**). Use a fresh scratch DB: the 0004 test inserts vehicles directly, which 0005 forbids.


## Migration 0006_trips.sql (Phase 5b)
- `trips`: `vehicle_id`, `driver_id`, `customer_id` (all `on delete restrict`), `from_location`, `to_location`, `distance_km` numeric(10,2) > 0, `rate_per_km` numeric(12,2) > 0, `driver_payment` numeric(14,2) >= 0, `trip_date`, `status` (planned / completed / cancelled), `notes`. Revenue is NOT stored (derived, D-018). Indexes on date, vehicle, driver, customer, status.
- RLS: `trips_admin_read` (SELECT only). All writes go through `save_trip`.
- `save_trip(vehicle, driver, customer, from, to, distance_km, rate_per_km, driver_payment, trip_date, status, notes, id default null)`: SECURITY DEFINER, `is_admin()` re-checked, search_path pinned, execute for `authenticated` only. Validates inputs, requires an active vehicle/driver for a new trip (or when either is changed), then calls `sync_trip_ledger`. Returns the trip id.
- `sync_trip_ledger(trip_id)`: internal (execute revoked from all client roles). Completed trip: upserts `income` (`trip_revenue`, round(distance x rate, 2)) and, if driver payment > 0, `expense` (`trip_driver`), module `transport`, dated the trip date. Any other status: deletes both entries.
- Unique index `transactions_trip_key` on `(entity_type, entity_id)` for `trip_revenue` / `trip_driver`.
- Tests: not written yet (deferred by the admin; see TODO).

## Migration 0007_fuel_tolls.sql (Phase 5c)
- `fuel_logs`: `vehicle_id`, optional `trip_id` (both `on delete restrict`), `fuel_date`, `litres` (0 to 100,000), `price_per_litre` (0 to 10,000), `total` = generated `round(litres * price_per_litre, 2)` (> 0), optional `odometer_km` integer, `notes`.
- `tolls`: `trip_id` (required), `vehicle_id` (always the trip's vehicle, set by `save_toll`), `toll_date`, `amount` > 0, optional `location`, `notes`.
- RLS: admin SELECT only on both. Writes go through `save_fuel_log(vehicle, trip, date, litres, price, odometer, notes, id default null)` and `save_toll(trip, date, amount, location, notes, id default null)`: SECURITY DEFINER, `is_admin()` re-checked, search_path pinned, execute for `authenticated` only. Each upserts its `expense` ledger entry (`fuel_log` / `toll`) in the same transaction. Unique index `transactions_fuel_toll_key` allows one ledger row each.
- View `trip_cost_totals` (security_invoker): per trip `fuel_total` and `toll_total` raw sums. Profit is computed in `transportEngine.ts`.
- `save_trip` is re-issued: a trip's vehicle cannot change while fuel logs or tolls reference the trip. Grants unchanged.
- Tests: not written yet (deferred by the admin; see TODO).

## Migration 0008_vehicle_loans.sql (Phase 5d)
- `vehicle_loans`: optional `vehicle_id` (`on delete restrict`), `lender`, `principal` > 0 (amount received), `start_date`, `interest_rate` numeric(5,2) 0 to 100 (reference only), `emi` > 0, optional `tenure_months` 1 to 600, `status` (active / closed), `notes`.
- `loan_payments`: `loan_id` (`on delete restrict`), `payment_date`, `amount` > 0 (full amount paid, interest included, D-009), `notes`.
- RLS: admin SELECT only on both. Writes go through `save_vehicle_loan(vehicle, lender, principal, start_date, interest_rate, emi, tenure_months, status, notes, id default null)` and `save_loan_payment(loan, payment_date, amount, notes, id default null)`: SECURITY DEFINER, `is_admin()` re-checked, search_path pinned, execute for `authenticated` only.
- Ledger (module `transport`): the loan upserts a `loan_received` entry (`vehicle_loan`, dated the start date); each payment upserts a `loan_repayment` entry (`loan_payment`). Unique index `transactions_vehicle_loan_key` allows one ledger row each. Renaming the lender updates the descriptions of the loan's repayment entries.
- Rules enforced in the functions: payment date >= start date; a new payment needs an active loan; the start date cannot move after an existing payment; a payment cannot move to another loan.
- View `loan_payment_totals` (security_invoker): per loan `paid_total`, `payment_count`, `last_payment_date`. No outstanding figure (D-020).
- Tests: `supabase/tests/0008_vehicle_loans.test.sql` (64 self-checking cases, run on PG16).

## Migration 0009_transport_profit.sql (Phase 5e)
- Function `vehicle_profit_totals(p_from date default null, p_to date default null)`: SECURITY INVOKER (RLS applies), execute for `authenticated` only. Returns per vehicle raw sums of the ledger's `trip_revenue`, `trip_driver`, `fuel_log`, `toll` and `loan_payment` entries within the dates; `vehicle_id` NULL = repayments of loans with no vehicle. No tables or views added. Profit is computed in `transportEngine.ts` (D-021). No SQL test written (smoke-checked once on PG16).

## Migration 0010_sheet_rental.sql (Phase 6)
- `sheet_products`: `name` (unique ignoring case and spaces), `status` (active / inactive), `notes`. RLS: admin all (plain master, edited from the browser).
- `sheet_variants`: `product_id` (`on delete restrict`), `length_ft` numeric(6,2) > 0, `total_quantity` integer >= 0, `status`, `notes`; unique `(product_id, length_ft)`. Written only through `save_sheet_variant`.
- `sheet_rentals`: `customer_id` (shared `customers`), `variant_id` (both `on delete restrict`), `quantity` > 0, `rental_date`, optional `expected_return_date` (>= rental date), `rent_amount` >= 0, `discount` >= 0 and <= rent (`sheet_rentals_discount_le_rent_check`), `status` (active / closed / cancelled), `notes`. Indexes on date, variant, customer, status.
- `sheet_rental_payments`: `rental_id`, `payment_date`, `amount` > 0, optional `payment_method` (cash / upi / bank_transfer / cheque / other), `notes`. Unique index `transactions_sheet_payment_key` on `(entity_type, entity_id)` for `sheet_payment`: one ledger row per payment.
- `sheet_returns`: `rental_id`, `return_date`, `returned_quantity`, `damaged_quantity`, `missing_quantity` (each >= 0, together > 0), `notes`.
- RLS: admin SELECT only on variants, rentals, payments and returns. Anon has no privileges.
- Views (security_invoker): `sheet_variant_stock` (per variant: `total_quantity`, `rented_quantity`, `damaged_quantity`, `missing_quantity`, `available_quantity`, all derived) and `sheet_rental_totals` (per rental: returned / damaged / missing totals, `last_return_date`, `paid_total`, `payment_count`).
- Functions (SECURITY DEFINER, `is_admin()` re-checked, search_path pinned, execute for `authenticated` only): `save_sheet_variant(product, length_ft, total_quantity, status, notes, id default null)`; `save_sheet_rental(customer, variant, quantity, rental_date, expected_return_date, rent, discount, notes, advance default 0, payment_method default null, id default null)`; `cancel_sheet_rental(id)`; `save_sheet_payment(rental, date, amount, method, notes, id default null)`; `record_sheet_return(rental, date, returned, damaged, missing, notes)`; `delete_sheet_return(id)`. Internal helper `sheet_refresh_status(rental)` (execute revoked from client roles). Rules: see D-022 / D-023 (availability under a variant row lock, returns capped at what is still out, no overpayment, no return date in the future, undo refused if the sheets were rented again).
- Ledger: payments (and a new rental's advance) post `customer_payment`, module `sheets`, `entity_type` `sheet_payment`.
- Tests: `supabase/tests/0010_sheet_rental.test.sql` (compact smoke test, run on PG16).

## Migration 0011_gold_loans.sql (Phase 7)
| Table | Purpose / key rules |
|---|---|
| `gold_loans` | person_name, optional 10-digit mobile, gold_description, optional gold_weight_grams (> 0, 3 decimals), bank, pledge_date, optional due_date (>= pledge), `principal` > 0 (amount received), `annual_rate` 0-100, `status` (active / closed / released), `closed_date` (required when not active, null when active, >= pledge) |
| `gold_loan_payments` | loan_id, payment_date, amount > 0 (full amount, interest included), notes |
View `gold_loan_payment_totals` (paid_total, payment_count, last_payment_date). Functions `save_gold_loan()`, `save_gold_loan_payment()` (SECURITY DEFINER, admin only) post `loan_received` / `loan_repayment` (module `gold_loans`, entity `gold_loan` / `gold_loan_payment`) in the same transaction. No interest is stored (D-025). Browser read-only.

## Migration 0012_dashboard.sql (Phase 8)
Function `dashboard_counts(p_today, p_month_from, p_month_to)`: SECURITY INVOKER, one row of raw counts and sums for the Dashboard (properties, rent outstanding, vehicles, trips this month, sheet stock, overdue rentals, sheet rent outstanding). No tables. Formulas stay in the app engines (D-026).
