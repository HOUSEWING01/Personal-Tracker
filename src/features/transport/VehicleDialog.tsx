import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatINR } from '../../lib/money'
import { VEHICLE_STATUSES, type Vehicle } from '../../types/transport'
import { parseMoney } from '../property/propertyForms'
import { useSaveVehicle } from './hooks'
import { VEHICLE_STATUS_LABELS } from './labels'
import { transportSubmitError } from './submitError'
import { vehicleTotalInvestmentPaise } from './transportEngine'
import { defaultVehicleValues, toVehicleInput, vehicleFormSchema, type VehicleFormValues } from './transportForms'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function initial(v?: Vehicle): VehicleFormValues {
  if (!v) return defaultVehicleValues()
  return {
    name: v.name, registrationNumber: v.registrationNumber,
    purchasePrice: v.purchasePricePaise ? (v.purchasePricePaise / 100).toFixed(2) : '',
    purchaseDate: v.purchaseDate,
    containerPrice: v.containerPricePaise ? (v.containerPricePaise / 100).toFixed(2) : '',
    containerDetails: v.containerDetails ?? '', status: v.status, notes: v.notes ?? '',
  }
}

/** Shows the derived total while typing; blank or invalid parts count as zero here (the schema reports the error). */
function livePaise(s: string): number {
  const p = s.trim() === '' ? 0 : parseMoney(s)
  return p !== null && p > 0 ? p : 0
}

function Form({ vehicle, onClose, onSaved }: { vehicle?: Vehicle; onClose: () => void; onSaved: () => void }) {
  const save = useSaveVehicle(vehicle?.id)
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema), defaultValues: initial(vehicle),
  })
  const [purchase, container] = watch(['purchasePrice', 'containerPrice'])
  const total = vehicleTotalInvestmentPaise({ purchasePricePaise: livePaise(purchase), containerPricePaise: livePaise(container) })

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toVehicleInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField id="vh-name" label="Vehicle name" error={errors.name?.message}>
        <input {...register('name')} {...fieldA11y('vh-name', errors.name?.message)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="vh-reg" label="Registration number" error={errors.registrationNumber?.message} hint="For example TN 38 AB 1234.">
        <input {...register('registrationNumber')} {...fieldA11y('vh-reg', errors.registrationNumber?.message, true)} autoComplete="off" autoCapitalize="characters" className={inputClass} />
      </FormField>
      <FormField id="vh-price" label="Purchase price (₹)" error={errors.purchasePrice?.message} hint="Leave blank if unknown.">
        <input {...register('purchasePrice')} {...fieldA11y('vh-price', errors.purchasePrice?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="vh-date" label="Purchase date" error={errors.purchaseDate?.message} hint="Finance records the investment on this date.">
        <FormDatePicker control={control} name="purchaseDate" {...fieldA11y('vh-date', errors.purchaseDate?.message, true)} className={inputClass} />
      </FormField>
      <FormField id="vh-cprice" label="Container price (₹)" error={errors.containerPrice?.message} hint="Leave blank if none.">
        <input {...register('containerPrice')} {...fieldA11y('vh-cprice', errors.containerPrice?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="vh-cdetails" label="Container details (optional)" error={errors.containerDetails?.message}>
        <input {...register('containerDetails')} {...fieldA11y('vh-cdetails', errors.containerDetails?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <div className="rounded-md bg-canvas px-3 py-2 text-sm md:col-span-2" aria-live="polite">
        <span className="text-muted">Total investment (purchase + container): </span>
        <span className="font-medium tabular-nums">{formatINR(total)}</span>
        <p className="mt-1 text-xs text-muted">Saving records the purchase price and the container price in Finance as investments. Editing a price later updates those entries.</p>
      </div>
      <FormField id="vh-status" label="Status" error={errors.status?.message}>
        <FormSelect control={control} name="status" {...fieldA11y('vh-status', errors.status?.message)} className={inputClass}>
          {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="vh-notes" label="Notes (optional)" error={errors.notes?.message}>
        <input {...register('notes')} {...fieldA11y('vh-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{transportSubmitError(save.error, 'vehicle')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save vehicle'}</button>
      </DialogActions>
    </form>
  )
}

export function VehicleDialog({ open, vehicle, onClose, onSaved }: {
  open: boolean; vehicle?: Vehicle; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={vehicle ? 'Edit vehicle' : 'Add vehicle'}>
      <Form vehicle={vehicle} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
