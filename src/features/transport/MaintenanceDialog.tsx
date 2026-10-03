import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import { MAINTENANCE_KINDS, type MaintenanceLog } from '../../types/transport'
import { useSaveMaintenance, useTripOptions } from './hooks'
import { MAINTENANCE_KIND_LABELS } from './labels'
import { transportSubmitError } from './submitError'
import { defaultMaintenanceValues, maintenanceFormSchema, toMaintenanceInput, type MaintenanceFormValues } from './transportForms'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function initial(m?: MaintenanceLog): MaintenanceFormValues {
  if (!m) return defaultMaintenanceValues(todayIST())
  return {
    vehicleId: m.vehicleId, serviceDate: m.serviceDate, kind: m.kind, vendor: m.vendor ?? '', amount: (m.amountPaise / 100).toFixed(2),
    odometerKm: m.odometerKm === null ? '' : String(m.odometerKm), nextDueDate: m.nextDueDate ?? '', notes: m.notes ?? '',
  }
}

function Form({ entry, onClose, onSaved }: { entry?: MaintenanceLog; onClose: () => void; onSaved: () => void }) {
  const save = useSaveMaintenance(entry?.id)
  const options = useTripOptions()
  const { register, handleSubmit, control, formState: { errors } } = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema), defaultValues: initial(entry),
  })

  // New entries list active vehicles only; an old entry keeps showing its own vehicle even if now inactive.
  const vehicles = (options.data?.vehicles ?? []).filter((v) => v.status === 'active' || v.id === entry?.vehicleId)

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toMaintenanceInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  if (options.isError) {
    return (
      <div role="alert" className="py-6 text-center">
        <p className="text-sm font-medium">Could not load vehicles</p>
        <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => void options.refetch()}>Try again</button>
      </div>
    )
  }
  if (options.isLoading) return <p className="py-10 text-center text-sm text-muted" role="status">Loading…</p>
  if (vehicles.length === 0 && !entry) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm">Add an active vehicle first (Transport → Vehicles).</p>
        <button type="button" className={`${buttonSecondary} mt-4`} onClick={onClose}>Close</button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="mt-vehicle" label="Vehicle" error={errors.vehicleId?.message}>
        <FormSelect control={control} name="vehicleId" {...fieldA11y('mt-vehicle', errors.vehicleId?.message)} data-autofocus className={inputClass}>
          <option value="">Choose a vehicle</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
        </FormSelect>
      </FormField>
      <FormField id="mt-date" label="Date" error={errors.serviceDate?.message}>
        <FormDatePicker control={control} name="serviceDate" {...fieldA11y('mt-date', errors.serviceDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="mt-kind" label="Type" error={errors.kind?.message}>
        <FormSelect control={control} name="kind" {...fieldA11y('mt-kind', errors.kind?.message)} className={inputClass}>
          {MAINTENANCE_KINDS.map((k) => <option key={k} value={k}>{MAINTENANCE_KIND_LABELS[k]}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="mt-amount" label="Amount (₹)" error={errors.amount?.message}>
        <input {...register('amount')} {...fieldA11y('mt-amount', errors.amount?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <div className="rounded-md bg-canvas px-3 py-2 text-xs text-muted col-span-2">
        Saving records the amount in Finance as an expense. Editing the entry later updates that entry. It counts against the vehicle's profit, not a single trip's.
      </div>
      <FormField id="mt-vendor" label="Garage / vendor (optional)" error={errors.vendor?.message}>
        <input {...register('vendor')} {...fieldA11y('mt-vendor', errors.vendor?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="mt-odo" label="Odometer (KM, optional)" error={errors.odometerKm?.message}>
        <input {...register('odometerKm')} {...fieldA11y('mt-odo', errors.odometerKm?.message)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="mt-due" label="Next due date (optional)" error={errors.nextDueDate?.message} hint="Shows a reminder as it nears, e.g. the next service or insurance renewal." className="col-span-2">
        <FormDatePicker control={control} name="nextDueDate" {...fieldA11y('mt-due', errors.nextDueDate?.message, true)} className={inputClass} />
      </FormField>
      <FormField id="mt-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('mt-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{transportSubmitError(save.error, 'maintenance entry')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save maintenance'}</button>
      </DialogActions>
    </form>
  )
}

export function MaintenanceDialog({ open, entry, onClose, onSaved }: {
  open: boolean; entry?: MaintenanceLog; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={entry ? 'Edit maintenance' : 'Add maintenance'}>
      <Form entry={entry} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
