# Project State

## Current Phase
Phase 4 — Property rental (CODE COMPLETE). Admin reported the Supabase setup (Phase 2/3) done with no problems.

## Current Feature
None in progress.

## Last Completed Task
Phase 4: property rental. Migration 0003, services, hooks, forms, Property list + detail (Rent / Advance / Tenant tabs), rent payments posting to the ledger atomically, advance history. Tests added (SQL + frontend).

## In Progress
Nothing in code. Outstanding admin action: run migration 0003 in Supabase and try the Property screens (see Next Task).

## Completed
- Phase 0 docs; Phase 1 foundation/shell/palette; Phase 2 migration 0001 + admin auth; Phase 3/3b financial engine + Add transaction form
- Phase 4: `types/property.ts`, `services/propertyService.ts`, `features/property/{propertyEngine,propertyForms,hooks,labels,submitError,StatusBadge,PropertyDialog,TenantDialog,RentPaymentDialog,AdvanceDialog,PropertyListPage,PropertyDetailPage,RentTab,AdvanceTab,TenantTab}`, migration 0003, routes `/property` and `/property/:id`

## Known Issues
- Migration 0003 and the Property screens have not run against the real Supabase project or a real browser yet. SQL logic verified on PG16 with stubbed auth (35 checks).
- Rent payments cannot be edited or deleted (same as transactions). A wrong payment currently needs a manual fix in the database.
- Replacing a tenant overwrites the single tenant row; previous tenant details are not kept (D-012).
- Rent changes apply only to months not yet created; there is no UI to correct an existing month's expected amount.
- No UI tests for PropertyListPage / PropertyDetailPage / tenant and advance dialogs; auth screens and Transactions page still untested.
- Bundle >500 kB warning (Phase 10).
- Open business questions: loan interest (D-009), advance in cash flow (D-015).

## Database Status
Migrations 0001, 0002, 0003 written and verified on PG16 (stub). Tables: admin_users, customers, transactions, properties, tenants, rent_charges, rent_payments, advance_movements. Views: property_overview, rent_charge_status. Functions: is_admin(), transaction_totals(), ensure_rent_charges(), record_rent_payment(), record_advance_movement().

## UI Status
Shell, auth screens, Transactions, Property list + detail (responsive, URL-state filters and tab). Not visually checked in a browser.

## Testing Status
Vitest: 51 tests pass (money, dates, financeEngine, transactionForm, AddTransactionDialog, propertyEngine, propertyForms, RentPaymentDialog). SQL tests in supabase/tests/ (0001, 0002, 0003 pass on PG16). `npm run build` passes.

## Deployment Status
Not deployed. Needs Supabase env vars in Vercel.

## Next Task
1. (Admin) Run `supabase/migrations/0003_property_rental.sql` in the Supabase SQL editor. Open Property rental, add a property, add its tenant, record a rent payment, check it appears in Finance > Transactions, add an advance entry. Report anything wrong.
2. Answer the open questions: loan interest (D-009) before Phase 5; advance in cash flow (D-015) before Phase 9.
3. Phase 5 — Transport (migration 0004): vehicles, drivers, customers (reuse shared `customers`), trips, fuel, tolls, vehicle loans; central profit formulas. Start with vehicles/drivers/customers.

## Important Notes
- Brand palette fixed (SESSION.md 22A, D-005). Token classes only.
- Money: integer paise (D-003). Dates: IST business dates (D-004). Security: D-006. Module tables per phase: D-007. Amount sign: D-008. Formulas: D-009 / ARCHITECTURE.md. Server state: D-010. Forms: D-011. Property model: D-012..D-015.
- Never compute money in components; call financeEngine / propertyEngine. Forms: schema -> toX() -> mutation -> service.
- Writes that touch the ledger go through database functions (D-014); do not insert into rent_payments/rent_charges/advance_movements from the client.
- `en-IN` formats September as "Sept"; do not hardcode month abbreviations in tests.
