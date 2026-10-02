import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { SheetRental } from '../../types/sheets'
import { PAYMENT_METHODS } from '../finance/labels'
import { useSaveCustomer } from '../transport/hooks'
import { parseMoney } from '../property/propertyForms'
import { useCancelRental, useCustomerChoices, useSaveRental, useVariantChoices } from './hooks'
import { variantLabel } from './sheetEngine'
import {
  defaultRentalValues, NEW_CUSTOMER, rentalFormSchema, toNewCustomerInput, toRentalInput, type RentalFormValues,
} from './sheetForms'
import { sheetSubmitError } from './submitError'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

const money = (paise: number) => (paise / 100).toFixed(2)

function initial(r?: SheetRental): RentalFormValues {
  if (!r) return defaultRentalValues(todayIST())
  return {
    customerId: r.customerId, newName: '', newMobile: '', newAddress: '', variantId: r.variantId, quantity: String(r.quantity),
    rentalDate: r.rentalDate, expectedReturnDate: r.expectedReturnDate ?? '', rent: money(r.rentPaise),
    discount: r.discountPaise > 0 ? money(r.discountPaise) : '', advance: '', paymentMethod: '', notes: r.notes ?? '',
  }
}

function Form({ rental, onClose, onSaved }: { rental?: SheetRental; onClose: () => void; onSaved: () => void }) {
  const save = useSaveRental(rental?.id)
  const newCustomer = useSaveCustomer()
  const cancel = useCancelRental()
  const customers = useCustomerChoices()
  const variants = useVariantChoices()
  const createdCustomerId = useRef<string | null>(null) // reused if the rental save fails after the customer was created
  const [confirmCancel, setConfirmCancel] = useState(false)

  const { register, handleSubmit, control, watch, setError, formState: { errors } } = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema), defaultValues: initial(rental),
  })
  const [customerId, variantId, rentText, discountText] = watch(['customerId', 'variantId', 'rent', 'discount'])
  const variant = (variants.data ?? []).find((v) => v.id === variantId)
  const net = Math.max(0, (parseMoney(rentText) ?? 0) - (parseMoney(discountText) ?? 0))
  const canCancel = rental && rental.status !== 'cancelled' && rental.paymentCount === 0
    && rental.returnedQuantity + rental.damagedQuantity + rental.missingQuantity === 0
  const pending = save.isPending || newCustomer.isPending

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return
    // Fast feedback; the database enforces the same rule under a lock.
    if (variant && !rental && Number(values.quantity) > variant.availableQuantity) {
      setError('quantity', { message: `Only ${variant.availableQuantity} available.` })
      return
    }
    try {
      let id = values.customerId
      if (id === NEW_CUSTOMER) {
        if (!createdCustomerId.current) createdCustomerId.current = await newCustomer.mutateAsync(toNewCustomerInput(values))
        id = createdCustomerId.current
      }
      await save.mutateAsync(toRentalInput(values, id))
      onSaved()
    } catch { /* shown via save.isError / newCustomer.isError */ }
  })

  const doCancel = async () => {
    if (!rental || cancel.isPending) return
    try { await cancel.mutateAsync(rental.id); onSaved() } catch { /* shown via cancel.isError */ }
  }

  const activeVariants = (variants.data ?? []).filter((v) => v.status === 'active' || v.id === rental?.variantId)

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField id="rt-customer" label="Customer" error={errors.customerId?.message} className="md:col-span-2">
        <FormSelect control={control} name="customerId" {...fieldA11y('rt-customer', errors.customerId?.message)} data-autofocus className={inputClass} disabled={customers.isLoading}>
          <option value="">Choose a customer</option>
          <option value={NEW_CUSTOMER}>＋ New customer…</option>
          {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.mobile ? ` · ${c.mobile}` : ''}</option>)}
        </FormSelect>
      </FormField>
      {customerId === NEW_CUSTOMER && (
        <>
          <FormField id="rt-new-name" label="Customer name" error={errors.newName?.message}>
            <input {...register('newName')} {...fieldA11y('rt-new-name', errors.newName?.message)} autoComplete="off" className={inputClass} />
          </FormField>
          <FormField id="rt-new-mobile" label="Mobile (optional)" error={errors.newMobile?.message} hint="10 digits.">
            <input {...register('newMobile')} {...fieldA11y('rt-new-mobile', errors.newMobile?.message, true)} inputMode="numeric" autoComplete="off" className={inputClass} />
          </FormField>
          <FormField id="rt-new-address" label="Address (optional)" error={errors.newAddress?.message} className="md:col-span-2">
            <input {...register('newAddress')} {...fieldA11y('rt-new-address', errors.newAddress?.message)} autoComplete="off" className={inputClass} />
          </FormField>
        </>
      )}
      {customers.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">Could not load customers. You can still add a new one.</p>}

      <FormField id="rt-variant" label="Product and size" error={errors.variantId?.message}
        hint={variant ? `${variant.availableQuantity} available of ${variant.totalQuantity} owned.` : rental ? 'The size cannot change on an existing rental.' : undefined}>
        <FormSelect control={control} name="variantId" {...fieldA11y('rt-variant', errors.variantId?.message, true)} className={inputClass} disabled={variants.isLoading || Boolean(rental)}>
          <option value="">Choose a size</option>
          {activeVariants.map((v) => <option key={v.id} value={v.id}>{v.productName} · {variantLabel(v.lengthFt)} ({v.availableQuantity} available)</option>)}
        </FormSelect>
      </FormField>
      <FormField id="rt-quantity" label="Quantity" error={errors.quantity?.message}>
        <input {...register('quantity')} {...fieldA11y('rt-quantity', errors.quantity?.message)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      {variants.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">Could not load sizes. Close this and try again.</p>}
      {!variants.isLoading && !variants.isError && activeVariants.length === 0 && <p className="rounded-md bg-gold-soft px-3 py-2 text-sm text-primary md:col-span-2">Add a product and a size in the Products and Stock tabs first.</p>}

      <FormField id="rt-date" label="Rental date" error={errors.rentalDate?.message}>
        <FormDatePicker control={control} name="rentalDate" {...fieldA11y('rt-date', errors.rentalDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="rt-expected" label="Expected return date (optional)" error={errors.expectedReturnDate?.message} hint="Used to flag overdue returns.">
        <FormDatePicker control={control} name="expectedReturnDate" {...fieldA11y('rt-expected', errors.expectedReturnDate?.message, true)} className={inputClass} />
      </FormField>

      <FormField id="rt-rent" label="Rent (₹)" error={errors.rent?.message} hint="The amount you charge for this rental. You can change it when the sheets come back.">
        <input {...register('rent')} {...fieldA11y('rt-rent', errors.rent?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="rt-discount" label="Discount (₹, optional)" error={errors.discount?.message}>
        <input {...register('discount')} {...fieldA11y('rt-discount', errors.discount?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <p className="rounded-md bg-canvas px-3 py-2 text-sm md:col-span-2" aria-live="polite">Net rent: <strong className="tabular-nums">{formatINR(net)}</strong> <span className="text-muted">(rent minus discount)</span></p>

      {!rental && (
        <>
          <FormField id="rt-advance" label="Advance paid (₹, optional)" error={errors.advance?.message} hint="Recorded as a payment in Finance on the rental date.">
            <input {...register('advance')} {...fieldA11y('rt-advance', errors.advance?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
          </FormField>
          <FormField id="rt-method" label="Payment method (optional)" error={errors.paymentMethod?.message}>
            <FormSelect control={control} name="paymentMethod" {...fieldA11y('rt-method', errors.paymentMethod?.message)} className={inputClass}>
              <option value="">Not specified</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </FormSelect>
          </FormField>
        </>
      )}
      <FormField id="rt-notes" label="Notes (optional)" error={errors.notes?.message} className="md:col-span-2">
        <input {...register('notes')} {...fieldA11y('rt-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>

      {newCustomer.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{sheetSubmitError(newCustomer.error, 'customer')}</p>}
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{sheetSubmitError(save.error, 'rental')}</p>}
      {cancel.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{sheetSubmitError(cancel.error, 'rental')}</p>}

      {canCancel && (
        <div className="rounded-md border border-line px-3 py-2 text-sm md:col-span-2">
          {confirmCancel ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Cancel this rental? The sheets become available again.</span>
              <span className="flex gap-2">
                <button type="button" className={buttonSecondary} onClick={() => setConfirmCancel(false)}>Keep rental</button>
                <button type="button" className={buttonSecondary} disabled={cancel.isPending} onClick={() => void doCancel()}>{cancel.isPending ? 'Cancelling…' : 'Yes, cancel rental'}</button>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">Made by mistake? A rental with no returns or payments can be cancelled.</span>
              <button type="button" className={buttonSecondary} onClick={() => setConfirmCancel(true)}>Cancel rental</button>
            </div>
          )}
        </div>
      )}

      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Close</button>
        <button type="submit" className={buttonPrimary} disabled={pending}>{pending ? 'Saving…' : 'Save rental'}</button>
      </DialogActions>
    </form>
  )
}

export function RentalDialog({ open, rental, onClose, onSaved }: { open: boolean; rental?: SheetRental; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={rental ? 'Edit rental' : 'New rental'}>
      <Form rental={rental} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
