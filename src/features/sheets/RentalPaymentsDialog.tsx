import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { SheetPayment, SheetRental } from '../../types/sheets'
import { PAYMENT_METHODS } from '../finance/labels'
import { useSaveSheetPayment, useSheetPayments } from './hooks'
import { netRentPaise, rentalOutstandingPaise, variantLabel } from './sheetEngine'
import { makeSheetPaymentSchema, toSheetPaymentInput, type SheetPaymentFormValues } from './sheetForms'
import { sheetSubmitError } from './submitError'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

const methodLabel = (k: string | null) => PAYMENT_METHODS.find((m) => m.value === k)?.label

function PaymentForm({ rental, editing, onSaved, onCancelEdit }: {
  rental: SheetRental; editing: SheetPayment | null; onSaved: () => void; onCancelEdit: () => void
}) {
  const save = useSaveSheetPayment(rental.id, editing?.id)
  // Most this payment can be: the outstanding rent, plus the old amount when editing.
  const maxPaise = rentalOutstandingPaise(rental) + (editing?.amountPaise ?? 0)
  const schema = useMemo(() => makeSheetPaymentSchema(maxPaise, rental.rentalDate), [maxPaise, rental.rentalDate])
  const { register, handleSubmit, control, formState: { errors } } = useForm<SheetPaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? { paymentDate: editing.paymentDate, amount: (editing.amountPaise / 100).toFixed(2), paymentMethod: editing.paymentMethod ?? '', notes: editing.notes ?? '' }
      : { paymentDate: todayIST(), amount: maxPaise > 0 ? (maxPaise / 100).toFixed(2) : '', paymentMethod: '', notes: '' },
  })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toSheetPaymentInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label={editing ? 'Edit payment' : 'Record payment'}>
      <FormField id="sp-amount" label="Amount (₹)" error={errors.amount?.message} hint="Part payments are fine.">
        <input {...register('amount')} {...fieldA11y('sp-amount', errors.amount?.message, true)} data-autofocus inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="sp-date" label="Payment date" error={errors.paymentDate?.message}>
        <FormDatePicker control={control} name="paymentDate" {...fieldA11y('sp-date', errors.paymentDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="sp-method" label="Payment method (optional)" error={errors.paymentMethod?.message}>
        <FormSelect control={control} name="paymentMethod" {...fieldA11y('sp-method', errors.paymentMethod?.message)} className={inputClass}>
          <option value="">Not specified</option>
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="sp-notes" label="Notes (optional)" error={errors.notes?.message}>
        <input {...register('notes')} {...fieldA11y('sp-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <p className="text-xs text-muted md:col-span-2">Saving also adds this to Finance → Transactions as a customer payment. Editing it later updates that entry.</p>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{sheetSubmitError(save.error, 'payment')}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        {editing && <button type="button" className={buttonSecondary} onClick={onCancelEdit}>Cancel edit</button>}
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Record payment'}</button>
      </div>
    </form>
  )
}

function Body({ rental }: { rental: SheetRental }) {
  const payments = useSheetPayments(rental.id)
  const [editing, setEditing] = useState<SheetPayment | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [saved, setSaved] = useState(false)
  const outstanding = rentalOutstandingPaise(rental)
  const canRecord = rental.status !== 'cancelled' && (outstanding > 0 || editing !== null)

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 rounded-md bg-canvas px-4 py-3 text-sm md:grid-cols-4">
        <div><dt className="text-xs text-muted">Rent</dt><dd className="font-medium tabular-nums">{formatINR(rental.rentPaise)}</dd></div>
        <div><dt className="text-xs text-muted">Discount</dt><dd className="font-medium tabular-nums">{formatINR(rental.discountPaise)}</dd></div>
        <div><dt className="text-xs text-muted">Paid</dt><dd className="font-medium tabular-nums">{formatINR(rental.paidPaise)}</dd></div>
        <div><dt className="text-xs text-muted">Outstanding</dt><dd className="font-medium tabular-nums">{formatINR(outstanding)}</dd></div>
      </dl>
      <p className="-mt-3 text-xs text-muted">Net rent {formatINR(netRentPaise(rental))}. To take more than that, raise the rent with Edit on the rental.</p>

      {canRecord ? (
        <section aria-labelledby="sp-form-title">
          <h3 id="sp-form-title" className="mb-3 text-sm font-medium">{editing ? `Edit payment of ${formatDate(editing.paymentDate)}` : 'Record a payment'}</h3>
          <PaymentForm
            key={`${editing?.id ?? 'new'}-${formKey}`} rental={rental} editing={editing}
            onSaved={() => { setEditing(null); setFormKey((k) => k + 1); setSaved(true) }}
            onCancelEdit={() => { setEditing(null); setSaved(false) }}
          />
        </section>
      ) : (
        <p className="rounded-md bg-canvas px-3 py-2 text-sm text-muted">{rental.status === 'cancelled' ? 'This rental is cancelled.' : 'Nothing outstanding. The rent is fully paid.'}</p>
      )}
      <p className="sr-only" role="status" aria-live="polite">{saved ? 'Payment saved.' : ''}</p>
      {saved && <p className="text-sm text-primary" aria-hidden>Payment saved.</p>}

      <section aria-labelledby="sp-history-title">
        <h3 id="sp-history-title" className="mb-2 text-sm font-medium">Payment history</h3>
        {payments.isError ? (
          <div role="alert" className="rounded-md border border-line px-4 py-4 text-center">
            <p className="text-sm font-medium">Could not load payments</p>
            <button type="button" className={`${buttonPrimary} mt-3`} onClick={() => void payments.refetch()}>Try again</button>
          </div>
        ) : payments.isLoading ? (
          <p className="py-4 text-center text-sm text-muted" role="status">Loading payments…</p>
        ) : (payments.data ?? []).length === 0 ? (
          <p className="rounded-md border border-line px-4 py-4 text-center text-sm text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {(payments.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{formatDate(p.paymentDate)}</span>
                  <div className="truncate text-xs text-muted">{[methodLabel(p.paymentMethod), p.notes].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-medium tabular-nums">{formatINR(p.amountPaise)}</span>
                  {rental.status !== 'cancelled' && (
                    <button type="button" className={buttonSecondary} aria-label={`Edit payment of ${formatDate(p.paymentDate)}`} onClick={() => { setEditing(p); setSaved(false) }}>Edit</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function RentalPaymentsDialog({ open, rental, onClose }: { open: boolean; rental?: SheetRental; onClose: () => void }) {
  return (
    <Dialog open={open && rental !== undefined} onClose={onClose} title={rental ? `Payments · ${rental.customerName} · ${rental.quantity} × ${variantLabel(rental.lengthFt)}` : 'Payments'}>
      {rental && <Body rental={rental} />}
    </Dialog>
  )
}
