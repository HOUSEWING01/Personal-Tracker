import { z } from 'zod'
import { isValidISODate } from '../../lib/dates'
import { PAYMENT_METHODS } from '../finance/labels'
import { parseMoney } from '../property/propertyForms'
import { parseKmHundredths } from '../transport/transportForms'

const text = (max: number, msg: string) => z.string().trim().max(max, msg)
const mobile = z.string().trim().refine((s) => s === '' || /^[0-9]{10}$/.test(s), 'Enter a 10-digit mobile number.')
const METHOD_KEYS = PAYMENT_METHODS.map((m) => m.value) as readonly string[]

/** Blank means zero; negatives are rejected. */
const optionalMoney = z.string().trim().refine((s) => {
  if (s === '') return true
  const p = parseMoney(s)
  return p !== null && p >= 0
}, 'Enter a valid amount with up to 2 decimals.')
const paiseOrZero = (s: string): number => (s.trim() === '' ? 0 : (parseMoney(s) ?? 0))

/** Whole number >= min (no decimals, no signs). */
const wholeNumber = (what: string, min: number, max = 1_000_000) =>
  z.string().trim().min(1, `Enter ${what}.`)
    .refine((s) => /^\d{1,7}$/.test(s), 'Enter a whole number.')
    .refine((s) => { const n = Number(s); return !/^\d{1,7}$/.test(s) || (n >= min && n <= max) }, min > 0 ? `Must be at least ${min}.` : 'Enter 0 or more.')
const optionalWhole = z.string().trim().refine((s) => s === '' || /^\d{1,7}$/.test(s), 'Enter a whole number, or leave blank.')

// ---------- product ----------
export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a product name.').max(100, 'Keep the name under 100 characters.'),
  status: z.enum(['active', 'inactive']),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type ProductFormValues = z.infer<typeof productFormSchema>
export const defaultProductValues = (): ProductFormValues => ({ name: '', status: 'active', notes: '' })
export function toProductInput(v: ProductFormValues) {
  return { name: v.name.trim(), status: v.status, notes: v.notes.trim() || null }
}

// ---------- variant ----------
const MAX_LENGTH_HUNDREDTHS = 999_999 // numeric(6,2)

