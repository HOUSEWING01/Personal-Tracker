# Implementation Plan

0. Architecture and requirements — DONE
1. Foundation + design system + app shell — DONE
2. Database + Supabase + migrations + RLS + admin auth — DONE (live-verified by admin)
3. Financial engine — DONE
4. Property rental — DONE (code); live check pending
5. Transport: 5a vehicles/drivers/customers + vehicle investment in the ledger — DONE (code, unverified); 5b trips, 5c fuel/tolls 5d vehicle loans and 5e transport profit — DONE (code)
6. Sheet rental (dynamic variants, inventory, partial returns) — DONE (code, Session 9); live check pending
7. Gold loan (bank-pledged; central interest service) — DONE (code, Session 10); live check pending
8. Dashboard — DONE (code, Session 11); live check pending
9. Reports — DONE (code, Session 12); migration 0013 not yet run anywhere
10. UX / responsive / accessibility / performance audit — DONE by code review and build only (Session 12); no browser, axe or screen-reader pass

Formulas to document when built: revenue = distance × rate/km; trip operating profit = revenue − driver − fuel − toll; vehicle loan repaid so far = sum of payments (no outstanding: interest is not split, D-020); sheet outstanding = (base − discount) − paid; gold interest = principal × annual rate × days / 365.
