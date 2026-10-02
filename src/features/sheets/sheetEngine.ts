import type { Paise } from '../../lib/money'
import type { SheetRental } from '../../types/sheets'

/** Display name of a variant: "8 ft", "10.5 ft". Sizes are admin-created, never hardcoded. */
export function variantLabel(lengthFt: number): string {
  return `${Number(lengthFt)} ft`
}

/** Net rental amount = rent - discount (SESSION.md section 13). */
export function netRentPaise(r: { rentPaise: Paise; discountPaise: Paise }): Paise {
  return r.rentPaise - r.discountPaise
}

/** Outstanding = net rental amount - paid. The database rejects overpayment, so this is never negative. */
export function rentalOutstandingPaise(r: { rentPaise: Paise; discountPaise: Paise; paidPaise: Paise }): Paise {
  return netRentPaise(r) - r.paidPaise
}

/** Sheets of a rental not yet accounted for (returned, damaged or missing). */
export function stillOutQuantity(r: Pick<SheetRental, 'quantity' | 'returnedQuantity' | 'damagedQuantity' | 'missingQuantity'>): number {
  return r.quantity - r.returnedQuantity - r.damagedQuantity - r.missingQuantity
}

/** Available stock = total - rented - damaged - missing. The database view computes the same figure. */
export function availableQuantity(s: { totalQuantity: number; rentedQuantity: number; damagedQuantity: number; missingQuantity: number }): number {
  return s.totalQuantity - s.rentedQuantity - s.damagedQuantity - s.missingQuantity
}

/** Overdue = still active, has sheets out, and the expected return date is before today (IST business date). */
export function isRentalOverdue(r: Pick<SheetRental, 'status' | 'expectedReturnDate' | 'quantity' | 'returnedQuantity' | 'damagedQuantity' | 'missingQuantity'>, today: string): boolean {
  return r.status === 'active' && r.expectedReturnDate !== null && r.expectedReturnDate < today && stillOutQuantity(r) > 0
}

/** The actual return date is the date of the last return, once every sheet is accounted for. */
export function actualReturnDate(r: Pick<SheetRental, 'status' | 'lastReturnDate'>): string | null {
  return r.status === 'closed' ? r.lastReturnDate : null
}
