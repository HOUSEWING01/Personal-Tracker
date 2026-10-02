import { supabase } from '../lib/supabase'
import { fromPaise, toPaise } from '../lib/money'
import type {
  Customer, Driver, DriverStatus, FuelLog, LoanPayment, LoanStatus, Toll, Trip, TripChoice, TripStatus, Vehicle, VehicleLoan, VehicleProfitTotals, VehicleStatus,
} from '../types/transport'

type Num = number | string

// ---------- row shapes ----------
interface VehicleRow {
  id: string; name: string; registration_number: string; purchase_price: Num; purchase_date: string
  container_price: Num; container_details: string | null; status: VehicleStatus; notes: string | null
}
interface DriverRow { id: string; name: string; mobile: string | null; address: string | null; status: DriverStatus; notes: string | null }
interface CustomerRow { id: string; name: string; mobile: string | null; address: string | null; notes: string | null }

const toVehicle = (r: VehicleRow): Vehicle => ({
  id: r.id, name: r.name, registrationNumber: r.registration_number, purchasePricePaise: toPaise(r.purchase_price),
  purchaseDate: r.purchase_date, containerPricePaise: toPaise(r.container_price), containerDetails: r.container_details,
  status: r.status, notes: r.notes,
})
const toDriver = (r: DriverRow): Driver => ({ id: r.id, name: r.name, mobile: r.mobile, address: r.address, status: r.status, notes: r.notes })
const toCustomer = (r: CustomerRow): Customer => ({ id: r.id, name: r.name, mobile: r.mobile, address: r.address, notes: r.notes })

