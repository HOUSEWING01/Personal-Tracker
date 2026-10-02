import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import type { Toll } from '../../types/transport'
import { useSaveToll, useTripChoices } from './hooks'
import { transportSubmitError } from './submitError'
import { defaultTollValues, toTollInput, tollFormSchema, type TollFormValues } from './transportForms'

function initial(t?: Toll): TollFormValues {
  if (!t) return defaultTollValues(todayIST())
  return { tripId: t.tripId, tollDate: t.tollDate, amount: (t.amountPaise / 100).toFixed(2), location: t.location ?? '', notes: t.notes ?? '' }
}

function Form({ toll, onClose, onSaved }: { toll?: Toll; onClose: () => void; onSaved: () => void }) {
  const save = useSaveToll(toll?.id)
  const trips = useTripChoices()
  const { register, handleSubmit, formState: { errors } } = useForm<TollFormValues>({
    resolver: zodResolver(tollFormSchema), defaultValues: initial(toll),
  })

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toTollInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  if (trips.isError) {
    return (
      <div role="alert" className="py-6 text-center">
        <p className="text-sm font-medium">Could not load trips</p>
        <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => void trips.refetch()}>Try again</button>
      </div>
    )
  }
  if (trips.isLoading) return <p className="py-10 text-center text-sm text-muted" role="status">Loading…</p>
  if ((trips.data ?? []).length === 0 && !toll) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm">Add a trip first (Transport → Trips). A toll is recorded against a trip.</p>
        <button type="button" className={`${buttonSecondary} mt-4`} onClick={onClose}>Close</button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField id="tl-trip" label="Trip" error={errors.tripId?.message} className="md:col-span-2" hint="The toll is charged to this trip's vehicle.">
        <select {...register('tripId')} {...fieldA11y('tl-trip', errors.tripId?.message, true)} data-autofocus className={inputClass}>
          <option value="">Choose a trip</option>
          {(trips.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </FormField>
      <FormField id="tl-date" label="Date" error={errors.tollDate?.message}>
        <input type="date" {...register('tollDate')} {...fieldA11y('tl-date', errors.tollDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="tl-amount" label="Amount (₹)" error={errors.amount?.message}>
        <input {...register('amount')} {...fieldA11y('tl-amount', errors.amount?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="tl-location" label="Location (optional)" error={errors.location?.message}>
        <input {...register('location')} {...fieldA11y('tl-location', errors.location?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="tl-notes" label="Notes (optional)" error={errors.notes?.message}>
        <input {...register('notes')} {...fieldA11y('tl-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <p className="rounded-md bg-canvas px-3 py-2 text-xs text-muted md:col-span-2">Saving records the toll in Finance as an expense. Editing it later updates that entry.</p>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{transportSubmitError(save.error, 'toll')}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save toll'}</button>
      </div>
    </form>
  )
}

export function TollDialog({ open, toll, onClose, onSaved }: {
  open: boolean; toll?: Toll; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={toll ? 'Edit toll' : 'Add toll'}>
      <Form toll={toll} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
