import { supabase } from '../lib/supabase'
import { fromPaise, toPaise } from '../lib/money'
import type {
  CustomerChoice, RentalStatus, SheetPayment, SheetProduct, SheetProductStatus, SheetRental, SheetReturn, SheetVariant, SheetVariantStatus,
} from '../types/sheets'
import { searchTerm, type PageOpts, type Paged } from './transportService'

type Num = number | string
const range = (o: PageOpts): [number, number] => [(o.page - 1) * o.pageSize, o.page * o.pageSize - 1]
const orLike = (cols: string[], q: string) => cols.map((c) => `${c}.ilike.%${q}%`).join(',')

// ---------- products (plain master; browser writes, RLS protects) ----------
interface ProductRow { id: string; name: string; status: SheetProductStatus; notes: string | null }
const toProduct = (r: ProductRow): SheetProduct => ({ id: r.id, name: r.name, status: r.status, notes: r.notes })

export interface ProductFilters { status?: SheetProductStatus; q?: string }
export async function listProducts(f: ProductFilters, o: PageOpts): Promise<Paged<SheetProduct>> {
  let query = supabase.from('sheet_products').select('*', { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(orLike(['name', 'notes'], q))
  const { data, error, count } = await query.order('name').range(...range(o))
  if (error) throw error
  return { rows: (data as ProductRow[]).map(toProduct), total: count ?? 0 }
}

/** All products for the variant picker (a business has a handful). */
export async function listProductChoices(): Promise<SheetProduct[]> {
  const { data, error } = await supabase.from('sheet_products').select('*').order('name').limit(200)
  if (error) throw error
  return (data as ProductRow[]).map(toProduct)
}

export interface ProductInput { name: string; status: SheetProductStatus; notes: string | null }
export async function createProduct(p: ProductInput): Promise<string> {
  const { data, error } = await supabase.from('sheet_products').insert(p).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}
export async function updateProduct(id: string, p: ProductInput): Promise<void> {
  const { error } = await supabase.from('sheet_products').update(p).eq('id', id)
  if (error) throw error
}

// ---------- variants + derived stock ----------
interface VariantRow {
  id: string; product_id: string; length_ft: Num; total_quantity: number; status: SheetVariantStatus; notes: string | null
  sheet_products: { name: string } | null
}
interface StockRow { variant_id: string; rented_quantity: number; damaged_quantity: number; missing_quantity: number; available_quantity: number }
const VARIANT_SELECT = '*, sheet_products(name)'

const toVariant = (r: VariantRow, s?: StockRow): SheetVariant => ({
  id: r.id, productId: r.product_id, productName: r.sheet_products?.name ?? '', lengthFt: Number(r.length_ft),
  totalQuantity: r.total_quantity,
  rentedQuantity: s?.rented_quantity ?? 0, damagedQuantity: s?.damaged_quantity ?? 0, missingQuantity: s?.missing_quantity ?? 0,
  availableQuantity: s?.available_quantity ?? r.total_quantity,
  status: r.status, notes: r.notes,
})

async function stockFor(ids: string[]): Promise<Map<string, StockRow>> {
  const map = new Map<string, StockRow>()
  if (ids.length === 0) return map
  const t = await supabase.from('sheet_variant_stock')
    .select('variant_id, rented_quantity, damaged_quantity, missing_quantity, available_quantity').in('variant_id', ids)
  if (t.error) throw t.error
  for (const r of t.data as StockRow[]) map.set(r.variant_id, r)
  return map
}

export interface VariantFilters { status?: SheetVariantStatus; productId?: string; q?: string }
export async function listVariants(f: VariantFilters, o: PageOpts): Promise<Paged<SheetVariant>> {
  let query = supabase.from('sheet_variants').select(VARIANT_SELECT, { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  if (f.productId) query = query.eq('product_id', f.productId)
  const { data, error, count } = await query.order('length_ft').range(...range(o))
  if (error) throw error
  const rows = data as unknown as VariantRow[]
  const stock = await stockFor(rows.map((r) => r.id))
  let out = rows.map((r) => toVariant(r, stock.get(r.id)))
  // Search by product name or size, applied to the page (variants per business are few).
  const q = searchTerm(f.q ?? '').toLowerCase()
  if (q) out = out.filter((v) => v.productName.toLowerCase().includes(q) || String(v.lengthFt).includes(q))
  return { rows: out, total: q ? out.length : (count ?? 0) }
}

/** Every variant with stock, for the rental picker. */
export async function listVariantChoices(): Promise<SheetVariant[]> {
  const { data, error } = await supabase.from('sheet_variants').select(VARIANT_SELECT).order('length_ft').limit(500)
  if (error) throw error
  const rows = data as unknown as VariantRow[]
  const stock = await stockFor(rows.map((r) => r.id))
  return rows.map((r) => toVariant(r, stock.get(r.id)))
}

export interface VariantInput { productId: string; lengthFt: number; totalQuantity: number; status: SheetVariantStatus; notes: string | null }
/** Creates (no id) or edits a variant through `save_sheet_variant()`, which refuses a total below the sheets already out (migration 0010). */
export async function saveSheetVariant(id: string | undefined, v: VariantInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_sheet_variant', {
    p_product_id: v.productId, p_length_ft: v.lengthFt, p_total_quantity: v.totalQuantity, p_status: v.status, p_notes: v.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------- customers (shared table, D-017) ----------
export async function listCustomerChoices(): Promise<CustomerChoice[]> {
  const { data, error } = await supabase.from('customers').select('id, name, mobile').order('name').limit(1000)
  if (error) throw error
  return data as CustomerChoice[]
}

// ---------- rentals ----------
interface RentalRow {
  id: string; customer_id: string; variant_id: string; quantity: number; rental_date: string; expected_return_date: string | null
  rent_amount: Num; discount: Num; status: RentalStatus; notes: string | null
  customers: { name: string; mobile: string | null } | null
  sheet_variants: { length_ft: Num; sheet_products: { name: string } | null } | null
}
interface RentalTotalsRow {
  rental_id: string; returned_total: number; damaged_total: number; missing_total: number
  last_return_date: string | null; paid_total: Num; payment_count: Num
}
const RENTAL_SELECT = '*, customers(name, mobile), sheet_variants(length_ft, sheet_products(name))'

const toRental = (r: RentalRow, t?: RentalTotalsRow): SheetRental => ({
  id: r.id, customerId: r.customer_id, customerName: r.customers?.name ?? '', customerMobile: r.customers?.mobile ?? null,
  variantId: r.variant_id, productName: r.sheet_variants?.sheet_products?.name ?? '', lengthFt: Number(r.sheet_variants?.length_ft ?? 0),
  quantity: r.quantity, rentalDate: r.rental_date, expectedReturnDate: r.expected_return_date,
  rentPaise: toPaise(r.rent_amount), discountPaise: toPaise(r.discount), status: r.status, notes: r.notes,
  returnedQuantity: t?.returned_total ?? 0, damagedQuantity: t?.damaged_total ?? 0, missingQuantity: t?.missing_total ?? 0,
  lastReturnDate: t?.last_return_date ?? null, paidPaise: t ? toPaise(t.paid_total) : 0, paymentCount: t ? Number(t.payment_count) : 0,
})

export interface RentalFilters { status?: RentalStatus; variantId?: string; overdueBefore?: string; q?: string }
export async function listRentals(f: RentalFilters, o: PageOpts): Promise<Paged<SheetRental>> {
  let query = supabase.from('sheet_rentals').select(RENTAL_SELECT, { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  if (f.variantId) query = query.eq('variant_id', f.variantId)
  // Overdue = active with an expected return date before today (sheets still out is implied by status 'active').
  if (f.overdueBefore) query = query.eq('status', 'active').lt('expected_return_date', f.overdueBefore)
  const q = searchTerm(f.q ?? '')
  if (q) {
    // Customer name/mobile live on another table; resolve matching customers first, then filter rentals by id or notes.
    const c = await supabase.from('customers').select('id').or(orLike(['name', 'mobile'], q)).limit(200)
    if (c.error) throw c.error
    const ids = (c.data as { id: string }[]).map((r) => r.id)
    query = query.or([ids.length ? `customer_id.in.(${ids.join(',')})` : '', `notes.ilike.%${q}%`].filter(Boolean).join(','))
  }
  const { data, error, count } = await query
    .order('rental_date', { ascending: false }).order('created_at', { ascending: false }).range(...range(o))
  if (error) throw error
  const rows = data as unknown as RentalRow[]

  const totals = new Map<string, RentalTotalsRow>()
  if (rows.length > 0) {
    const t = await supabase.from('sheet_rental_totals')
      .select('rental_id, returned_total, damaged_total, missing_total, last_return_date, paid_total, payment_count')
      .in('rental_id', rows.map((r) => r.id))
    if (t.error) throw t.error
    for (const r of t.data as RentalTotalsRow[]) totals.set(r.rental_id, r)
  }
  return { rows: rows.map((r) => toRental(r, totals.get(r.id))), total: count ?? 0 }
}

export interface RentalInput {
  customerId: string; variantId: string; quantity: number; rentalDate: string; expectedReturnDate: string | null
  rentPaise: number; discountPaise: number; notes: string | null
  /** Used only when creating: an optional advance, posted to Finance as a customer payment. */
  advancePaise: number; paymentMethod: string | null
}
/**
 * Creates (no id) or edits a rental through `save_sheet_rental()`. The database refuses more sheets than are
 * available, and posts the optional advance to the ledger in the same transaction (D-022 / D-023, migration 0010).
 */
export async function saveSheetRental(id: string | undefined, r: RentalInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_sheet_rental', {
    p_customer_id: r.customerId, p_variant_id: r.variantId, p_quantity: r.quantity, p_rental_date: r.rentalDate,
    p_expected_return_date: r.expectedReturnDate, p_rent_amount: fromPaise(r.rentPaise), p_discount: fromPaise(r.discountPaise),
    p_notes: r.notes, p_advance: id ? 0 : fromPaise(r.advancePaise), p_payment_method: id ? null : r.paymentMethod, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

export async function cancelSheetRental(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_sheet_rental', { p_id: id })
  if (error) throw error
}

// ---------- payments ----------
interface PaymentRow { id: string; rental_id: string; payment_date: string; amount: Num; payment_method: string | null; notes: string | null }
const toPayment = (r: PaymentRow): SheetPayment => ({
  id: r.id, rentalId: r.rental_id, paymentDate: r.payment_date, amountPaise: toPaise(r.amount), paymentMethod: r.payment_method, notes: r.notes,
})
export async function listSheetPayments(rentalId: string): Promise<SheetPayment[]> {
  const { data, error } = await supabase.from('sheet_rental_payments').select('*').eq('rental_id', rentalId)
    .order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return (data as PaymentRow[]).map(toPayment)
}

export interface SheetPaymentInput { paymentDate: string; amountPaise: number; paymentMethod: string | null; notes: string | null }
/** Records (no id) or edits a payment; posts / updates the `customer_payment` ledger entry in one transaction. */
export async function saveSheetPayment(rentalId: string, id: string | undefined, p: SheetPaymentInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_sheet_payment', {
    p_rental_id: rentalId, p_payment_date: p.paymentDate, p_amount: fromPaise(p.amountPaise),
    p_payment_method: p.paymentMethod, p_notes: p.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------- returns ----------
interface ReturnRow {
  id: string; rental_id: string; return_date: string; returned_quantity: number; damaged_quantity: number; missing_quantity: number; notes: string | null
}
const toReturn = (r: ReturnRow): SheetReturn => ({
  id: r.id, rentalId: r.rental_id, returnDate: r.return_date, returnedQuantity: r.returned_quantity,
  damagedQuantity: r.damaged_quantity, missingQuantity: r.missing_quantity, notes: r.notes,
})
export async function listSheetReturns(rentalId: string): Promise<SheetReturn[]> {
  const { data, error } = await supabase.from('sheet_returns').select('*').eq('rental_id', rentalId)
    .order('return_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return (data as ReturnRow[]).map(toReturn)
}

export interface SheetReturnInput { returnDate: string; returned: number; damaged: number; missing: number; notes: string | null }
/** Records one (possibly partial) return through `record_sheet_return()`; stock and the rental's status follow. */
export async function recordSheetReturn(rentalId: string, r: SheetReturnInput): Promise<string> {
  const { data, error } = await supabase.rpc('record_sheet_return', {
    p_rental_id: rentalId, p_return_date: r.returnDate, p_returned: r.returned, p_damaged: r.damaged, p_missing: r.missing, p_notes: r.notes,
  })
  if (error) throw error
  return data as string
}
export async function deleteSheetReturn(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_sheet_return', { p_id: id })
  if (error) throw error
}
