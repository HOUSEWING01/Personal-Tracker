import type { Paise } from '../lib/money'

export type SheetProductStatus = 'active' | 'inactive'
export type SheetVariantStatus = 'active' | 'inactive'

export interface SheetProduct {
  id: string
  name: string
  status: SheetProductStatus
  notes: string | null
}

/** A size in feet of a product, with its derived stock (D-022). `availableQuantity` = total - rented - damaged - missing. */
export interface SheetVariant {
  id: string
  productId: string
  productName: string
  lengthFt: number
  totalQuantity: number
  rentedQuantity: number
  damagedQuantity: number
  missingQuantity: number
  availableQuantity: number
  status: SheetVariantStatus
  notes: string | null
}

export const RENTAL_STATUSES = ['active', 'closed', 'cancelled'] as const
export type RentalStatus = (typeof RENTAL_STATUSES)[number]

/**
 * One rental = one customer, one variant, one quantity. Rent and discount are typed by the admin.
 * `returnedQuantity` / `damagedQuantity` / `missingQuantity` / `paidPaise` are raw sums from `sheet_rental_totals`.
 */
export interface SheetRental {
  id: string
  customerId: string
  customerName: string
  customerMobile: string | null
  variantId: string
  productName: string
  lengthFt: number
  quantity: number
  rentalDate: string
  expectedReturnDate: string | null
  rentPaise: Paise
  discountPaise: Paise
  status: RentalStatus
  notes: string | null
  returnedQuantity: number
  damagedQuantity: number
  missingQuantity: number
  lastReturnDate: string | null
  paidPaise: Paise
  paymentCount: number
}

export interface SheetPayment {
  id: string
  rentalId: string
  paymentDate: string
  amountPaise: Paise
  paymentMethod: string | null
  notes: string | null
}

export interface SheetReturn {
  id: string
  rentalId: string
  returnDate: string
  returnedQuantity: number
  damagedQuantity: number
  missingQuantity: number
  notes: string | null
}

/** Compact customer for the rental picker (the shared `customers` table, D-017). */
export interface CustomerChoice { id: string; name: string; mobile: string | null }
