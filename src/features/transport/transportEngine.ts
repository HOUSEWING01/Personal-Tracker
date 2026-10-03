import type { Paise } from '../../lib/money'
import { daysBetween } from '../../services/goldInterest'
import type { Vehicle, VehicleProfitTotals } from '../../types/transport'

/**
 * Total investment = purchase price + container price (D-016). Derived, never stored.
 * Later phases add further investment parts here so every screen keeps agreeing.
 */
export function vehicleTotalInvestmentPaise(v: Pick<Vehicle, 'purchasePricePaise' | 'containerPricePaise'>): Paise {
  return v.purchasePricePaise + v.containerPricePaise
}

/** Trimmed, upper-case, single spaces. The database also ignores spaces/hyphens when checking duplicates. */
export function normalizeRegistration(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ')
}

/** Quantity (at most 2 decimals) x rate in paise, rounded half-up to whole paise; same as the database's round(q * r, 2). */
function quantityTimesRatePaise(quantity: number, ratePaise: Paise): Paise {
  const hundredths = Math.round(quantity * 100)
  return Math.floor((hundredths * ratePaise + 50) / 100)
}

/** Trip revenue = distance (KM) x rate per KM (D-018). */
export function tripRevenuePaise(t: { distanceKm: number; ratePerKmPaise: Paise }): Paise {
  return quantityTimesRatePaise(t.distanceKm, t.ratePerKmPaise)
}

/** Fuel total = litres x price per litre (D-019). The database column `fuel_logs.total` is the same formula. */
export function fuelTotalPaise(f: { litres: number; pricePerLitrePaise: Paise }): Paise {
  return quantityTimesRatePaise(f.litres, f.pricePerLitrePaise)
}

/** Revenue minus driver payment, before fuel and toll. */
export function tripMarginAfterDriverPaise(t: { distanceKm: number; ratePerKmPaise: Paise; driverPaymentPaise: Paise }): Paise {
  return tripRevenuePaise(t) - t.driverPaymentPaise
}

/**
 * Trip operating profit = revenue - driver payment - fuel linked to the trip - tolls of the trip
 * (SESSION.md section 12). Loan repayments are NOT part of it; vehicle-level profit comes in Phase 5e.
 */
export function tripOperatingProfitPaise(t: {
  distanceKm: number; ratePerKmPaise: Paise; driverPaymentPaise: Paise; fuelPaise: Paise; tollPaise: Paise
}): Paise {
  return tripMarginAfterDriverPaise(t) - t.fuelPaise - t.tollPaise
}

/**
 * End date of a loan = start date + tenure months, same day of the month (clamped to the month's last day,
 * so 31 Jan + 1 month = 28 Feb, or 29 Feb in a leap year). Returns null when no tenure is set.
 * Reference only: nothing else is calculated from it (D-020).
 */
