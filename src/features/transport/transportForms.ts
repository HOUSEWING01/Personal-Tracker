import { z } from 'zod'
import { isValidISODate } from '../../lib/dates'
import { LOAN_STATUSES, TRIP_STATUSES, VEHICLE_STATUSES } from '../../types/transport'
import { parseMoney } from '../property/propertyForms'
import { fuelTotalPaise, normalizeRegistration } from './transportEngine'

const text = (max: number, msg: string) => z.string().trim().max(max, msg)
const mobile = z.string().trim().refine((s) => s === '' || /^[0-9]{10}$/.test(s), 'Enter a 10-digit mobile number.')

/** Blank means zero. Negative amounts are rejected (the database rejects them too). */
const optionalPrice = z.string().trim().refine((s) => {
  if (s === '') return true
  const p = parseMoney(s)
  return p !== null && p >= 0
}, 'Enter a valid amount with up to 2 decimals.')

/** Call only with values that passed the schemas. */
const paiseOrZero = (s: string): number => (s.trim() === '' ? 0 : (parseMoney(s) ?? 0))

// ---------- vehicle ----------
export const vehicleFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a vehicle name.').max(100, 'Keep the name under 100 characters.'),
  registrationNumber: z.string().trim()
    .min(1, 'Enter the registration number.')
    .refine((s) => s === '' || /^[A-Za-z0-9][A-Za-z0-9 -]{3,19}$/.test(s), 'Use letters, numbers, spaces or hyphens (4 to 20 characters).'),
  purchasePrice: optionalPrice,
  purchaseDate: z.string().refine(isValidISODate, 'Enter the purchase date.'),
  containerPrice: optionalPrice,
  containerDetails: text(300, 'Keep the container details under 300 characters.'),
  status: z.enum(VEHICLE_STATUSES),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type VehicleFormValues = z.infer<typeof vehicleFormSchema>
export const defaultVehicleValues = (): VehicleFormValues => ({
  name: '', registrationNumber: '', purchasePrice: '', purchaseDate: '', containerPrice: '',
  containerDetails: '', status: 'active', notes: '',
})
export function toVehicleInput(v: VehicleFormValues) {
  return {
    name: v.name.trim(),
    registrationNumber: normalizeRegistration(v.registrationNumber),
    purchasePricePaise: paiseOrZero(v.purchasePrice),
    purchaseDate: v.purchaseDate,
    containerPricePaise: paiseOrZero(v.containerPrice),
    containerDetails: v.containerDetails.trim() || null,
    status: v.status,
    notes: v.notes.trim() || null,
  }
}

// ---------- trip ----------
const MAX_KM_HUNDREDTHS = 10_000_000 // 100,000.00 km, well inside numeric(10,2)

/** Distance in whole hundredths of a KM ("12.5" -> 1250), or null if not a number with at most 2 decimals. */
export function parseKmHundredths(s: string): number | null {
  const t = s.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const [whole, frac = ''] = t.split('.')
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(n) ? n : null
}

const MAX_ODOMETER_HUNDREDTHS = 999_999_999 // 9,999,999.99 km (matches numeric(12,2))

/** Distance in hundredths of a km: ending - starting odometer, or the typed distance for old trips without readings. */
export function tripDistanceHundredths(start: string, end: string, manual: string): number {
  const s = parseKmHundredths(start), e = parseKmHundredths(end)
  if (s !== null && e !== null && e > s) return e - s
  return parseKmHundredths(manual) ?? 0
}

