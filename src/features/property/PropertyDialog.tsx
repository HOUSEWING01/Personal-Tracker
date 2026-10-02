import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { PROPERTY_TYPES, type PropertyOverview } from '../../types/property'
import { useSaveProperty } from './hooks'
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS } from './labels'
import { defaultPropertyValues, propertyFormSchema, toPropertyInput, type PropertyFormValues } from './propertyForms'
import { submitError } from './submitError'

function initial(p?: PropertyOverview): PropertyFormValues {
  if (!p) return defaultPropertyValues()
  return {
    name: p.name, type: p.type, status: p.status, monthlyRent: (p.monthlyRentPaise / 100).toFixed(2),
    address: p.address ?? '', description: p.description ?? '',
  }
}

function Form({ property, onClose, onSaved }: { property?: PropertyOverview; onClose: () => void; onSaved: (id: string) => void }) {
  const save = useSaveProperty(property?.id)
  const { register, handleSubmit, formState: { errors } } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema), defaultValues: initial(property),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { onSaved(await save.mutateAsync(toPropertyInput(values))) } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField id="pr-name" label="Property name" error={errors.name?.message} className="md:col-span-2">
        <input {...register('name')} {...fieldA11y('pr-name', errors.name?.message)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="pr-type" label="Type" error={errors.type?.message}>
        <select {...register('type')} {...fieldA11y('pr-type', errors.type?.message)} className={inputClass}>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
        </select>
      </FormField>
      <FormField id="pr-rent" label="Monthly rent (₹)" error={errors.monthlyRent?.message}
        hint={property ? 'A new rent applies to months not yet created. Past months keep their rent.' : 'Up to 2 decimals.'}>
        <input {...register('monthlyRent')} {...fieldA11y('pr-rent', errors.monthlyRent?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="pr-status" label="Status" error={errors.status?.message} hint="Inactive properties stop creating new monthly rent.">
        <select {...register('status')} {...fieldA11y('pr-status', errors.status?.message, true)} className={inputClass}>
          {(['active', 'inactive'] as const).map((s) => <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>)}
        </select>
      </FormField>
      <FormField id="pr-address" label="Address (optional)" error={errors.address?.message}>
        <input {...register('address')} {...fieldA11y('pr-address', errors.address?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="pr-desc" label="Description (optional)" error={errors.description?.message} className="md:col-span-2">
        <input {...register('description')} {...fieldA11y('pr-desc', errors.description?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{submitError(save.error, 'property')}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save property'}</button>
      </div>
    </form>
  )
}

export function PropertyDialog({ open, property, onClose, onSaved }: {
  open: boolean; property?: PropertyOverview; onClose: () => void; onSaved: (id: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={property ? 'Edit property' : 'Add property'}>
      <Form property={property} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
