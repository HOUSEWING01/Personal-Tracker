import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatINR } from '../../lib/money'
import { PAYMENT_METHODS } from '../finance/labels'
import { useRecordRentPayment } from './hooks'
import { formatPeriod } from './propertyEngine'
import { defaultRentPaymentValues, makeRentPaymentSchema, toRentPaymentInput, type RentPaymentFormValues } from './propertyForms'
import { submitError } from './submitError'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function Form({ propertyId, period, outstandingPaise, onClose, onSaved }: {
  propertyId: string; period: string; outstandingPaise: number; onClose: () => void; onSaved: () => void
}) {
  const record = useRecordRentPayment(propertyId)
  const schema = useMemo(() => makeRentPaymentSchema(outstandingPaise), [outstandingPaise])
  const { register, handleSubmit, control, formState: { errors } } = useForm<RentPaymentFormValues>({
    resolver: zodResolver(schema), defaultValues: defaultRentPaymentValues(outstandingPaise),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (record.isPending) return
    try { await record.mutateAsync({ period, ...toRentPaymentInput(values) }); onSaved() } catch { /* shown via record.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <p className="text-sm text-muted md:col-span-2">Outstanding for {formatPeriod(period)}: <strong className="text-ink">{formatINR(outstandingPaise)}</strong></p>
      <FormField id="rp-amount" label="Amount (₹)" error={errors.amount?.message} hint="Part payments are fine.">
        <input {...register('amount')} {...fieldA11y('rp-amount', errors.amount?.message, true)} data-autofocus inputMode="decimal" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="rp-date" label="Payment date" error={errors.paymentDate?.message}>
        <FormDatePicker control={control} name="paymentDate" {...fieldA11y('rp-date', errors.paymentDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="rp-method" label="Payment method (optional)" error={errors.paymentMethod?.message}>
        <FormSelect control={control} name="paymentMethod" {...fieldA11y('rp-method', errors.paymentMethod?.message)} className={inputClass}>
          <option value="">Not specified</option>
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="rp-notes" label="Notes (optional)" error={errors.notes?.message}>
        <input {...register('notes')} {...fieldA11y('rp-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <p className="text-xs text-muted md:col-span-2">Saving also adds this payment to Finance → Transactions.</p>
      {record.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{submitError(record.error, 'payment')}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={record.isPending}>{record.isPending ? 'Saving…' : 'Record payment'}</button>
      </div>
    </form>
  )
}

export function RentPaymentDialog({ open, propertyId, period, outstandingPaise, onClose, onSaved }: {
  open: boolean; propertyId: string; period: string; outstandingPaise: number; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Record rent payment">
      <Form propertyId={propertyId} period={period} outstandingPaise={outstandingPaise} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
