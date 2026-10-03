import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { FuelLog } from '../../types/transport'
import { parseMoney } from '../property/propertyForms'
import { useSaveFuelLog, useTripChoices, useTripOptions } from './hooks'
import { transportSubmitError } from './submitError'
import { fuelTotalPaise } from './transportEngine'
import { defaultFuelValues, fuelFormSchema, parseKmHundredths, toFuelInput, type FuelFormValues } from './transportForms'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function initial(f?: FuelLog): FuelFormValues {
  if (!f) return defaultFuelValues(todayIST())
  return {
    vehicleId: f.vehicleId, tripId: f.tripId ?? '', fuelDate: f.fuelDate, litres: String(f.litres),
    pricePerLitre: (f.pricePerLitrePaise / 100).toFixed(2), odometerKm: f.odometerKm === null ? '' : String(f.odometerKm), notes: f.notes ?? '',
  }
}

function Form({ fuel, onClose, onSaved }: { fuel?: FuelLog; onClose: () => void; onSaved: () => void }) {
  const save = useSaveFuelLog(fuel?.id)
  const options = useTripOptions()
  const trips = useTripChoices()
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FuelFormValues>({
    resolver: zodResolver(fuelFormSchema), defaultValues: initial(fuel),
  })
  const [vehicleId, litres, price] = watch(['vehicleId', 'litres', 'pricePerLitre'])

  const l = parseKmHundredths(litres)
  const p = parseMoney(price)
  const total = l !== null && p !== null && p > 0 ? fuelTotalPaise({ litres: l / 100, pricePerLitrePaise: p }) : 0

  // New logs list active vehicles only; an old log keeps showing its own vehicle even if now inactive.
  const vehicles = (options.data?.vehicles ?? []).filter((v) => v.status === 'active' || v.id === fuel?.vehicleId)
  const tripsForVehicle = (trips.data ?? []).filter((t) => t.vehicleId === vehicleId)

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toFuelInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  if (options.isError || trips.isError) {
    return (
      <div role="alert" className="py-6 text-center">
        <p className="text-sm font-medium">Could not load vehicles and trips</p>
        <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => { void options.refetch(); void trips.refetch() }}>Try again</button>
      </div>
    )
  }
  if (options.isLoading || trips.isLoading) return <p className="py-10 text-center text-sm text-muted" role="status">Loading…</p>
  if (vehicles.length === 0 && !fuel) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm">Add an active vehicle first (Transport → Vehicles).</p>
        <button type="button" className={`${buttonSecondary} mt-4`} onClick={onClose}>Close</button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="fu-vehicle" label="Vehicle" error={errors.vehicleId?.message}>
        <FormSelect control={control} name="vehicleId" onValueChange={() => setValue('tripId', '')} {...fieldA11y('fu-vehicle', errors.vehicleId?.message)} data-autofocus className={inputClass}>
          <option value="">Choose a vehicle</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
        </FormSelect>
      </FormField>
      <FormField id="fu-date" label="Date" error={errors.fuelDate?.message}>
        <FormDatePicker control={control} name="fuelDate" {...fieldA11y('fu-date', errors.fuelDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="fu-litres" label="Litres" error={errors.litres?.message}>
        <input {...register('litres')} {...fieldA11y('fu-litres', errors.litres?.message)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      <FormField id="fu-price" label="Price per litre (₹)" error={errors.pricePerLitre?.message}>
        <input {...register('pricePerLitre')} {...fieldA11y('fu-price', errors.pricePerLitre?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <div className="rounded-md bg-canvas px-3 py-2 text-sm col-span-2" aria-live="polite">
        <span className="text-muted">Total (litres × price): </span>
        <span className="font-medium tabular-nums">{formatINR(total)}</span>
        <p className="mt-1 text-xs text-muted">Saving records the total in Finance as an expense. Editing the fuel log later updates that entry.</p>
      </div>
      <FormField id="fu-odo" label="Odometer (KM, optional)" error={errors.odometerKm?.message}>
        <input {...register('odometerKm')} {...fieldA11y('fu-odo', errors.odometerKm?.message)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="fu-trip" label="Trip (optional)" error={errors.tripId?.message} hint="Link this fuel to a trip so it counts in that trip's profit.">
        <FormSelect control={control} name="tripId" {...fieldA11y('fu-trip', errors.tripId?.message, true)} className={inputClass} disabled={!vehicleId}>
          <option value="">Not linked to a trip</option>
          {tripsForVehicle.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="fu-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('fu-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{transportSubmitError(save.error, 'fuel log')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save fuel'}</button>
      </DialogActions>
    </form>
  )
}

export function FuelDialog({ open, fuel, onClose, onSaved }: {
  open: boolean; fuel?: FuelLog; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={fuel ? 'Edit fuel' : 'Add fuel'}>
      <Form fuel={fuel} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
