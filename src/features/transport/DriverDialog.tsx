import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import type { Driver } from '../../types/transport'
import { useSaveDriver } from './hooks'
import { DRIVER_STATUS_LABELS } from './labels'
import { transportSubmitError } from './submitError'
import { defaultDriverValues, driverFormSchema, toDriverInput, type DriverFormValues } from './transportForms'
import { FormSelect } from '../../components/forms/Select'

const initial = (d?: Driver): DriverFormValues =>
  d ? { name: d.name, mobile: d.mobile ?? '', address: d.address ?? '', status: d.status, notes: d.notes ?? '' } : defaultDriverValues()

function Form({ driver, onClose, onSaved }: { driver?: Driver; onClose: () => void; onSaved: () => void }) {
  const save = useSaveDriver(driver?.id)
  const { register, handleSubmit, control, formState: { errors } } = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema), defaultValues: initial(driver),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toDriverInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="dr-name" label="Driver name" error={errors.name?.message}>
        <input {...register('name')} {...fieldA11y('dr-name', errors.name?.message)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="dr-mobile" label="Mobile (optional)" error={errors.mobile?.message} hint="10 digits.">
        <input {...register('mobile')} {...fieldA11y('dr-mobile', errors.mobile?.message, true)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="dr-address" label="Address (optional)" error={errors.address?.message}>
        <input {...register('address')} {...fieldA11y('dr-address', errors.address?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="dr-status" label="Status" error={errors.status?.message} hint="Inactive drivers can be hidden from trip pickers later.">
        <FormSelect control={control} name="status" {...fieldA11y('dr-status', errors.status?.message, true)} className={inputClass}>
          {(['active', 'inactive'] as const).map((s) => <option key={s} value={s}>{DRIVER_STATUS_LABELS[s]}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="dr-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('dr-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{transportSubmitError(save.error, 'driver')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save driver'}</button>
      </DialogActions>
    </form>
  )
}

export function DriverDialog({ open, driver, onClose, onSaved }: { open: boolean; driver?: Driver; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={driver ? 'Edit driver' : 'Add driver'}>
      <Form driver={driver} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
