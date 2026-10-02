import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatINR } from '../../lib/money'
import { useRecordAdvance } from './hooks'
import { ADVANCE_KIND_LABELS } from './labels'
import { defaultAdvanceValues, makeAdvanceSchema, toAdvanceInput, type AdvanceFormValues } from './propertyForms'
import { submitError } from './submitError'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function Form({ propertyId, remainingPaise, onClose, onSaved }: { propertyId: string; remainingPaise: number; onClose: () => void; onSaved: () => void }) {
  const record = useRecordAdvance(propertyId)
  const schema = useMemo(() => makeAdvanceSchema(remainingPaise), [remainingPaise])
  const { register, handleSubmit, control, formState: { errors } } = useForm<AdvanceFormValues>({
    resolver: zodResolver(schema), defaultValues: defaultAdvanceValues(),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (record.isPending) return
    try { await record.mutateAsync(toAdvanceInput(values)); onSaved() } catch { /* shown via record.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <p className="text-sm text-muted md:col-span-2">Advance remaining: <strong className="text-ink">{formatINR(remainingPaise)}</strong></p>
      <FormField id="ad-kind" label="Movement" error={errors.kind?.message}>
        <FormSelect control={control} name="kind" {...fieldA11y('ad-kind', errors.kind?.message)} data-autofocus className={inputClass}>
          {(['received', 'adjusted', 'returned'] as const).map((k) => <option key={k} value={k}>{ADVANCE_KIND_LABELS[k]}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="ad-amount" label="Amount (₹)" error={errors.amount?.message} hint="Up to 2 decimals.">
        <input {...register('amount')} {...fieldA11y('ad-amount', errors.amount?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="ad-date" label="Date" error={errors.date?.message}>
        <FormDatePicker control={control} name="date" {...fieldA11y('ad-date', errors.date?.message)} className={inputClass} />
      </FormField>
      <FormField id="ad-notes" label="Notes (optional)" error={errors.notes?.message}>
        <input {...register('notes')} {...fieldA11y('ad-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <p className="text-xs text-muted md:col-span-2">Received and returned entries are posted to Finance → Transactions as deposits: they count in cash flow, never in revenue or profit. Adjusted entries move no cash and are not posted.</p>
      {record.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{submitError(record.error, 'advance entry')}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={record.isPending}>{record.isPending ? 'Saving…' : 'Save entry'}</button>
      </div>
    </form>
  )
}

export function AdvanceDialog({ open, propertyId, remainingPaise, onClose, onSaved }: {
  open: boolean; propertyId: string; remainingPaise: number; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Advance entry">
      <Form propertyId={propertyId} remainingPaise={remainingPaise} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
