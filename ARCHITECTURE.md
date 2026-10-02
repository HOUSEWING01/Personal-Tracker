# Architecture

Admin-only SPA. Layering (strict): Component → Hook → Service → Supabase → PostgreSQL. No Supabase calls in components.

```
src/
  app/            router
  components/     ui/ layout/ (data-display/ forms/ added when needed)
  features/       one folder per module (added from Phase 4)
  hooks/          useUrlState
  lib/            navigation, money (supabase client from Phase 2)
  pages/          route-level screens (placeholders until each module's phase)
  services/ types/ utils/   created when first used
supabase/migrations/        SQL migrations (Phase 2+)
```

Rules: all financial calculations live in one place (Phase 3 financial engine); gold-loan interest lives in its own service; list state in URL params; service-role key never in frontend.

Stack: React, TypeScript, Vite, Tailwind v4, Phosphor Icons, React Router, Supabase, Vercel.

## Auth (Phase 2)
`AuthProvider` (features/auth) holds session + admin status (`loading | config-missing | signed-out | forbidden | admin | error`). `RequireAdmin` guards all app routes; `/login` is public. All Supabase calls go through `services/authService.ts`. Never call Supabase inside `onAuthStateChange` callbacks (set state, react in an effect).

## Financial formulas (Phase 3, cash-basis, integer paise)
All formulas live ONLY in `src/features/finance/financeEngine.ts`. The database returns per-type totals (`transaction_totals()`), the engine applies the formulas. Screens never compute money themselves.

```
revenue     = income + customer_payment - refund
expenses    = expense
netProfit   = revenue - expenses        (operating; excludes investment, loan principal, adjustments)
cashIn      = income + customer_payment + loan_received
cashOut     = expense + investment + loan_repayment + refund
netCashFlow = cashIn - cashOut + adjustments   (adjustment = signed cash correction)
```
Outstanding receivables (rent, sheet rentals) are NOT derived from transactions; they come from each module's expected-vs-paid records (Phases 4-6). Trip/vehicle/gold formulas are added with their modules.

## Forms (Phase 3b)
Schema + helpers in `features/<area>/<thing>Form.ts` (pure, unit-tested) -> dialog/page component using `useForm(zodResolver(schema))` -> mutation hook (`useMutation`, invalidates affected query keys) -> service. Double-submit guarded by `isPending`; errors shown in-form with a retryable message; success shown via a polite live region.

## Data access (Phase 3)
TanStack Query hooks (`features/finance/hooks.ts`) -> `services/transactionService.ts` -> Supabase. List state (type, module, from, to, q, sort, page) lives in URL params via `useUrlState`. Lists are paginated server-side (25/page); totals are computed in Postgres, never by loading all rows.

## Property rental formulas (Phase 4, `features/property/propertyEngine.ts`)
```
month outstanding    = expected - paid                 (>= 0; the database rejects overpayment)
property outstanding = sum(expected) - sum(paid)
advance remaining    = received - adjusted - returned
occupied             = tenant exists and (end date empty or >= today IST)
overdue month        = month already ended and outstanding > 0
```
Rent payments post to the ledger as `customer_payment` (module `property`), so they count as revenue (D-009). Rent is cash-basis revenue; outstanding rent is tracked in `rent_charges` vs `rent_payments`, not derived from transactions.

Monthly charges are created lazily by `ensure_rent_charges`, called when the property list or a property's Rent tab loads (idempotent). Screens wait for it before reading rent figures.

Property screens: `PropertyListPage` (URL state: q, status, page) -> `PropertyDetailPage` (URL state: tab = rent | advance | tenant; back link restores the list's filters). Hooks in `features/property/hooks.ts`, service in `services/propertyService.ts`.
