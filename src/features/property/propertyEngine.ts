import type { Paise } from '../../lib/money'
import type { PropertyOverview, RentCharge } from '../../types/property'

/**
 * Property formulas live ONLY here (SESSION.md: no duplicated financial calculations).
 *
 *   month outstanding   = expected - paid                       (never below 0; the DB rejects overpayment)
 *   property outstanding = sum(expected) - sum(paid)
 *   advance remaining    = received - adjusted - returned
 *   occupied             = a tenant exists and the tenancy has not ended (end date empty or >= today)
 */
export const outstanding = (expected: Paise, paid: Paise): Paise => Math.max(0, expected - paid)

export const advanceRemaining = (received: Paise, adjusted: Paise, returned: Paise): Paise => received - adjusted - returned

export type ChargeStatus = 'paid' | 'partial' | 'unpaid'

export function chargeStatus(c: Pick<RentCharge, 'expectedPaise' | 'paidPaise'>): ChargeStatus {
  if (outstanding(c.expectedPaise, c.paidPaise) === 0) return 'paid'
  return c.paidPaise > 0 ? 'partial' : 'unpaid'
}

/**
 * Rent runs in tenancy months counted from the joining day, paid in arrears (D-033). A charge's `period` is the day its
 * tenancy month STARTS (a tenant who joined on 3 Sep: 2026-09-03, 2026-10-03, ...), and its rent falls due on the day
 * the next month starts. Dates are 'YYYY-MM-DD' and handled in UTC so the browser's time zone never shifts a day.
 */
const parts = (d: string) => d.split('-').map(Number) as [number, number, number]
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

/** Same day next month, or the last day of that month when it has no such day (31 Jan -> 28 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date)
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  return iso(Date.UTC(y, m - 1 + months, Math.min(d, last)))
}
/** The day this tenancy month's rent falls due: the day the next tenancy month starts. */
export const dueDate = (period: string): string => addMonths(period, 1)
/** The last day of the tenancy month. */
export function cycleEnd(period: string): string {
  const [y, m, d] = parts(dueDate(period))
  return iso(Date.UTC(y, m - 1, d - 1))
}

/** Overdue = the due date has passed and the month is not fully paid. On the due date itself rent is due, not overdue. */
export function isOverdue(c: Pick<RentCharge, 'period' | 'expectedPaise' | 'paidPaise'>, today: string): boolean {
  return dueDate(c.period) < today && outstanding(c.expectedPaise, c.paidPaise) > 0
}

export function isOccupied(p: Pick<PropertyOverview, 'tenantName' | 'rentalEndDate'>, today: string): boolean {
  return p.tenantName !== null && (p.rentalEndDate === null || p.rentalEndDate >= today)
}

export function propertyTotals(p: PropertyOverview) {
  return {
    outstandingPaise: outstanding(p.expectedTotalPaise, p.paidTotalPaise),
    advanceRemainingPaise: advanceRemaining(p.advanceReceivedPaise, p.advanceAdjustedPaise, p.advanceReturnedPaise),
  }
}

const dm = (d: string, year: boolean) => {
  const [y, m, day] = parts(d)
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, day)))
}
/** "2026-09-03" -> "3 Sep – 2 Oct 2026" (the year appears on both ends when the month crosses a year). */
export function formatCycle(period: string): string {
  const end = cycleEnd(period)
  const sameYear = period.slice(0, 4) === end.slice(0, 4)
  return `${dm(period, !sameYear)} – ${dm(end, true)}`
}
