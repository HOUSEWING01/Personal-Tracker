import type { Paise } from '../lib/money'

export const PROPERTY_TYPES = ['shop', 'godown', 'house', 'land', 'other'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]
export type PropertyStatus = 'active' | 'inactive'
export type AdvanceKind = 'received' | 'adjusted' | 'returned'

/** One row of the property_overview view. Sums are raw; derived values come from propertyEngine. */
export interface PropertyOverview {
  id: string
  name: string
  type: PropertyType
  address: string | null
  description: string | null
  status: PropertyStatus
  monthlyRentPaise: Paise
  tenantName: string | null
  rentalStartDate: string | null
  rentalEndDate: string | null
  expectedTotalPaise: Paise
  paidTotalPaise: Paise
  advanceReceivedPaise: Paise
  advanceAdjustedPaise: Paise
  advanceReturnedPaise: Paise
}

export interface Tenant {
  id: string
  propertyId: string
  name: string
  mobile: string | null
  address: string | null
  notes: string | null
  rentalStartDate: string
  rentalEndDate: string | null
}

/** A month's rent: `period` is the first day of the month (YYYY-MM-01). */
export interface RentCharge {
  id: string
  propertyId: string
  period: string
  expectedPaise: Paise
  paidPaise: Paise
  lastPaymentDate: string | null
}

export interface RentPayment {
  id: string
  propertyId: string
  period: string
  amountPaise: Paise
  paymentDate: string
  paymentMethod: string | null
  notes: string | null
}

export interface AdvanceMovement {
  id: string
  propertyId: string
  kind: AdvanceKind
  amountPaise: Paise
  date: string
  notes: string | null
}
