import type { Paise } from '../lib/money'

export const VEHICLE_STATUSES = ['active', 'inactive', 'sold'] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]
export type DriverStatus = 'active' | 'inactive'

export interface Vehicle {
  id: string
  name: string
  registrationNumber: string
  purchasePricePaise: Paise
  purchaseDate: string
  containerPricePaise: Paise
  containerDetails: string | null
  status: VehicleStatus
  notes: string | null
}

export interface Driver {
  id: string
  name: string
  mobile: string | null
  address: string | null
  status: DriverStatus
  notes: string | null
}

/** Row of the shared `customers` table (reused by every module, D-017). */
export interface Customer {
  id: string
  name: string
  mobile: string | null
  address: string | null
  notes: string | null
}

export const TRIP_STATUSES = ['planned', 'completed', 'cancelled'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

/** A trip with the names of its vehicle, driver and customer for display. Revenue is derived, never stored. */
export interface Trip {
  id: string
  vehicleId: string
  vehicleName: string
  vehicleRegistration: string
  driverId: string
  driverName: string
  customerId: string
  customerName: string
  fromLocation: string
  toLocation: string
  distanceKm: number
  /** Odometer readings; distance = end - start. Old trips have none. The end reading is added when the trip reaches its destination. */
  odometerStartKm: number | null
  odometerEndKm: number | null
  ratePerKmPaise: Paise
  driverPaymentPaise: Paise
  /** Fuel linked to this trip and tolls on this trip (raw sums from `trip_cost_totals`). */
  fuelPaise: Paise
  tollPaise: Paise
  tripDate: string
  status: TripStatus
  notes: string | null
}

/** Fuel is recorded at vehicle level; the trip link is optional. Total is litres x price, derived by the database. */
export interface FuelLog {
  id: string
  vehicleId: string
  vehicleName: string
  vehicleRegistration: string
  tripId: string | null
  tripLabel: string | null
  fuelDate: string
  litres: number
  pricePerLitrePaise: Paise
  totalPaise: Paise
  odometerKm: number | null
  notes: string | null
}

/** A toll always belongs to a trip; its vehicle is the trip's vehicle. */
export interface Toll {
  id: string
  tripId: string
  tripLabel: string
  vehicleId: string
  vehicleName: string
  vehicleRegistration: string
  tollDate: string
  amountPaise: Paise
  location: string | null
  notes: string | null
}

/** Compact trip for the fuel and toll pickers. */
export interface TripChoice { id: string; vehicleId: string; label: string }

export const LOAN_STATUSES = ['active', 'closed'] as const
export type LoanStatus = (typeof LOAN_STATUSES)[number]

/**
 * A vehicle loan (D-020). `principalPaise` is the amount received. The interest rate is kept for reference only:
 * nothing is calculated from it, and no "outstanding" is derived because interest is not split from repayments (D-009).
 * `paidPaise` / `paymentCount` / `lastPaymentDate` are raw sums from the view `loan_payment_totals`.
 */
export interface VehicleLoan {
  id: string
  vehicleId: string | null
  vehicleName: string | null
  vehicleRegistration: string | null
  lender: string
  principalPaise: Paise
  startDate: string
  /** Percent per year, e.g. 9.5. Reference only. */
  interestRate: number
  emiPaise: Paise
  tenureMonths: number | null
  status: LoanStatus
  notes: string | null
  paidPaise: Paise
  paymentCount: number
  lastPaymentDate: string | null
}

/** One repayment: the full amount paid, interest included (D-009). */
export interface LoanPayment {
  id: string
  loanId: string
  paymentDate: string
  amountPaise: Paise
  notes: string | null
}

/** Raw cash-basis sums for one vehicle in a period (from `vehicle_profit_totals`). `vehicleId` null = loans not linked to a vehicle. */
export interface VehicleProfitTotals {
  vehicleId: string | null
  vehicleName: string
  vehicleRegistration: string | null
  revenuePaise: Paise
  driverPaise: Paise
  fuelPaise: Paise
  tollPaise: Paise
  loanRepaidPaise: Paise
}