export function loanEndDate(startDate: string, tenureMonths: number | null): string | null {
  if (tenureMonths === null || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null
  const [y, m, d] = startDate.split('-').map(Number)
  const index = (m - 1) + tenureMonths
  const year = y + Math.floor(index / 12)
  const month = index % 12 // 0-based
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

type ProfitParts = Pick<VehicleProfitTotals, 'revenuePaise' | 'driverPaise' | 'fuelPaise' | 'tollPaise' | 'maintenancePaise'>

/**
 * Vehicle operating profit = revenue - driver payments - fuel - tolls - maintenance (all cash-basis, from the ledger).
 * Loan repayments are NOT part of it (D-021). Fuel here is ALL fuel for the vehicle, including fuel not linked to a trip.
 * Maintenance is a vehicle-level cost: it is not part of any single trip's profit.
 */
export function vehicleOperatingProfitPaise(t: ProfitParts): Paise {
  return t.revenuePaise - t.driverPaise - t.fuelPaise - t.tollPaise - t.maintenancePaise
}

/**
 * Cash left after loan repayments = operating profit - loan repayments (D-021). Repayments include the principal part
 * (interest is not split, D-009), so this is a cash view, not an accounting profit.
 */
export function vehicleAfterFinancingPaise(t: ProfitParts & Pick<VehicleProfitTotals, 'loanRepaidPaise'>): Paise {
  return vehicleOperatingProfitPaise(t) - t.loanRepaidPaise
}

/** Sum of several vehicles' totals, for the "All vehicles" row. */
export function sumProfitTotals(rows: VehicleProfitTotals[]): ProfitParts & Pick<VehicleProfitTotals, 'loanRepaidPaise'> {
  return rows.reduce((a, r) => ({
    revenuePaise: a.revenuePaise + r.revenuePaise, driverPaise: a.driverPaise + r.driverPaise, fuelPaise: a.fuelPaise + r.fuelPaise,
    tollPaise: a.tollPaise + r.tollPaise, maintenancePaise: a.maintenancePaise + r.maintenancePaise, loanRepaidPaise: a.loanRepaidPaise + r.loanRepaidPaise,
  }), { revenuePaise: 0, driverPaise: 0, fuelPaise: 0, tollPaise: 0, maintenancePaise: 0, loanRepaidPaise: 0 })
}

/** A maintenance item counts as "due soon" this many days before its due date. */
export const MAINTENANCE_DUE_SOON_DAYS = 30

export type MaintenanceDueState = { kind: 'overdue' | 'soon'; days: number } | null

/** Overdue = due date before today; soon = within MAINTENANCE_DUE_SOON_DAYS (today counts as soon). Null = nothing to flag. */
export function maintenanceDueState(nextDueDate: string | null, today: string): MaintenanceDueState {
  if (!nextDueDate) return null
  const d = daysBetween(today, nextDueDate)
  if (d < 0) return { kind: 'overdue', days: -d }
  if (d <= MAINTENANCE_DUE_SOON_DAYS) return { kind: 'soon', days: d }
  return null
}

export function maintenanceDueLabel(s: NonNullable<MaintenanceDueState>): string {
  if (s.kind === 'overdue') return `Overdue by ${s.days} ${s.days === 1 ? 'day' : 'days'}`
  return s.days === 0 ? 'Due today' : `Due in ${s.days} ${s.days === 1 ? 'day' : 'days'}`
}

/**
 * Yearly interest rate (%) that makes `emiPaise` x `months` repay `principalPaise` (reducing-balance EMI formula).
 * Returns null when it cannot be worked out, 0 when the instalments add up to no more than the amount borrowed.
 */
export function loanInterestRate(principalPaise: number, emiPaise: number, months: number): number | null {
  if (!(principalPaise > 0) || !(emiPaise > 0) || !Number.isInteger(months) || months <= 0) return null
  if (emiPaise * months <= principalPaise) return 0
  const emiAt = (r: number) => (r === 0 ? principalPaise / months : (principalPaise * r * (1 + r) ** months) / ((1 + r) ** months - 1))
  let lo = 0, hi = 1
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (emiAt(mid) < emiPaise) lo = mid; else hi = mid
  }
  const yearly = ((lo + hi) / 2) * 12 * 100
  return Math.round(yearly * 100) / 100
}

/** Monthly instalment (paise) that repays `principalPaise` over `months` at `yearlyRate` % (reducing-balance EMI formula). */
export function loanEmi(principalPaise: number, yearlyRate: number, months: number): number | null {
  if (!(principalPaise > 0) || !Number.isInteger(months) || months <= 0 || !(yearlyRate >= 0)) return null
  const r = yearlyRate / 12 / 100
  if (r === 0) return Math.round(principalPaise / months)
  const f = (1 + r) ** months
  return Math.round((principalPaise * r * f) / (f - 1))
}

/**
 * Whole months needed to repay `principalPaise` with `emiPaise` a month at `yearlyRate` %, rounded up.
 * Null when the instalment does not even cover the interest, or the answer is outside 1 to 600 months.
 */
export function loanTenureMonths(principalPaise: number, yearlyRate: number, emiPaise: number): number | null {
  if (!(principalPaise > 0) || !(emiPaise > 0) || !(yearlyRate >= 0)) return null
  const r = yearlyRate / 12 / 100
  const exact = r === 0 ? principalPaise / emiPaise : -Math.log(1 - (principalPaise * r) / emiPaise) / Math.log(1 + r)
  if (!Number.isFinite(exact) || exact <= 0) return null
  const months = Math.ceil(exact - 0.01)
  return months >= 1 && months <= 600 ? months : null
}