/** Search text goes into a PostgREST `or(...)` filter, so strip characters that would change its meaning. */
export function searchTerm(q: string): string {
  return q.replace(/[,()*\\%_:"']/g, ' ').replace(/\s+/g, ' ').trim()
}
const orLike = (cols: string[], q: string) => cols.map((c) => `${c}.ilike.%${q}%`).join(',')

export interface PageOpts { page: number; pageSize: number }
export interface Paged<T> { rows: T[]; total: number }
const range = (o: PageOpts): [number, number] => [(o.page - 1) * o.pageSize, o.page * o.pageSize - 1]

// ---------- vehicles ----------
export interface VehicleFilters { status?: VehicleStatus; q?: string }
export async function listVehicles(f: VehicleFilters, o: PageOpts): Promise<Paged<Vehicle>> {
  let query = supabase.from('vehicles').select('*', { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(orLike(['name', 'registration_number'], q))
  const { data, error, count } = await query.order('name').range(...range(o))
  if (error) throw error
  return { rows: (data as VehicleRow[]).map(toVehicle), total: count ?? 0 }
}

export interface VehicleInput {
  name: string; registrationNumber: string; purchasePricePaise: number; purchaseDate: string
  containerPricePaise: number; containerDetails: string | null; status: VehicleStatus; notes: string | null
}
/**
 * Creates (no id) or edits a vehicle. The database function also keeps the vehicle's purchase and
 * container investment entries in the ledger in step, in one transaction (D-016, migration 0005).
 */
export async function saveVehicle(id: string | undefined, v: VehicleInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_vehicle', {
    p_name: v.name, p_registration_number: v.registrationNumber, p_purchase_price: fromPaise(v.purchasePricePaise),
    p_purchase_date: v.purchaseDate, p_container_price: fromPaise(v.containerPricePaise),
    p_container_details: v.containerDetails, p_status: v.status, p_notes: v.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------- drivers ----------
export interface DriverFilters { status?: DriverStatus; q?: string }
export async function listDrivers(f: DriverFilters, o: PageOpts): Promise<Paged<Driver>> {
  let query = supabase.from('drivers').select('*', { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(orLike(['name', 'mobile'], q))
  const { data, error, count } = await query.order('name').range(...range(o))
  if (error) throw error
  return { rows: (data as DriverRow[]).map(toDriver), total: count ?? 0 }
}

export interface DriverInput { name: string; mobile: string | null; address: string | null; status: DriverStatus; notes: string | null }
export async function createDriver(d: DriverInput): Promise<string> {
  const { data, error } = await supabase.from('drivers').insert(d).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}
export async function updateDriver(id: string, d: DriverInput): Promise<void> {
  const { error } = await supabase.from('drivers').update(d).eq('id', id)
  if (error) throw error
}

// ---------- customers (shared table, D-017) ----------
export async function listCustomers(f: { q?: string }, o: PageOpts): Promise<Paged<Customer>> {
  let query = supabase.from('customers').select('*', { count: 'exact' })
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(orLike(['name', 'mobile'], q))
  const { data, error, count } = await query.order('name').range(...range(o))
  if (error) throw error
  return { rows: (data as CustomerRow[]).map(toCustomer), total: count ?? 0 }
}

export interface CustomerInput { name: string; mobile: string | null; address: string | null; notes: string | null }
export async function createCustomer(c: CustomerInput): Promise<string> {
  const { data, error } = await supabase.from('customers').insert(c).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}
export async function updateCustomer(id: string, c: CustomerInput): Promise<void> {
  const { error } = await supabase.from('customers').update(c).eq('id', id)
  if (error) throw error
}

// ---------- trips ----------
interface TripRow {
  id: string; vehicle_id: string; driver_id: string; customer_id: string
  from_location: string; to_location: string; distance_km: Num; rate_per_km: Num; driver_payment: Num
  trip_date: string; status: TripStatus; notes: string | null
  vehicles: { name: string; registration_number: string } | null
  drivers: { name: string } | null
  customers: { name: string } | null
}
const TRIP_SELECT = '*, vehicles(name, registration_number), drivers(name), customers(name)'

const toTrip = (r: TripRow, cost?: { fuel_total: Num; toll_total: Num }): Trip => ({
  id: r.id, vehicleId: r.vehicle_id, vehicleName: r.vehicles?.name ?? '', vehicleRegistration: r.vehicles?.registration_number ?? '',
  driverId: r.driver_id, driverName: r.drivers?.name ?? '', customerId: r.customer_id, customerName: r.customers?.name ?? '',
  fromLocation: r.from_location, toLocation: r.to_location, distanceKm: Number(r.distance_km),
  ratePerKmPaise: toPaise(r.rate_per_km), driverPaymentPaise: toPaise(r.driver_payment),
  fuelPaise: cost ? toPaise(cost.fuel_total) : 0, tollPaise: cost ? toPaise(cost.toll_total) : 0,
  tripDate: r.trip_date, status: r.status, notes: r.notes,
})

export interface TripFilters { status?: TripStatus; vehicleId?: string; q?: string }
export async function listTrips(f: TripFilters, o: PageOpts): Promise<Paged<Trip>> {
  let query = supabase.from('trips').select(TRIP_SELECT, { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  if (f.vehicleId) query = query.eq('vehicle_id', f.vehicleId)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(orLike(['from_location', 'to_location', 'notes'], q))
  const { data, error, count } = await query
    .order('trip_date', { ascending: false }).order('created_at', { ascending: false }).range(...range(o))
  if (error) throw error
  const rows = data as unknown as TripRow[]

  // Fuel and toll totals for just this page of trips (raw sums; profit is computed in transportEngine).
  const costs = new Map<string, { fuel_total: Num; toll_total: Num }>()
  if (rows.length > 0) {
    const c = await supabase.from('trip_cost_totals').select('trip_id, fuel_total, toll_total').in('trip_id', rows.map((r) => r.id))
    if (c.error) throw c.error
    for (const r of c.data as { trip_id: string; fuel_total: Num; toll_total: Num }[]) costs.set(r.trip_id, r)
  }
  return { rows: rows.map((r) => toTrip(r, costs.get(r.id))), total: count ?? 0 }
}

export interface TripInput {
  vehicleId: string; driverId: string; customerId: string
  fromLocation: string; toLocation: string; distanceKm: number; ratePerKmPaise: number
  driverPaymentPaise: number; tripDate: string; status: TripStatus; notes: string | null
}
/**
 * Creates (no id) or edits a trip. The database function also keeps the trip's revenue and driver-payment
 * entries in the ledger in step, in one transaction (D-018, migration 0006).
 */
export async function saveTrip(id: string | undefined, t: TripInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_trip', {
    p_vehicle_id: t.vehicleId, p_driver_id: t.driverId, p_customer_id: t.customerId,
    p_from_location: t.fromLocation, p_to_location: t.toLocation, p_distance_km: t.distanceKm,
    p_rate_per_km: fromPaise(t.ratePerKmPaise), p_driver_payment: fromPaise(t.driverPaymentPaise),
    p_trip_date: t.tripDate, p_status: t.status, p_notes: t.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------- pickers for the trip form ----------
export interface TripOptions {
  vehicles: { id: string; name: string; registrationNumber: string; status: VehicleStatus }[]
  drivers: { id: string; name: string; status: DriverStatus }[]
  customers: { id: string; name: string; mobile: string | null }[]
}
/** Vehicles, drivers and customers for the trip form's pickers (the form shows only active vehicles/drivers). */
export async function listTripOptions(): Promise<TripOptions> {
  const [v, d, c] = await Promise.all([
    supabase.from('vehicles').select('id, name, registration_number, status').order('name').limit(1000),
    supabase.from('drivers').select('id, name, status').order('name').limit(1000),
    supabase.from('customers').select('id, name, mobile').order('name').limit(2000),
  ])
  if (v.error) throw v.error
  if (d.error) throw d.error
  if (c.error) throw c.error
  return {
    vehicles: (v.data as { id: string; name: string; registration_number: string; status: VehicleStatus }[])
      .map((r) => ({ id: r.id, name: r.name, registrationNumber: r.registration_number, status: r.status })),
    drivers: d.data as TripOptions['drivers'],
    customers: c.data as TripOptions['customers'],
  }
}

// ---------- fuel ----------
interface FuelRow {
  id: string; vehicle_id: string; trip_id: string | null; fuel_date: string; litres: Num; price_per_litre: Num; total: Num
  odometer_km: number | null; notes: string | null
  vehicles: { name: string; registration_number: string } | null
  trips: { from_location: string; to_location: string; trip_date: string } | null
}
const FUEL_SELECT = '*, vehicles(name, registration_number), trips(from_location, to_location, trip_date)'
const tripLabel = (t: { from_location: string; to_location: string; trip_date: string }) => `${t.from_location} to ${t.to_location} (${t.trip_date})`

const toFuel = (r: FuelRow): FuelLog => ({
  id: r.id, vehicleId: r.vehicle_id, vehicleName: r.vehicles?.name ?? '', vehicleRegistration: r.vehicles?.registration_number ?? '',
  tripId: r.trip_id, tripLabel: r.trips ? tripLabel(r.trips) : null, fuelDate: r.fuel_date, litres: Number(r.litres),
  pricePerLitrePaise: toPaise(r.price_per_litre), totalPaise: toPaise(r.total), odometerKm: r.odometer_km, notes: r.notes,
})

export interface FuelFilters { vehicleId?: string; q?: string }
export async function listFuelLogs(f: FuelFilters, o: PageOpts): Promise<Paged<FuelLog>> {
  let query = supabase.from('fuel_logs').select(FUEL_SELECT, { count: 'exact' })
  if (f.vehicleId) query = query.eq('vehicle_id', f.vehicleId)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.ilike('notes', `%${q}%`)
  const { data, error, count } = await query
    .order('fuel_date', { ascending: false }).order('created_at', { ascending: false }).range(...range(o))
  if (error) throw error
  return { rows: (data as unknown as FuelRow[]).map(toFuel), total: count ?? 0 }
}

export interface FuelInput {
  vehicleId: string; tripId: string | null; fuelDate: string; litres: number; pricePerLitrePaise: number
  odometerKm: number | null; notes: string | null
}
/** Creates (no id) or edits a fuel log; the database function keeps its expense entry in the ledger in step (D-019). */
export async function saveFuelLog(id: string | undefined, f: FuelInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_fuel_log', {
    p_vehicle_id: f.vehicleId, p_trip_id: f.tripId, p_fuel_date: f.fuelDate, p_litres: f.litres,
    p_price_per_litre: fromPaise(f.pricePerLitrePaise), p_odometer_km: f.odometerKm, p_notes: f.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------- tolls ----------
interface TollRow {
  id: string; trip_id: string; vehicle_id: string; toll_date: string; amount: Num; location: string | null; notes: string | null
  vehicles: { name: string; registration_number: string } | null
  trips: { from_location: string; to_location: string; trip_date: string } | null
}
const TOLL_SELECT = '*, vehicles(name, registration_number), trips(from_location, to_location, trip_date)'

const toToll = (r: TollRow): Toll => ({
  id: r.id, tripId: r.trip_id, tripLabel: r.trips ? tripLabel(r.trips) : '', vehicleId: r.vehicle_id,
  vehicleName: r.vehicles?.name ?? '', vehicleRegistration: r.vehicles?.registration_number ?? '',
  tollDate: r.toll_date, amountPaise: toPaise(r.amount), location: r.location, notes: r.notes,
})

export interface TollFilters { vehicleId?: string; q?: string }
export async function listTolls(f: TollFilters, o: PageOpts): Promise<Paged<Toll>> {
  let query = supabase.from('tolls').select(TOLL_SELECT, { count: 'exact' })
  if (f.vehicleId) query = query.eq('vehicle_id', f.vehicleId)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(orLike(['location', 'notes'], q))
  const { data, error, count } = await query
    .order('toll_date', { ascending: false }).order('created_at', { ascending: false }).range(...range(o))
  if (error) throw error
  return { rows: (data as unknown as TollRow[]).map(toToll), total: count ?? 0 }
}

export interface TollInput { tripId: string; tollDate: string; amountPaise: number; location: string | null; notes: string | null }
/** Creates (no id) or edits a toll; the database function keeps its expense entry in the ledger in step (D-019). */
export async function saveToll(id: string | undefined, t: TollInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_toll', {
    p_trip_id: t.tripId, p_toll_date: t.tollDate, p_amount: fromPaise(t.amountPaise),
    p_location: t.location, p_notes: t.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------- trip picker for the fuel and toll forms ----------
/** The most recent trips (newest first) so a fuel log or toll can be linked to one. */
export async function listTripChoices(): Promise<TripChoice[]> {
  const { data, error } = await supabase.from('trips')
    .select('id, vehicle_id, trip_date, from_location, to_location')
    .order('trip_date', { ascending: false }).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data as { id: string; vehicle_id: string; trip_date: string; from_location: string; to_location: string }[])
    .map((t) => ({ id: t.id, vehicleId: t.vehicle_id, label: tripLabel(t) }))
}

// ---------- vehicle loans (D-020) ----------
interface LoanRow {
  id: string; vehicle_id: string | null; lender: string; principal: Num; start_date: string; interest_rate: Num; emi: Num
  tenure_months: number | null; status: LoanStatus; notes: string | null
  vehicles: { name: string; registration_number: string } | null
}
interface LoanTotalsRow { loan_id: string; paid_total: Num; payment_count: Num; last_payment_date: string | null }
const LOAN_SELECT = '*, vehicles(name, registration_number)'

const toLoan = (r: LoanRow, t?: LoanTotalsRow): VehicleLoan => ({
  id: r.id, vehicleId: r.vehicle_id, vehicleName: r.vehicles?.name ?? null, vehicleRegistration: r.vehicles?.registration_number ?? null,
  lender: r.lender, principalPaise: toPaise(r.principal), startDate: r.start_date, interestRate: Number(r.interest_rate),
  emiPaise: toPaise(r.emi), tenureMonths: r.tenure_months, status: r.status, notes: r.notes,
  paidPaise: t ? toPaise(t.paid_total) : 0, paymentCount: t ? Number(t.payment_count) : 0, lastPaymentDate: t?.last_payment_date ?? null,
})

export interface LoanFilters { status?: LoanStatus; vehicleId?: string; q?: string }
export async function listLoans(f: LoanFilters, o: PageOpts): Promise<Paged<VehicleLoan>> {
  let query = supabase.from('vehicle_loans').select(LOAN_SELECT, { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  if (f.vehicleId) query = query.eq('vehicle_id', f.vehicleId)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(orLike(['lender', 'notes'], q))
  const { data, error, count } = await query
    .order('start_date', { ascending: false }).order('created_at', { ascending: false }).range(...range(o))
  if (error) throw error
  const rows = data as unknown as LoanRow[]

  // Repayment totals for just this page of loans (raw sums).
  const totals = new Map<string, LoanTotalsRow>()
  if (rows.length > 0) {
    const t = await supabase.from('loan_payment_totals').select('loan_id, paid_total, payment_count, last_payment_date').in('loan_id', rows.map((r) => r.id))
    if (t.error) throw t.error
    for (const r of t.data as LoanTotalsRow[]) totals.set(r.loan_id, r)
  }
  return { rows: rows.map((r) => toLoan(r, totals.get(r.id))), total: count ?? 0 }
}

export interface LoanInput {
  vehicleId: string | null; lender: string; principalPaise: number; startDate: string; interestRate: number
  emiPaise: number; tenureMonths: number | null; status: LoanStatus; notes: string | null
}
/**
 * Creates (no id) or edits a vehicle loan. The database function also keeps the loan's `loan_received`
 * entry in the ledger in step, in one transaction (D-020, migration 0008).
 */
export async function saveVehicleLoan(id: string | undefined, l: LoanInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_vehicle_loan', {
    p_vehicle_id: l.vehicleId, p_lender: l.lender, p_principal: fromPaise(l.principalPaise), p_start_date: l.startDate,
    p_interest_rate: l.interestRate, p_emi: fromPaise(l.emiPaise), p_tenure_months: l.tenureMonths,
    p_status: l.status, p_notes: l.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

interface LoanPaymentRow { id: string; loan_id: string; payment_date: string; amount: Num; notes: string | null }
const toLoanPayment = (r: LoanPaymentRow): LoanPayment => ({
  id: r.id, loanId: r.loan_id, paymentDate: r.payment_date, amountPaise: toPaise(r.amount), notes: r.notes,
})

/** Every payment of one loan, newest first (a loan has at most a few hundred). */
export async function listLoanPayments(loanId: string): Promise<LoanPayment[]> {
  const { data, error } = await supabase.from('loan_payments').select('*').eq('loan_id', loanId)
    .order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return (data as LoanPaymentRow[]).map(toLoanPayment)
}

export interface LoanPaymentInput { paymentDate: string; amountPaise: number; notes: string | null }
/**
 * Records (no id) or edits a repayment. The full amount, interest included, posts to the ledger as one
 * `loan_repayment` in the same transaction (D-009 / D-020, migration 0008).
 */
export async function saveLoanPayment(loanId: string, id: string | undefined, p: LoanPaymentInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_loan_payment', {
    p_loan_id: loanId, p_payment_date: p.paymentDate, p_amount: fromPaise(p.amountPaise), p_notes: p.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------- transport profit (D-021) ----------
interface ProfitRow { vehicle_id: string | null; revenue: Num; driver: Num; fuel: Num; toll: Num; loan_repaid: Num }

/** Raw per-vehicle sums for a period (either end may be empty = unbounded). Profit is computed in transportEngine. */
export async function listVehicleProfitTotals(from?: string, to?: string): Promise<VehicleProfitTotals[]> {
  const [p, v] = await Promise.all([
    supabase.rpc('vehicle_profit_totals', { p_from: from || null, p_to: to || null }),
    supabase.from('vehicles').select('id, name, registration_number').limit(2000),
  ])
  if (p.error) throw p.error
  if (v.error) throw v.error
  const names = new Map((v.data as { id: string; name: string; registration_number: string }[]).map((r) => [r.id, r]))
  return (p.data as ProfitRow[]).map((r) => {
    const veh = r.vehicle_id ? names.get(r.vehicle_id) : undefined
    return {
      vehicleId: r.vehicle_id, vehicleName: r.vehicle_id ? (veh?.name ?? 'Unknown vehicle') : 'Loans not linked to a vehicle',
      vehicleRegistration: veh?.registration_number ?? null,
      revenuePaise: toPaise(r.revenue), driverPaise: toPaise(r.driver), fuelPaise: toPaise(r.fuel), tollPaise: toPaise(r.toll), loanRepaidPaise: toPaise(r.loan_repaid),
    }
  }).sort((a, b) => a.vehicleName.localeCompare(b.vehicleName))
}