export const tripFormSchema = z.object({
  vehicleId: z.string().min(1, 'Choose a vehicle.'),
  driverId: z.string().min(1, 'Choose a driver.'),
  customerId: z.string().min(1, 'Choose a customer.'),
  fromLocation: z.string().trim().min(1, 'Enter where the trip starts.').max(100, 'Keep this under 100 characters.'),
  toLocation: z.string().trim().min(1, 'Enter where the trip ends.').max(100, 'Keep this under 100 characters.'),
  odometerStart: z.string().trim(),
  odometerEnd: z.string().trim(),
  /** Typed only for old trips that have no odometer readings; otherwise worked out from the odometer. */
  distanceKm: z.string().trim(),
  ratePerKm: z.string().trim().min(1, 'Enter the rate per KM.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Rate must be greater than zero.'),
  driverPayment: optionalPrice,
  /** Fuel and toll are entered in the trip itself. Blank = none. */
  fuelLitres: z.string().trim(),
  fuelPrice: z.string().trim(),
  tollAmount: z.string().trim(),
  tripDate: z.string().refine(isValidISODate, 'Enter the trip date.'),
  status: z.enum(TRIP_STATUSES),
  notes: text(500, 'Keep the notes under 500 characters.'),
}).superRefine((v, ctx) => {
  const add = (path: 'odometerStart' | 'odometerEnd' | 'distanceKm', message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
  const s = parseKmHundredths(v.odometerStart), e = parseKmHundredths(v.odometerEnd)
  const badReading = 'Enter a valid reading with up to 2 decimals.'
  if (v.odometerStart && (s === null || s > MAX_ODOMETER_HUNDREDTHS)) add('odometerStart', badReading)
  if (v.odometerEnd && (e === null || e > MAX_ODOMETER_HUNDREDTHS)) add('odometerEnd', badReading)
  if (v.odometerEnd && !v.odometerStart) add('odometerStart', 'Enter the starting odometer first.')
  if (s !== null && e !== null && e <= s) add('odometerEnd', 'Ending reading must be more than the starting reading.')
  if (v.distanceKm) {
    const d = parseKmHundredths(v.distanceKm)
    if (d === null) add('distanceKm', 'Enter a valid distance with up to 2 decimals.')
    else if (d <= 0) add('distanceKm', 'Distance must be greater than zero.')
    else if (d > MAX_KM_HUNDREDTHS) add('distanceKm', 'Distance is too large.')
  }
  if (!v.odometerStart && !v.distanceKm) add('odometerStart', 'Enter the starting odometer.')
  const addCost = (path: 'fuelLitres' | 'fuelPrice' | 'tollAmount', message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
  const l = parseKmHundredths(v.fuelLitres), p = parseMoney(v.fuelPrice)
  if (v.fuelLitres && (l === null || l <= 0 || l > MAX_LITRES_HUNDREDTHS)) addCost('fuelLitres', 'Enter litres above zero, with up to 2 decimals.')
  if (v.fuelPrice && (p === null || p <= 0 || p > MAX_PRICE_PAISE)) addCost('fuelPrice', 'Enter the price per litre above zero.')
  if (v.fuelLitres && !v.fuelPrice) addCost('fuelPrice', 'Enter the price per litre.')
  if (v.fuelPrice && !v.fuelLitres) addCost('fuelLitres', 'Enter the litres.')
  if (l !== null && l > 0 && p !== null && p > 0 && fuelTotalPaise({ litres: l / 100, pricePerLitrePaise: p }) <= 0) addCost('fuelLitres', 'The fuel total must be at least ₹0.01.')
  if (v.tollAmount) {
    const t = parseMoney(v.tollAmount)
    if (t === null || t < 0) addCost('tollAmount', 'Enter a valid amount with up to 2 decimals.')
  }
  if (v.status === 'completed' && tripDistanceHundredths(v.odometerStart, v.odometerEnd, v.distanceKm) <= 0 && !(v.odometerEnd && e === null)) {
    add('odometerEnd', 'Enter the ending odometer to complete the trip.')
  }
})
export type TripFormValues = z.infer<typeof tripFormSchema>
export const defaultTripValues = (todayISO = ''): TripFormValues => ({
  vehicleId: '', driverId: '', customerId: '', fromLocation: '', toLocation: '', odometerStart: '', odometerEnd: '', distanceKm: '',
  ratePerKm: '', driverPayment: '', fuelLitres: '', fuelPrice: '', tollAmount: '', tripDate: todayISO, status: 'planned', notes: '',
})
export function toTripInput(v: TripFormValues) {
  const s = parseKmHundredths(v.odometerStart), e = parseKmHundredths(v.odometerEnd)
  return {
    vehicleId: v.vehicleId, driverId: v.driverId, customerId: v.customerId,
    fromLocation: v.fromLocation.trim(), toLocation: v.toLocation.trim(),
    distanceKm: tripDistanceHundredths(v.odometerStart, v.odometerEnd, v.distanceKm) / 100,
    odometerStartKm: s === null ? null : s / 100,
    odometerEndKm: e === null ? null : e / 100,
    ratePerKmPaise: parseMoney(v.ratePerKm) ?? 0,
    driverPaymentPaise: paiseOrZero(v.driverPayment),
    // 0 = no fuel / no toll (removes an existing one). The dialog sets these to null for old trips with several entries.
    fuelLitres: (parseKmHundredths(v.fuelLitres) ?? 0) / 100 as number | null,
    fuelPricePaise: paiseOrZero(v.fuelPrice) as number | null,
    tollPaise: paiseOrZero(v.tollAmount) as number | null,
    tripDate: v.tripDate, status: v.status, notes: v.notes.trim() || null,
  }
}

// ---------- fuel ----------
const MAX_LITRES_HUNDREDTHS = 10_000_000 // 100,000.00 litres (matches the database check)
const MAX_PRICE_PAISE = 1_000_000 // 10,000.00 per litre (matches the database check)

export const fuelFormSchema = z.object({
  vehicleId: z.string().min(1, 'Choose a vehicle.'),
  tripId: z.string(), // blank = not linked to a trip
  fuelDate: z.string().refine(isValidISODate, 'Enter the fuel date.'),
  litres: z.string().trim().min(1, 'Enter the litres.')
    .refine((s) => parseKmHundredths(s) !== null, 'Enter a valid number of litres with up to 2 decimals.')
    .refine((s) => { const n = parseKmHundredths(s); return n === null || n > 0 }, 'Litres must be greater than zero.')
    .refine((s) => { const n = parseKmHundredths(s); return n === null || n <= MAX_LITRES_HUNDREDTHS }, 'Litres is too large.'),
  pricePerLitre: z.string().trim().min(1, 'Enter the price per litre.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Price must be greater than zero.')
    .refine((s) => (parseMoney(s) ?? 0) <= MAX_PRICE_PAISE, 'Price per litre is too large.'),
  odometerKm: z.string().trim().refine((s) => s === '' || /^\d{1,9}$/.test(s), 'Enter whole kilometres, or leave blank.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
}).superRefine((v, ctx) => {
  const l = parseKmHundredths(v.litres)
  const p = parseMoney(v.pricePerLitre)
  if (l !== null && l > 0 && p !== null && p > 0 && fuelTotalPaise({ litres: l / 100, pricePerLitrePaise: p }) <= 0)
    ctx.addIssue({ code: 'custom', path: ['litres'], message: 'The total must be at least ₹0.01.' })
})
export type FuelFormValues = z.infer<typeof fuelFormSchema>
export const defaultFuelValues = (todayISO = ''): FuelFormValues => ({
  vehicleId: '', tripId: '', fuelDate: todayISO, litres: '', pricePerLitre: '', odometerKm: '', notes: '',
})
export function toFuelInput(v: FuelFormValues) {
  return {
    vehicleId: v.vehicleId, tripId: v.tripId || null, fuelDate: v.fuelDate,
    litres: (parseKmHundredths(v.litres) ?? 0) / 100, pricePerLitrePaise: parseMoney(v.pricePerLitre) ?? 0,
    odometerKm: v.odometerKm.trim() === '' ? null : Number(v.odometerKm), notes: v.notes.trim() || null,
  }
}

// ---------- toll ----------
export const tollFormSchema = z.object({
  tripId: z.string().min(1, 'Choose the trip this toll was paid on.'),
  tollDate: z.string().refine(isValidISODate, 'Enter the toll date.'),
  amount: z.string().trim().min(1, 'Enter the toll amount.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Amount must be greater than zero.'),
  location: text(100, 'Keep the location under 100 characters.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type TollFormValues = z.infer<typeof tollFormSchema>
export const defaultTollValues = (todayISO = ''): TollFormValues => ({ tripId: '', tollDate: todayISO, amount: '', location: '', notes: '' })
export function toTollInput(v: TollFormValues) {
  return { tripId: v.tripId, tollDate: v.tollDate, amountPaise: parseMoney(v.amount) ?? 0, location: v.location.trim() || null, notes: v.notes.trim() || null }
}

// ---------- vehicle loan ----------
const MAX_RATE_HUNDREDTHS = 10_000 // 100.00 % (matches the database check)

/** Interest rate in hundredths of a percent ("9.5" -> 950), or null if not a number with at most 2 decimals. */
export const parseRateHundredths = parseKmHundredths

export const loanFormSchema = z.object({
  vehicleId: z.string(), // blank = not linked to a vehicle
  lender: z.string().trim().min(1, 'Enter the lender.').max(100, 'Keep the lender under 100 characters.'),
  principal: z.string().trim().min(1, 'Enter the amount received.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Amount must be greater than zero.'),
  startDate: z.string().refine(isValidISODate, 'Enter the loan start date.'),
  interestRate: z.string().trim().min(1, 'Enter the interest rate (0 if none).')
    .refine((s) => parseRateHundredths(s) !== null, 'Enter a valid rate with up to 2 decimals.')
    .refine((s) => { const n = parseRateHundredths(s); return n === null || n <= MAX_RATE_HUNDREDTHS }, 'Rate cannot be more than 100%.'),
  emi: z.string().trim().min(1, 'Enter the monthly instalment (EMI).')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'EMI must be greater than zero.'),
  tenureMonths: z.string().trim().min(1, 'Enter the tenure in months.')
    .refine((s) => /^\d{1,3}$/.test(s), 'Enter whole months.')
    .refine((s) => Number(s) >= 1 && Number(s) <= 600, 'Tenure must be between 1 and 600 months.'),
  status: z.enum(LOAN_STATUSES),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type LoanFormValues = z.infer<typeof loanFormSchema>
export const defaultLoanValues = (todayISO = ''): LoanFormValues => ({
  vehicleId: '', lender: '', principal: '', startDate: todayISO, interestRate: '', emi: '', tenureMonths: '', status: 'active', notes: '',
})
export function toLoanInput(v: LoanFormValues) {
  return {
    vehicleId: v.vehicleId || null,
    lender: v.lender.trim(),
    principalPaise: parseMoney(v.principal) ?? 0,
    startDate: v.startDate,
    interestRate: (parseRateHundredths(v.interestRate) ?? 0) / 100,
    emiPaise: parseMoney(v.emi) ?? 0,
    tenureMonths: v.tenureMonths.trim() === '' ? null : Number(v.tenureMonths),
    status: v.status,
    notes: v.notes.trim() || null,
  }
}

// ---------- loan payment ----------
/** The full amount paid, interest included (D-009). The loan comes from the dialog, not the form. */
export const loanPaymentFormSchema = z.object({
  paymentDate: z.string().refine(isValidISODate, 'Enter the payment date.'),
  amount: z.string().trim().min(1, 'Enter the amount paid.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Amount must be greater than zero.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type LoanPaymentFormValues = z.infer<typeof loanPaymentFormSchema>
export const defaultLoanPaymentValues = (todayISO = '', emiPaise = 0): LoanPaymentFormValues => ({
  paymentDate: todayISO, amount: emiPaise > 0 ? (emiPaise / 100).toFixed(2) : '', notes: '',
})
export function toLoanPaymentInput(v: LoanPaymentFormValues) {
  return { paymentDate: v.paymentDate, amountPaise: parseMoney(v.amount) ?? 0, notes: v.notes.trim() || null }
}

// ---------- driver ----------
export const driverFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the driver name.').max(100, 'Keep the name under 100 characters.'),
  mobile,
  address: text(300, 'Keep the address under 300 characters.'),
  status: z.enum(['active', 'inactive']),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type DriverFormValues = z.infer<typeof driverFormSchema>
export const defaultDriverValues = (): DriverFormValues => ({ name: '', mobile: '', address: '', status: 'active', notes: '' })
export function toDriverInput(v: DriverFormValues) {
  return {
    name: v.name.trim(), mobile: v.mobile.trim() || null, address: v.address.trim() || null,
    status: v.status, notes: v.notes.trim() || null,
  }
}

// ---------- customer (shared table) ----------
export const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the customer name.').max(100, 'Keep the name under 100 characters.'),
  mobile,
  address: text(300, 'Keep the address under 300 characters.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type CustomerFormValues = z.infer<typeof customerFormSchema>
export const defaultCustomerValues = (): CustomerFormValues => ({ name: '', mobile: '', address: '', notes: '' })
export function toCustomerInput(v: CustomerFormValues) {
  return { name: v.name.trim(), mobile: v.mobile.trim() || null, address: v.address.trim() || null, notes: v.notes.trim() || null }
}
