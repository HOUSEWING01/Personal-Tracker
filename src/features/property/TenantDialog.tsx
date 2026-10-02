import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import type { Tenant } from '../../types/property'
import { useSaveTenant } from './hooks'
import { defaultTenantValues, tenantFormSchema, toTenantInput, type TenantFormValues } from './propertyForms'
import { submitError } from './submitError'
import { FormDatePicker } from '../../components/forms/DatePicker'

function initial(t: Tenant | null): TenantFormValues {
  if (!t) return defaultTenantValues()
  return {
    name: t.name, mobile: t.mobile ?? '', address: t.address ?? '', notes: t.notes ?? '',
    rentalStartDate: t.rentalStartDate, rentalEndDate: t.rentalEndDate ?? '',
  }
}

function Form({ propertyId, tenant, onClose, onSaved }: { propertyId: string; tenant: Tenant | null; onClose: () => void; onSaved: () => void }) {
  const save = useSaveTenant(propertyId)
  const { register, handleSubmit, control, formState: { errors } } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema), defaultValues: initial(tenant),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toTenantInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField id="tn-name" label="Tenant name" error={errors.name?.message}>
        <input {...register('name')} {...fieldA11y('tn-name', errors.name?.message)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="tn-mobile" label="Mobile (optional)" error={errors.mobile?.message} hint="10 digits, no spaces.">
        <input {...register('mobile')} {...fieldA11y('tn-mobile', errors.mobile?.message, true)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="tn-start" label="Rental start date" error={errors.rentalStartDate?.message} hint="Rent is created from this month.">
        <FormDatePicker control={control} name="rentalStartDate" {...fieldA11y('tn-start', errors.rentalStartDate?.message, true)} className={inputClass} />
      </FormField>
      <FormField id="tn-end" label="Rental end date (optional)" error={errors.rentalEndDate?.message} hint="Leave empty while the tenancy continues.">
        <FormDatePicker control={control} name="rentalEndDate" {...fieldA11y('tn-end', errors.rentalEndDate?.message, true)} className={inputClass} />
      </FormField>
      <FormField id="tn-address" label="Address (optional)" error={errors.address?.message} className="md:col-span-2">
        <input {...register('address')} {...fieldA11y('tn-address', errors.address?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="tn-notes" label="Notes (optional)" error={errors.notes?.message} className="md:col-span-2">
        <input {...register('notes')} {...fieldA11y('tn-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{submitError(save.error, 'tenant')}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save tenant'}</button>
      </div>
    </form>
  )
}

export function TenantDialog({ open, propertyId, tenant, onClose, onSaved }: {
  open: boolean; propertyId: string; tenant: Tenant | null; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={tenant ? 'Edit tenant' : 'Add tenant'}>
      <Form propertyId={propertyId} tenant={tenant} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
