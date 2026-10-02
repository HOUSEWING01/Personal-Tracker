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
- Transport: vehicles, vehicle_loans, loan_payments, drivers, trips, fuel_logs, tolls
- Sheets: sheet_products, sheet_variants, sheet_inventory, sheet_rentals, sheet_returns
- Gold: gold_loans, gold_loan_payments

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
- `record_advance_movement(property, kind, amount, date, notes)` locks the property row; `adjusted` and `returned` cannot exceed the remaining advance. Not posted to the ledger (D-015).

Tests: `supabase/tests/0003_property_rental.test.sql` (35 self-checking cases, PG16).
