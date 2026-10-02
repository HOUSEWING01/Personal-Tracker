# Changelog

## Session 1 — 2026-10-03
- Created project from SESSION.md (no prior repository existed).
- Added Vite/React/TS/Tailwind v4/Phosphor/React Router scaffold.
- Added responsive AppShell, route placeholders, `useUrlState`, `lib/money.ts` with tests.
- Added all project-state documents.

## Session 1 (addendum) — 2026-10-03
- Applied brand palette 07 to theme tokens (`src/index.css`); renamed `accent*` tokens to `primary/sage/copper/gold`.
- Updated AppShell active-nav and focus-ring colours.
- Rewrote DESIGN_SYSTEM.md with palette, contrast table and component recipes; added D-005.
- Added SESSION.md section 22A (mandatory palette rules); saved reference image to `docs/design-reference/`.

## Session 2 — 2026-10-03
- Added migration 0001 (admin allowlist, `is_admin()`, enums, customers, transactions, RLS, triggers, indexes).
- Tested migration on real PostgreSQL 16 (RLS, anon denial, 6 integrity rules); saved tests in `supabase/tests/`.
- Added Supabase client, `authService`, `AuthProvider`, `RequireAdmin`, `LoginPage`, sign-out in shell, FullScreenMessage.
- Added docs/SUPABASE_SETUP.md; decisions D-006 to D-008; updated DATABASE_SCHEMA, ARCHITECTURE, DESIGN_SYSTEM.

## Session 3 — 2026-10-03
- Phase 3: added `financeEngine.ts` (single home of all money formulas) + 8 tests; `lib/dates.ts` (IST) + tests; `formatSignedINR`.
- Migration 0002 `transaction_totals()` (RLS-safe, tested on PG16).
- `transactionService` (list/filter/paginate, totals, createTransaction for modules), TanStack Query hooks.
- Finance > Transactions screen: summary tiles, URL-state filters (search/type/module/date/sort/page), table on desktop and cards on mobile, loading/empty/error states.
- Decisions D-009, D-010; formulas documented in ARCHITECTURE.md.

## Session 4 — 2026-10-03
- Phase 3b: Add transaction form (Finance > Transactions > Add transaction).
- New shared UI: `Dialog` (accessible modal/bottom sheet), `FormField`/`fieldA11y`.
- `transactionForm.ts` (Zod schema, defaults, `toNewTransaction`), `useCreateTransaction` (invalidates list + summary), `AddTransactionDialog`.
- Added react-hook-form, zod, @hookform/resolvers; dev: jsdom, @testing-library/react, user-event (DOM tests now possible).
- 12 new tests (28 total): schema rules, dialog a11y/focus/Esc, validation, paise submit, failure + retry, adjustment reason.
- Decision D-011.

## Session: repo re-verification (no feature work)
- Verified repo against docs: 28 tests pass, `npm run build` passes. Docs match code.
- Fixed docs/SUPABASE_SETUP.md: step 4 now lists migration 0002 as well as 0001.

## Session: Phase 4 — Property rental
- Migration 0003: properties, tenants (one per property), rent_charges, rent_payments, advance_movements; views property_overview and rent_charge_status; functions ensure_rent_charges, record_rent_payment, record_advance_movement. Client writes to charges/payments/advance are blocked by RLS; functions enforce the rules.
- Rent payments post to the ledger atomically (customer_payment, module property, entity link set).
- SQL tests: 35 self-checking cases on PG16 (`supabase/tests/0003_property_rental.test.sql`), all pass.
- Frontend: `types/property.ts`, `services/propertyService.ts`, `features/property/*` (engine, forms, hooks, dialogs, list page, detail page with Rent / Advance / Tenant tabs). Routes `/property` and `/property/:id`.
- 23 new frontend tests (51 total): engine formulas, form schemas, RentPaymentDialog. `npm run build` passes.
- Decisions D-012 to D-015. docs/SUPABASE_SETUP.md and supabase/tests/README.md updated.

## Session: deployment (GitHub + Vercel) and auth hang fix
- Pushed to github.com/HOUSEWING01/Personal-Tracker (main). Deployed to Vercel; Supabase Site URL and Redirect URL set to the Vercel URL.
- Vercel showed "Supabase is not configured": the VITE_ variables were missing from the build. Fixed on the Vercel side (env vars + redeploy), no code change.
- Local dev stuck on "Loading…" with no message: session and admin checks could hang silently. Added `lib/withTimeout.ts` (+3 tests); `getSession` and `checkIsAdmin` now fail after 10 s with a message and the existing "Try again" screen. Errors are also logged to the console as `[auth] …`.
- .gitignore: added `*.zip`.
