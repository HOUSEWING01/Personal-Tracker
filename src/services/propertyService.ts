import { supabase } from '../lib/supabase'
import { fromPaise, toPaise } from '../lib/money'
import type {
  AdvanceKind, AdvanceMovement, PropertyOverview, PropertyStatus, PropertyType, RentCharge, RentPayment, Tenant,
} from '../types/property'

// ---------- row shapes ----------
type Num = number | string
interface OverviewRow {
  id: string; name: string; property_type: PropertyType; address: string | null; description: string | null
  status: PropertyStatus; monthly_rent: Num; tenant_name: string | null
  rental_start_date: string | null; rental_end_date: string | null
  expected_total: Num; paid_total: Num; advance_received: Num; advance_adjusted: Num; advance_returned: Num
}
interface TenantRow {
  id: string; property_id: string; name: string; mobile: string | null; address: string | null; notes: string | null
  rental_start_date: string; rental_end_date: string | null
}
interface ChargeRow { id: string; property_id: string; period: string; expected_amount: Num; paid_amount: Num; last_payment_date: string | null }
interface PaymentRow {
  id: string; property_id: string; period: string; amount: Num; payment_date: string; payment_method: string | null; notes: string | null
}
interface AdvanceRow { id: string; property_id: string; kind: AdvanceKind; amount: Num; movement_date: string; notes: string | null }

const toOverview = (r: OverviewRow): PropertyOverview => ({
  id: r.id, name: r.name, type: r.property_type, address: r.address, description: r.description, status: r.status,
  monthlyRentPaise: toPaise(r.monthly_rent), tenantName: r.tenant_name,
  rentalStartDate: r.rental_start_date, rentalEndDate: r.rental_end_date,
  expectedTotalPaise: toPaise(r.expected_total), paidTotalPaise: toPaise(r.paid_total),
  advanceReceivedPaise: toPaise(r.advance_received), advanceAdjustedPaise: toPaise(r.advance_adjusted),
  advanceReturnedPaise: toPaise(r.advance_returned),
})
const toTenant = (r: TenantRow): Tenant => ({
  id: r.id, propertyId: r.property_id, name: r.name, mobile: r.mobile, address: r.address, notes: r.notes,
  rentalStartDate: r.rental_start_date, rentalEndDate: r.rental_end_date,
})
const toCharge = (r: ChargeRow): RentCharge => ({
  id: r.id, propertyId: r.property_id, period: r.period, expectedPaise: toPaise(r.expected_amount),
  paidPaise: toPaise(r.paid_amount), lastPaymentDate: r.last_payment_date,
})
const toPayment = (r: PaymentRow): RentPayment => ({
  id: r.id, propertyId: r.property_id, period: r.period, amountPaise: toPaise(r.amount),
  paymentDate: r.payment_date, paymentMethod: r.payment_method, notes: r.notes,
})
const toAdvance = (r: AdvanceRow): AdvanceMovement => ({
  id: r.id, propertyId: r.property_id, kind: r.kind, amountPaise: toPaise(r.amount), date: r.movement_date, notes: r.notes,
})

// ---------- properties ----------
export interface PropertyFilters { status?: PropertyStatus; q?: string }

