import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { TRIP_STATUSES, type Trip } from '../../types/transport'
import { parseMoney } from '../property/propertyForms'
import { useSaveTrip, useTripOptions } from './hooks'
import { TRIP_STATUS_LABELS } from './labels'
import { transportSubmitError } from './submitError'
import { tripOperatingProfitPaise, tripRevenuePaise } from './transportEngine'
import { defaultTripValues, parseKmHundredths, toTripInput, tripFormSchema, type TripFormValues } from './transportForms'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function initial(t?: Trip): TripFormValues {
  if (!t) return defaultTripValues(todayIST())
  return {
    vehicleId: t.vehicleId, driverId: t.driverId, customerId: t.customerId,
    fromLocation: t.fromLocation, toLocation: t.toLocation, distanceKm: String(t.distanceKm),
    ratePerKm: (t.ratePerKmPaise / 100).toFixed(2),
    driverPayment: t.driverPaymentPaise ? (t.driverPaymentPaise / 100).toFixed(2) : '',
    tripDate: t.tripDate, status: t.status, notes: t.notes ?? '',
  }
}

/** Live preview while typing; blank or invalid parts count as zero here (the schema reports the error). */
function livePreview(distance: string, rate: string, driver: string, fuelPaise: number, tollPaise: number) {
  const km = parseKmHundredths(distance)
  const ratePaise = parseMoney(rate)
  const driverPaise = driver.trim() === '' ? 0 : parseMoney(driver)
  const parts = {
    distanceKm: km !== null ? km / 100 : 0,
    ratePerKmPaise: ratePaise !== null && ratePaise > 0 ? ratePaise : 0,
    driverPaymentPaise: driverPaise !== null && driverPaise > 0 ? driverPaise : 0,
  }
  return { revenue: tripRevenuePaise(parts), profit: tripOperatingProfitPaise({ ...parts, fuelPaise, tollPaise }) }
}

function Form({ trip, onClose, onSaved }: { trip?: Trip; onClose: () => void; onSaved: () => void }) {
  const save = useSaveTrip(trip?.id)
  const options = useTripOptions()
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema), defaultValues: initial(trip),
  })
  const [distance, rate, driverPay, status] = watch(['distanceKm', 'ratePerKm', 'driverPayment', 'status'])
  const { revenue, profit } = livePreview(distance, rate, driverPay, trip?.fuelPaise ?? 0, trip?.tollPaise ?? 0)

  // New trips list active vehicles/drivers only; an old trip keeps showing its own vehicle/driver even if now inactive.
  const vehicles = (options.data?.vehicles ?? []).filter((v) => v.status === 'active' || v.id === trip?.vehicleId)
  const drivers = (options.data?.drivers ?? []).filter((d) => d.status === 'active' || d.id === trip?.driverId)
  const customers = options.data?.customers ?? []

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toTripInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  if (options.isError) {
    return (
      <div role="alert" className="py-6 text-center">
        <p className="text-sm font-medium">Could not load vehicles, drivers and customers</p>
        <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => void options.refetch()}>Try again</button>
      </div>
    )
  }
  if (options.isLoading) return <p className="py-10 text-center text-sm text-muted" role="status">Loading…</p>

  const missing = vehicles.length === 0 ? 'Add an active vehicle first (Transport → Vehicles).'
    : drivers.length === 0 ? 'Add an active driver first (Transport → Drivers).'
    : customers.length === 0 ? 'Add a customer first (Transport → Customers).' : null
  if (missing && !trip) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm">{missing}</p>
        <button type="button" className={`${buttonSecondary} mt-4`} onClick={onClose}>Close</button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="tr-vehicle" label="Vehicle" error={errors.vehicleId?.message}>
        <FormSelect control={control} name="vehicleId" {...fieldA11y('tr-vehicle', errors.vehicleId?.message)} data-autofocus className={inputClass}>
          <option value="">Choose a vehicle</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
        </FormSelect>
      </FormField>
      <FormField id="tr-driver" label="Driver" error={errors.driverId?.message}>
        <FormSelect control={control} name="driverId" {...fieldA11y('tr-driver', errors.driverId?.message)} className={inputClass}>
          <option value="">Choose a driver</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="tr-customer" label="Customer" error={errors.customerId?.message} className="col-span-2">
        <FormSelect control={control} name="customerId" {...fieldA11y('tr-customer', errors.customerId?.message)} className={inputClass}>
          <option value="">Choose a customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.mobile ? ` (${c.mobile})` : ''}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="tr-from" label="From" error={errors.fromLocation?.message}>
        <input {...register('fromLocation')} {...fieldA11y('tr-from', errors.fromLocation?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="tr-to" label="To" error={errors.toLocation?.message}>
        <input {...register('toLocation')} {...fieldA11y('tr-to', errors.toLocation?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="tr-km" label="Distance (KM)" error={errors.distanceKm?.message}>
        <input {...register('distanceKm')} {...fieldA11y('tr-km', errors.distanceKm?.message)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      <FormField id="tr-rate" label="Rate per KM (₹)" error={errors.ratePerKm?.message}>
        <input {...register('ratePerKm')} {...fieldA11y('tr-rate', errors.ratePerKm?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="tr-driverpay" label="Driver payment (₹)" error={errors.driverPayment?.message} hint="Leave blank if none.">
        <input {...register('driverPayment')} {...fieldA11y('tr-driverpay', errors.driverPayment?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="tr-date" label="Trip date" error={errors.tripDate?.message}>
        <FormDatePicker control={control} name="tripDate" {...fieldA11y('tr-date', errors.tripDate?.message)} className={inputClass} />
      </FormField>
      <div className="rounded-md bg-canvas px-3 py-2 text-sm col-span-2" aria-live="polite">
        <div><span className="text-muted">Revenue (distance × rate): </span><span className="font-medium tabular-nums">{formatINR(revenue)}</span></div>
        <div>
          <span className="text-muted">Operating profit (after driver payment, fuel and toll): </span>
          <span className="font-medium tabular-nums">{profit < 0 ? '−' : ''}{formatINR(Math.abs(profit))}</span>
        </div>
        {trip && <div className="text-xs text-muted">Fuel on this trip {formatINR(trip.fuelPaise)}, tolls {formatINR(trip.tollPaise)} (add them in the Fuel and Tolls tabs).</div>}
        <p className="mt-1 text-xs text-muted">
          {status === 'completed'
            ? 'Saving records the revenue as income and the driver payment as an expense in Finance. Editing the trip later updates those entries.'
            : 'Revenue and driver payment are recorded in Finance only when the trip is Completed.'}
        </p>
      </div>
      <FormField id="tr-status" label="Status" error={errors.status?.message}>
        <FormSelect control={control} name="status" {...fieldA11y('tr-status', errors.status?.message)} className={inputClass}>
          {TRIP_STATUSES.map((s) => <option key={s} value={s}>{TRIP_STATUS_LABELS[s]}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="tr-notes" label="Notes (optional)" error={errors.notes?.message}>
        <input {...register('notes')} {...fieldA11y('tr-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{transportSubmitError(save.error, 'trip')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save trip'}</button>
      </DialogActions>
    </form>
  )
}

export function TripDialog({ open, trip, onClose, onSaved }: {
  open: boolean; trip?: Trip; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={trip ? 'Edit trip' : 'Add trip'}>
      <Form trip={trip} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
