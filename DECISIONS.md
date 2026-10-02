# Decisions

## D-001 Tailwind v4 with CSS `@theme` tokens
### Context
Need a design-token system without extra config.
### Decision
Use Tailwind v4 via `@tailwindcss/vite`; tokens live in `src/index.css`.
### Reason
Fewer files, tokens are the single source of truth.
### Alternatives
Tailwind v3 + `tailwind.config.js`.

## D-002 Data router (`createBrowserRouter`)
### Context
SESSION.md requires scroll restoration and natural Back/Forward.
### Decision
Use `createBrowserRouter` + `<ScrollRestoration />`; list state lives in URL query params via `useUrlState`.
### Reason
`ScrollRestoration` needs a data router.
### Alternatives
`BrowserRouter` with manual scroll handling.

## D-003 Money as integer paise
### Context
Float arithmetic is unsafe for financial totals.
### Decision
DB: `numeric(14,2)` INR. App: integer paise via `lib/money.ts`. Display via `formatINR`.
### Reason
Exact arithmetic, simple to test.
### Alternatives
decimal.js (extra dependency, not needed yet).

## D-004 Dates and timezone
### Decision
Business dates (rent month, trip date, pledge date) are Postgres `date`. Audit columns are `timestamptz`. Business timezone is Asia/Kolkata; "today"/"this month" are computed in that zone.
### Reason
Avoids off-by-one day errors near midnight UTC.
### Alternatives
All timestamps in UTC only.

## D-005 Brand colour palette "07"
### Context
Admin supplied an approved palette (6D9773, 0C3B2E, BB8A52, FFBA00) as the app theme. Initial Phase 1 used a placeholder teal accent.
### Decision
Adopt the four colours as the fixed brand palette. Deep green `#0C3B2E` is the primary action/ink colour; sage, copper and gold are supporting. Tokens defined in `src/index.css`; rules recorded in SESSION.md 22A and DESIGN_SYSTEM.md.
### Reason
White on sage (`#6D9773`) is only 3.3:1, which fails WCAG for normal text, so sage cannot be the primary button colour with white text as in the reference mockup. Deep green gives 12.5:1 and still matches the look.
### Alternatives
Sage as primary button with white text (rejected: contrast); darkening sage (rejected: departs from approved palette).

## D-006 Admin access via `admin_users` allowlist + `is_admin()`
### Context
Single admin today; RLS must restrict everything to that admin, and sign-ups must not grant access.
### Decision
Allowlist table with no client policies, read only through a SECURITY DEFINER `is_admin()`. All table policies call it. The frontend also calls `is_admin()` to decide admin vs "Not authorised".
### Reason
A valid login alone grants nothing. Extra admins later = one insert. The frontend check is UX only; RLS is the real enforcement.
### Alternatives
Hardcode the admin UUID in policies (brittle); rely on "sign-ups disabled" only (one dashboard toggle away from open access).

## D-007 Module tables are created in each module's phase
### Context
Phase 2 is "database + migrations", but module schemas are best designed with their features.
### Decision
Migration 0001 holds only the shared foundation (customers, transactions, security). Property/Transport/Sheets/Gold tables ship in their own migrations.
### Reason
Smaller, testable migrations; avoids designing tables before their workflows exist.
### Alternatives
One large Phase 2 migration for everything.

## D-008 Transaction amount sign rule
### Decision
`amount` is positive for all types, direction is implied by `type`. `adjustment` is the only type that may be negative (never 0).
### Reason
Prevents sign mistakes in aggregation; adjustments need a way to correct either direction.
### Alternatives
Signed amounts everywhere; separate debit/credit columns.

## D-009 Cash-basis financial formulas
### Context
SESSION.md lists 8 transaction types but not how each feeds profit and cash flow. `income` vs `customer_payment` overlap.
### Decision
Cash-basis. Revenue = income + customer_payment - refund. Investments, loan received and loan repayments never affect profit (they move cash/liability only). Adjustments are signed cash corrections: included in net cash flow only. Full formulas in ARCHITECTURE.md.
### Reason
Matches the app's purpose (tracking money in/out); keeps profit free of capital and financing items; one reversible place to change (financeEngine.ts).
### Alternatives
Accrual basis; treating adjustments as revenue/expense; excluding customer_payment from revenue (would double count if modules also post income).
### Open question for admin
Gold-loan interest and vehicle-loan interest: post as `expense` (reduces profit) or inside `loan_repayment`? Decide in Phase 5/7.