export async function listProperties(
  f: PropertyFilters, opts: { page: number; pageSize: number },
): Promise<{ rows: PropertyOverview[]; total: number }> {
  let query = supabase.from('property_overview').select('*', { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  if (f.q?.trim()) query = query.ilike('name', `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
  const start = (opts.page - 1) * opts.pageSize
  const { data, error, count } = await query.order('name').range(start, start + opts.pageSize - 1)
  if (error) throw error
  return { rows: (data as OverviewRow[]).map(toOverview), total: count ?? 0 }
}

export async function getProperty(id: string): Promise<PropertyOverview | null> {
  const { data, error } = await supabase.from('property_overview').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toOverview(data as OverviewRow) : null
}

export interface PropertyInput {
  name: string; type: PropertyType; status: PropertyStatus; monthlyRentPaise: number
  address: string | null; description: string | null
}
const propertyColumns = (p: PropertyInput) => ({
  name: p.name, property_type: p.type, status: p.status, monthly_rent: fromPaise(p.monthlyRentPaise),
  address: p.address, description: p.description,
})
export async function createProperty(p: PropertyInput): Promise<string> {
  const { data, error } = await supabase.from('properties').insert(propertyColumns(p)).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}
export async function updateProperty(id: string, p: PropertyInput): Promise<void> {
  const { error } = await supabase.from('properties').update(propertyColumns(p)).eq('id', id)
  if (error) throw error
}

// ---------- tenant (one per property) ----------
export async function getTenant(propertyId: string): Promise<Tenant | null> {
  const { data, error } = await supabase.from('tenants').select('*').eq('property_id', propertyId).maybeSingle()
  if (error) throw error
  return data ? toTenant(data as TenantRow) : null
}
export interface TenantInput {
  name: string; mobile: string | null; address: string | null; notes: string | null
  rentalStartDate: string; rentalEndDate: string | null
}
export async function saveTenant(propertyId: string, t: TenantInput): Promise<void> {
  const { error } = await supabase.from('tenants').upsert({
    property_id: propertyId, name: t.name, mobile: t.mobile, address: t.address, notes: t.notes,
    rental_start_date: t.rentalStartDate, rental_end_date: t.rentalEndDate,
  }, { onConflict: 'property_id' })
  if (error) throw error
}

// ---------- rent ----------
/** Creates any missing monthly charges (idempotent). Pass no id to sync every active property. */
export async function ensureRentCharges(propertyId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('ensure_rent_charges', { p_property_id: propertyId ?? null })
  if (error) throw error
  return (data as number) ?? 0
}
export async function listRentCharges(propertyId: string): Promise<RentCharge[]> {
  const { data, error } = await supabase.from('rent_charge_status').select('*').eq('property_id', propertyId).order('period', { ascending: false })
  if (error) throw error
  return (data as ChargeRow[]).map(toCharge)
}
export async function listRentPayments(propertyId: string): Promise<RentPayment[]> {
  const { data, error } = await supabase.from('rent_payments').select('*').eq('property_id', propertyId)
    .order('payment_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data as PaymentRow[]).map(toPayment)
}
export interface RentPaymentInput { amountPaise: number; paymentDate: string; paymentMethod: string | null; notes: string | null }
/** Writes the payment AND its ledger entry in one database transaction. */
export async function recordRentPayment(propertyId: string, period: string, p: RentPaymentInput): Promise<string> {
  const { data, error } = await supabase.rpc('record_rent_payment', {
    p_property_id: propertyId, p_period: period, p_amount: fromPaise(p.amountPaise),
    p_payment_date: p.paymentDate, p_payment_method: p.paymentMethod, p_notes: p.notes,
  })
  if (error) throw error
  return data as string
}

/** Deletes the payment and its ledger entry in one database transaction (admin only). */
export async function deleteRentPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_rent_payment', { p_payment_id: paymentId })
  if (error) throw error
}

// ---------- advance ----------
export async function listAdvanceMovements(propertyId: string): Promise<AdvanceMovement[]> {
  const { data, error } = await supabase.from('advance_movements').select('*').eq('property_id', propertyId)
    .order('movement_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data as AdvanceRow[]).map(toAdvance)
}
export interface AdvanceInput { kind: AdvanceKind; amountPaise: number; date: string; notes: string | null }
export async function recordAdvanceMovement(propertyId: string, a: AdvanceInput): Promise<string> {
  const { data, error } = await supabase.rpc('record_advance_movement', {
    p_property_id: propertyId, p_kind: a.kind, p_amount: fromPaise(a.amountPaise), p_movement_date: a.date, p_notes: a.notes,
  })
  if (error) throw error
  return data as string
}