export const variantFormSchema = z.object({
  productId: z.string().min(1, 'Choose a product.'),
  lengthFt: z.string().trim().min(1, 'Enter the length in feet.')
    .refine((s) => parseKmHundredths(s) !== null, 'Enter a valid length with up to 2 decimals.')
    .refine((s) => (parseKmHundredths(s) ?? 1) > 0, 'Length must be greater than zero.')
    .refine((s) => { const n = parseKmHundredths(s); return n === null || n <= MAX_LENGTH_HUNDREDTHS }, 'That length is too large.'),
  totalQuantity: wholeNumber('the total quantity you own', 0),
  status: z.enum(['active', 'inactive']),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type VariantFormValues = z.infer<typeof variantFormSchema>
export const defaultVariantValues = (): VariantFormValues => ({ productId: '', lengthFt: '', totalQuantity: '', status: 'active', notes: '' })
export function toVariantInput(v: VariantFormValues) {
  return {
    productId: v.productId, lengthFt: (parseKmHundredths(v.lengthFt) ?? 0) / 100, totalQuantity: Number(v.totalQuantity),
    status: v.status, notes: v.notes.trim() || null,
  }
}

// ---------- rental ----------
export const NEW_CUSTOMER = '__new__'

export const rentalFormSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer, or add a new one.'),
  newName: z.string().trim().max(100, 'Keep the name under 100 characters.'),
  newMobile: mobile,
  newAddress: text(300, 'Keep the address under 300 characters.'),
  variantId: z.string().min(1, 'Choose a product and size.'),
  quantity: wholeNumber('the quantity', 1),
  rentalDate: z.string().refine(isValidISODate, 'Enter the rental date.'),
  expectedReturnDate: z.string().refine((s) => s === '' || isValidISODate(s), 'Enter a valid date.'),
  rent: optionalMoney,
  discount: optionalMoney,
  advance: optionalMoney,
  paymentMethod: z.string().refine((s) => s === '' || METHOD_KEYS.includes(s), 'Choose a payment method.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
}).superRefine((v, ctx) => {
  if (v.customerId === NEW_CUSTOMER && v.newName === '') ctx.addIssue({ code: 'custom', path: ['newName'], message: 'Enter the customer name.' })
  if (isValidISODate(v.rentalDate) && v.expectedReturnDate !== '' && isValidISODate(v.expectedReturnDate) && v.expectedReturnDate < v.rentalDate)
    ctx.addIssue({ code: 'custom', path: ['expectedReturnDate'], message: 'Expected return cannot be before the rental date.' })
  const rent = paiseOrZero(v.rent), discount = paiseOrZero(v.discount), advance = paiseOrZero(v.advance)
  if (discount > rent) ctx.addIssue({ code: 'custom', path: ['discount'], message: 'Discount cannot be more than the rent.' })
  else if (advance > rent - discount) ctx.addIssue({ code: 'custom', path: ['advance'], message: 'Advance cannot be more than the net rent.' })
})
export type RentalFormValues = z.infer<typeof rentalFormSchema>
export const defaultRentalValues = (todayISO = ''): RentalFormValues => ({
  customerId: '', newName: '', newMobile: '', newAddress: '', variantId: '', quantity: '', rentalDate: todayISO,
  expectedReturnDate: '', rent: '', discount: '', advance: '', paymentMethod: '', notes: '',
})
export function toRentalInput(v: RentalFormValues, customerId: string) {
  return {
    customerId, variantId: v.variantId, quantity: Number(v.quantity), rentalDate: v.rentalDate,
    expectedReturnDate: v.expectedReturnDate || null, rentPaise: paiseOrZero(v.rent), discountPaise: paiseOrZero(v.discount),
    notes: v.notes.trim() || null, advancePaise: paiseOrZero(v.advance), paymentMethod: v.paymentMethod || null,
  }
}
export function toNewCustomerInput(v: RentalFormValues) {
  return { name: v.newName.trim(), mobile: v.newMobile.trim() || null, address: v.newAddress.trim() || null, notes: null }
}

// ---------- payment ----------
/** `maxPaise` = net rent - paid by others (for an edit, excluding the payment being edited). `minDate` = the rental date. */
export const makeSheetPaymentSchema = (maxPaise: number, minDate: string) => z.object({
  paymentDate: z.string().refine(isValidISODate, 'Enter the payment date.'),
  amount: z.string().trim().min(1, 'Enter the amount.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Amount must be greater than zero.')
    .refine((s) => (parseMoney(s) ?? 0) <= maxPaise, 'Amount is more than the outstanding rent.'),
  paymentMethod: z.string().refine((s) => s === '' || METHOD_KEYS.includes(s), 'Choose a payment method.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
}).superRefine((v, ctx) => {
  if (isValidISODate(v.paymentDate) && v.paymentDate < minDate) ctx.addIssue({ code: 'custom', path: ['paymentDate'], message: 'Payment date is before the rental date.' })
})
export type SheetPaymentFormValues = z.infer<ReturnType<typeof makeSheetPaymentSchema>>
export function toSheetPaymentInput(v: SheetPaymentFormValues) {
  return { paymentDate: v.paymentDate, amountPaise: parseMoney(v.amount) ?? 0, paymentMethod: v.paymentMethod || null, notes: v.notes.trim() || null }
}

// ---------- return ----------
/** `stillOut` = sheets not yet accounted for (good + damaged + missing must be 1..stillOut). `minDate` = rental date, `maxDate` = today. */
export const makeSheetReturnSchema = (stillOut: number, minDate: string, maxDate: string) => z.object({
  returnDate: z.string().refine(isValidISODate, 'Enter the return date.'),
  returned: optionalWhole,
  damaged: optionalWhole,
  missing: optionalWhole,
  notes: text(500, 'Keep the notes under 500 characters.'),
}).superRefine((v, ctx) => {
  if (isValidISODate(v.returnDate) && v.returnDate < minDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'Return date is before the rental date.' })
  if (isValidISODate(v.returnDate) && v.returnDate > maxDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'Return date cannot be in the future.' })
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s))
  const total = n(v.returned) + n(v.damaged) + n(v.missing)
  if (total <= 0) ctx.addIssue({ code: 'custom', path: ['returned'], message: 'Enter at least one sheet.' })
  else if (total > stillOut) ctx.addIssue({ code: 'custom', path: ['returned'], message: `Only ${stillOut} ${stillOut === 1 ? 'sheet is' : 'sheets are'} still out.` })
})
export type SheetReturnFormValues = z.infer<ReturnType<typeof makeSheetReturnSchema>>
export const defaultSheetReturnValues = (todayISO = '', stillOut = 0): SheetReturnFormValues => ({
  returnDate: todayISO, returned: stillOut > 0 ? String(stillOut) : '', damaged: '', missing: '', notes: '',
})
export function toSheetReturnInput(v: SheetReturnFormValues) {
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s))
  return { returnDate: v.returnDate, returned: n(v.returned), damaged: n(v.damaged), missing: n(v.missing), notes: v.notes.trim() || null }
}
