# Design System

Direction: calm, natural, premium business tool. Deep green + sage with sparing gold and copper. Dense, ledger-like layouts; hairline borders; minimal shadow.
Reference: `docs/design-reference/colour-palette-07.png` (palette "07").

## Brand palette (fixed, see SESSION.md section 22A)

| Token | Hex | Role |
|---|---|---|
| `primary` | `#0C3B2E` | Primary buttons, headings, body ink, active nav text, focus ring |
| `primary-hover` | `#092E24` | Hover/pressed for primary |
| `sage` | `#6D9773` | Secondary fills, icons, progress, borders on dark surfaces |
| `copper` | `#BB8A52` | Decorative accents, category tags |
| `gold` | `#FFBA00` | Highlights, badges, warnings (always with Primary text) |

## Derived tokens

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#F3F5F2` | App background |
| `surface` | `#FFFFFF` | Cards, tables, drawers |
| `line` | `#DFE5DF` | Borders, dividers |
| `muted` | `#4F5F57` | Secondary text (6.8:1 on white) |
| `sage-soft` | `#E6EFE7` | Active nav item, selected row, subtle fills |
| `gold-soft` | `#FFF3CC` | Attention/warning background |
| `copper-soft` | `#F4E9DC` | Tag backgrounds |
| `danger` / `danger-soft` | `#B42318` / `#FDECEB` | Errors, destructive actions (semantic exception) |

## Contrast (measured)

| Pair | Ratio | Verdict |
|---|---|---|
| White on Primary | 12.5 | OK, all sizes |
| Primary on Gold | 7.3 | OK, all sizes |
| Primary on Sage-soft | 10.6 | OK |
| Muted on White | 6.8 | OK |
| White on Sage | 3.3 | Large text / UI shapes only |
| White on Copper | 3.1 | Large text / UI shapes only |

Rules: no small white text on Sage or Copper; Gold is never text on light backgrounds; one gold highlight per screen is plenty.

## Component colour recipes
- Primary button: `bg-primary text-white hover:bg-primary-hover`
- Secondary button: `bg-sage-soft text-primary hover:bg-sage/25` or outlined `border-line`
- Active nav: `bg-sage-soft text-primary font-medium`
- Status: Paid/Active = sage-soft + primary text; Due soon/Warning = gold-soft + primary text; Overdue/Error = danger-soft + danger text; Neutral = canvas + muted
- Focus ring: 2px `primary`, 2px offset
- Charts: Primary, Sage, Copper, Gold in that order; never rely on colour alone (add labels/patterns)

## Type
Inter with system fallback. Page title 20px/semibold; body 14px; helper text `muted`. (The reference uses a serif display face for brand moments; optional later, see TODO P2. Not adopted yet.)

## Layout and shape
Desktop >=1024px: 240px sidebar + content (max 1152px). Mobile: top bar + slide-over menu. Radii 6-8px for controls, 12px max for sheets/drawers. Minimal shadows.

## Components built
PageHeader, EmptyState, FullScreenMessage (+ `buttonPrimary`/`buttonSecondary` class strings), SignOutButton, AppShell, LoginPage, SummaryStrip, TransactionList (table at md+, cards below), TypeBadge (in = sage-soft, out = canvas, adjustment = gold-soft). Planned: DataTable, FormField, Button, Dialog, StatusBadge, Toast.

## Forms and dialogs
`FormField` (label above control, hint `text-xs muted`, error `text-xs danger` with `role="alert"`), `inputClass` (6px radius, `aria-[invalid=true]:border-danger`). `Dialog`: centered panel on desktop (max-w-lg), bottom sheet on mobile (rounded top 12px); Esc closes, Tab trapped, focus returns to the opener, background scroll locked. Primary action right-aligned, Cancel left of it, buttons name the action ("Save transaction").

## Rules
Visible focus ring, reduced motion respected, sentence-case copy, buttons name the action ("Save changes"). Phosphor icons, 18px in nav, `aria-hidden` beside text, `aria-label` on icon-only buttons. Never hardcode hex in components; use tokens.

