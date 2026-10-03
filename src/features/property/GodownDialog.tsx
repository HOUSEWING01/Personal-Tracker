import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { FormDatePicker } from '../../components/forms/DatePicker'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import type { PropertyOverview, Tenant } from '../../types/property'
import { useSaveGodown } from './hooks'
import { defaultGodownValues, godownFormSchema, toGodownInput, type GodownFormValues } from './propertyForms'
import { submitError } from './submitError'

export type GodownMode = 'add' | 'edit' | 'relet'
const TITLES: Record<GodownMode, string> = { add: 'Add godown', edit: 'Edit godown', relet: 'New tenant' }

function initial(mode: GodownMode, property?: PropertyOverview, tenant?: Tenant | null): GodownFormValues {
  const base = defaultGodownValues()
  if (!property) return base
  const common = { ...base, monthlyRent: (property.monthlyRentPaise / 100).toFixed(2), address: property.address ?? '' }
  if (mode === 'relet') return common
  return { ...common, name: tenant?.name ?? property.name, mobile: tenant?.mobile ?? '', rentalStartDate: tenant?.rentalStartDate ?? base.rentalStartDate }
}

function Form({ mode, property, tenant, onClose, onSaved }: {
  mode: GodownMode; property?: PropertyOverview; tenant?: Tenant | null; onClose: () => void; onSaved: (id: string) => void
}) {
  const save = useSaveGodown(mode, property, tenant)
  const { register, handleSubmit, control, formState: { errors } } = useForm<GodownFormValues>({
    resolver: zodResolver(godownFormSchema), defaultValues: initial(mode, property, tenant),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { onSaved(await save.mutateAsync(toGodownInput(values))) } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="gd-name" label="Tenant name" error={errors.name?.message} hint="Godowns are listed by their tenant’s name." className="col-span-2">
        <input {...register('name')} {...fieldA11y('gd-name', errors.name?.message, true)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="gd-rent" label="Monthly rent (₹)" error={errors.monthlyRent?.message}
        hint={mode === 'edit' ? 'A new rent applies to months not yet created.' : undefined}>
        <input {...register('monthlyRent')} {...fieldA11y('gd-rent', errors.monthlyRent?.message, !!(mode === 'edit'))} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="gd-start" label="Rental start date" error={errors.rentalStartDate?.message} hint="The first month’s rent is due one month after this date.">
        <FormDatePicker control={control} name="rentalStartDate" {...fieldA11y('gd-start', errors.rentalStartDate?.message, true)} className={inputClass} />
      </FormField>
      {mode !== 'edit' && (
        <FormField id="gd-advance" label="Advance received (₹, optional)" error={errors.advance?.message} hint="Recorded on the start date.">
          <input {...register('advance')} {...fieldA11y('gd-advance', errors.advance?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
        </FormField>
      )}
      <FormField id="gd-mobile" label="Mobile (optional)" error={errors.mobile?.message} hint="10 digits, no spaces.">
        <input {...register('mobile')} {...fieldA11y('gd-mobile', errors.mobile?.message, true)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="gd-address" label="Godown location (optional)"  error={errors.address?.message} className="col-span-2">
        <input {...register('address')} {...fieldA11y('gd-address', errors.address?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{submitError(save.error, 'godown')} Press Save again to retry. Anything already saved is not repeated.</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save godown'}</button>
      </DialogActions>
    </form>
  )
}

export function GodownDialog({ open, mode, property, tenant, onClose, onSaved }: {
  open: boolean; mode: GodownMode; property?: PropertyOverview; tenant?: Tenant | null; onClose: () => void; onSaved: (id: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={TITLES[mode]}>
      <Form mode={mode} property={property} tenant={tenant} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