## D-010 TanStack Query + database-side totals
### Decision
Use TanStack Query for server state (loading/error/retry/caching, `keepPreviousData` for paging). Totals come from a SECURITY INVOKER Postgres function so RLS still applies.
### Reason
Avoids loading thousands of rows; consistent async states; RLS-safe.
### Alternatives
Client-side summing of all rows; SECURITY DEFINER function (would bypass RLS).

## D-011 Form pattern and manual-entry rules
### Decision
Forms use React Hook Form + a Zod schema that validates raw strings; a separate `toNewTransaction()` converts to integer paise (no Zod transforms, keeps typing simple and testable). Shared `FormField` + `fieldA11y` provide labels, hints and `role="alert"` errors. Modals use the shared `Dialog`.
Manual transactions: any type and module allowed; `adjustment` is the only type that may be negative or require a reason (description mandatory, for audit); amount capped to numeric(14,2). Payment method stored as a lowercase key (`cash`, `upi`, `bank_transfer`, `cheque`, `other`); display labels live in `labels.ts`. Manual entries have no entity link (`entity_type/entity_id` null); module-generated entries will set them.
### Reason
Same rules in UI (Zod), service and database (constraints) per SESSION.md section 27; consistent accessible forms for all later modules.
### Alternatives
Zod transforms to paise inside the schema; free-text payment method.

## D-012 Property rental data model
### Context
SESSION.md lists rental start/end under Property, but a vacant property has no rental dates, and one property has exactly one tenant.
### Decision
`tenants.property_id` is unique (one tenant per property). Rental start/end dates are stored on the tenant row because they describe the tenancy. `monthly_rent` stays on the property. Property status is `active`/`inactive`; "occupied" is derived from the tenant and end date. Replacing a tenant edits the one tenant row (previous tenant details are not kept yet, see TODO).
### Reason
Matches the stated rule with the fewest tables, and avoids nullable tenancy columns on properties.
### Alternatives
Dates on the property; a tenancies history table (more correct for tenant changes, larger than Phase 4 needs).

## D-013 Monthly rent as per-month charges, created lazily
### Context
"Expected rent" must stay correct after the rent is changed, and outstanding must be exact.
### Decision
`rent_charges` stores one row per property-month with the expected amount copied from the rent at creation. `ensure_rent_charges()` creates missing months (start month through the current IST month, or the tenancy end month). A rent change only affects months not yet created. A month counts as due from the 1st.
### Reason
No cron job needed; history never silently changes; outstanding = sum(expected) - sum(paid) is trivial and testable.
### Alternatives
Compute expected on the fly from the current rent (rewrites history when rent changes); scheduled job (extra infrastructure).

## D-014 Ledger-linked writes go through database functions
### Context
A rent payment must create a ledger entry and a payment record together, never one without the other, and must not exceed the month's outstanding.
### Decision
`rent_payments`, `rent_charges` and `advance_movements` are read-only to clients (RLS). `record_rent_payment` writes the transaction and the payment atomically, locking the charge row; `record_advance_movement` locks the property row. Functions are SECURITY DEFINER with an explicit `is_admin()` check. Rent posts as `customer_payment` / module `property` / `entity_type='rent_payment'`.
### Reason
Atomic, race-safe, and the rules cannot be bypassed from the browser. Same rules are also checked in the Zod schemas for fast feedback.
### Alternatives
Two client calls (`createTransaction` then insert; can leave orphans); triggers (harder to read and test).

## D-015 Advance is history only, not in the ledger (OPEN QUESTION)
### Context
An advance is a refundable deposit, not revenue. The ledger has no deposit type, and posting it as `customer_payment` or `income` would inflate revenue.
### Decision
Phase 4 records advance received / adjusted / returned in `advance_movements` only. Nothing is posted to transactions. Cash flow therefore does not yet include advance money.
### Open question for admin
Should advance received/returned appear in cash flow? That needs a new ledger treatment (for example a deposit type that moves cash but not profit). Decide before Reports (Phase 9).
### Alternatives
Post as `income`/`customer_payment` (wrong for profit); post as `loan_received`/`loan_repayment` (wrong meaning).
