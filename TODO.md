# TODO

## P0 — Critical
- [ ] (Admin) Run migration 0003 in Supabase and try the Property screens (see PROJECT_STATE Next Task)
- [ ] Phase 5: Transport (migration 0004), start with vehicles / drivers / customers

## P1 — Important
- [ ] Decide loan-interest posting rule (D-009 open question) before Phase 5/7
- [ ] Decide whether advance received/returned belongs in cash flow (D-015) before Phase 9
- [ ] Void/correct a rent payment (reverse the payment and its ledger entry together, via a DB function)
- [ ] Tenant history when a tenant is replaced (D-012)
- [ ] Correct an existing month's expected rent
- [ ] UI tests for PropertyListPage, PropertyDetailPage, TenantDialog, AdvanceDialog
- [ ] Shared DataTable (URL-state driven) before first list screen
- [ ] Frontend tests for auth states (RequireAdmin) (DOM test env now available)
- [ ] Edit/delete transaction (decide: manual entries only; module-generated ones are edited via their source record)

## P2 — Enhancement
- [ ] Decide whether to add a serif display face for brand moments (reference uses one)
- [ ] Visual/mobile check of shell on a real device
- [ ] ESLint config
- [ ] Code-split routes (bundle >500 kB warning) in Phase 10
- [ ] Password reset flow (not needed yet; admin can reset in Supabase dashboard)

## Completed
- [x] Phase 4: property rental, migration 0003, 35 SQL checks + 23 new frontend tests (51 pass)
- [x] (Admin) Supabase setup per docs/SUPABASE_SETUP.md reported done
- [x] Phase 3b: Add transaction form, Dialog, FormField, DOM tests (28 pass)
- [x] Phase 3: financial engine, totals function, Transactions screen, tests (16 pass)
- [x] Phase 2 code: migration 0001, RLS, auth, protected routes, SQL tests (PG16)
- [x] Apply brand palette 07 to theme + docs
- [x] Phase 0 docs
- [x] Phase 1 foundation and app shell