## Tabs and status badges (Phase 4)
Tabs: `role=tablist` with `role=tab` buttons, bottom border 2px primary when selected, selected tab stored in the URL (`?tab=`). Rent status badge always carries text (Paid = sage-soft, Part paid = gold-soft, Unpaid = canvas, plus a separate danger-soft "Overdue" label). Occupied / Vacant / Inactive use the same `Pill`. Lists use table at md+ and cards below, like Transactions.

## Status pills with more tones (Phase 6)
`features/sheets/StatusPill` has four tones: good = sage-soft + primary text, warn = gold-soft + primary text (a rental still out), danger = danger-soft + danger text (Overdue), neutral = canvas + muted. The label is always text. Quantities in the Stock table are right-aligned tabular figures.

Gold loans reuse `MasterList` and the Sheets `StatusPill`: Active = good, Closed / Gold released = neutral, "Due in N days" = warn (gold-soft), "Overdue by N days" = danger. Status and due state are always text.

## Native controls (D-030, D-031)
Browser-drawn pieces that cannot take our theme are replaced by our own components in `components/forms/`:
- `Select` / `FormSelect` replace `<select>`. Same `<option>` children. Combobox + listbox: Arrow keys, Home / End, type-ahead, Enter / Space pick, Esc closes. The list opens in a portal (never clipped by a dialog), flips above the field when there is no room below. Chosen row = `sage-soft` + check mark; placeholder (`value=""`) is `muted`.
- `DatePicker` / `FormDatePicker` replace `<input type="date">`. Value stays a `'YYYY-MM-DD'` string (or `''`). Field shows `03 Oct 2026`. Calendar: day view, click the month name for months, then years; Today and Clear in the footer. Keys: arrows (day / week), PageUp / PageDown (month, Shift = year), Home / End (week), Esc closes. Today is IST (D-004).
- Use `FormSelect` / `FormDatePicker` with react-hook-form (`control`, not `register`); use `Select` / `DatePicker` with plain state or URL state. Put `inputClass` (forms) or the page's `field` class (filter bars) on them as before; the component adds the flex layout and chevron / calendar icon itself.

Still global CSS in `src/index.css`: `accent-color` primary (checkbox, radio, range), green search-clear (x), `sage-soft` autofill, text selection, thin sage scrollbars. Left native on purpose: the `title` tooltip on two truncated texts (browsers do not allow styling it).

Rules for new fields: never add a bare `<select>` or `type="date"` / `"month"` / `"time"` input; use the components above.

## Admin UX patterns (mobile-first pass)
Modelled on the trips.ulaa admin. One shared piece per pattern; do not hand-roll these in a page.
- `Dialog` + `DialogActions`: fixed header, body scrolls by itself, Save / Cancel stay pinned at the bottom (side by side on phones, right-aligned from md). Bottom sheet on phones sized with `dvh`, centred card from md. Put `<DialogActions>` as the last child of the form (it spans every grid column).
- `AppShell`: desktop sidebar collapses to an icon rail (remembered in localStorage); phone top bar shows the current section; safe-area padding for notches; room under the content for the floating add button.
- `ListToolbar` (+ `filterLabel`, `filterField`): search always visible; other filters behind a "Filters (n)" button on phones, inline from md; "n filters active / Clear all".
- `AddButton`: normal button from sm up, floating "+" on phones. One per screen.
- `Pagination`: "1-10 of 42" with Previous / Next, used by every list.
- `TabBar`: scrolls sideways on phones, selected tab scrolls into view, arrow-key support.
- `StatTile` / `statGrid`: two columns on phones (odd last tile spans), four on desktop.
- Lists: table from md, cards below; whole property card is tappable; loading shows skeleton rows.
- Inputs are 16px on phones (no iOS zoom) and 44px tall; buttons 44px tall on phones.
