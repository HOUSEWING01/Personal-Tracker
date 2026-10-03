import type { Paise } from '../../lib/money'
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

/**
 * Vehicle operating profit = revenue - driver payments - fuel - tolls (all cash-basis, from the ledger).
 * Loan repayments are NOT part of it (D-021). Fuel here is ALL fuel for the vehicle, including fuel not linked to a trip.
 */
export function vehicleOperatingProfitPaise(t: Pick<VehicleProfitTotals, 'revenuePaise' | 'driverPaise' | 'fuelPaise' | 'tollPaise'>): Paise {
  return t.revenuePaise - t.driverPaise - t.fuelPaise - t.tollPaise
}

/**
 * Cash left after loan repayments = operating profit - loan repayments (D-021). Repayments include the principal part
 * (interest is not split, D-009), so this is a cash view, not an accounting profit.
 */
export function vehicleAfterFinancingPaise(t: Pick<VehicleProfitTotals, 'revenuePaise' | 'driverPaise' | 'fuelPaise' | 'tollPaise' | 'loanRepaidPaise'>): Paise {
  return vehicleOperatingProfitPaise(t) - t.loanRepaidPaise
}

/** Sum of several vehicles' totals, for the "All vehicles" row. */
export function sumProfitTotals(rows: VehicleProfitTotals[]): Pick<VehicleProfitTotals, 'revenuePaise' | 'driverPaise' | 'fuelPaise' | 'tollPaise' | 'loanRepaidPaise'> {
  return rows.reduce((a, r) => ({
    revenuePaise: a.revenuePaise + r.revenuePaise, driverPaise: a.driverPaise + r.driverPaise, fuelPaise: a.fuelPaise + r.fuelPaise,
    tollPaise: a.tollPaise + r.tollPaise, loanRepaidPaise: a.loanRepaidPaise + r.loanRepaidPaise,
  }), { revenuePaise: 0, driverPaise: 0, fuelPaise: 0, tollPaise: 0, loanRepaidPaise: 0 })
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
