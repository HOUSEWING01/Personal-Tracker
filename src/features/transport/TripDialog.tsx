import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { TRIP_STATUSES, type Trip } from '../../types/transport'
import { parseMoney } from '../property/propertyForms'
import { useSaveTrip, useTripCosts, useTripOptions } from './hooks'
import { TRIP_STATUS_LABELS } from './labels'
import { transportSubmitError } from './submitError'
import { fuelTotalPaise, tripOperatingProfitPaise, tripRevenuePaise } from './transportEngine'
import { defaultTripValues, toTripInput, tripDistanceHundredths, tripFormSchema, type TripFormValues } from './transportForms'
import { parseKmHundredths } from './transportForms'
import type { TripCosts } from '../../services/transportService'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function initial(t?: Trip, c?: TripCosts): TripFormValues {
  if (!t) return defaultTripValues(todayIST())
  return {
    vehicleId: t.vehicleId, driverId: t.driverId, customerId: t.customerId,
    fromLocation: t.fromLocation, toLocation: t.toLocation,
    odometerStart: t.odometerStartKm === null ? '' : String(t.odometerStartKm), odometerEnd: t.odometerEndKm === null ? '' : String(t.odometerEndKm),
    distanceKm: t.odometerStartKm === null ? String(t.distanceKm) : '',
    ratePerKm: (t.ratePerKmPaise / 100).toFixed(2),
    driverPayment: t.driverPaymentPaise ? (t.driverPaymentPaise / 100).toFixed(2) : '',
    fuelLitres: c && c.fuelCount === 1 ? String(c.fuelLitres) : '',
    fuelPrice: c && c.fuelCount === 1 ? (c.fuelPricePaise / 100).toFixed(2) : '',
    tollAmount: c && c.tollCount === 1 ? (c.tollPaise / 100).toFixed(2) : '',
    tripDate: t.tripDate, status: t.status, notes: t.notes ?? '',
  }
}

/** Live preview while typing; blank or invalid parts count as zero here (the schema reports the error). */
function livePreview(km: number, rate: string, driver: string, fuelPaise: number, tollPaise: number) {
  const ratePaise = parseMoney(rate)
  const driverPaise = driver.trim() === '' ? 0 : parseMoney(driver)
  const parts = {
    distanceKm: km / 100,
    ratePerKmPaise: ratePaise !== null && ratePaise > 0 ? ratePaise : 0,
    driverPaymentPaise: driverPaise !== null && driverPaise > 0 ? driverPaise : 0,
  }
  return { revenue: tripRevenuePaise(parts), profit: tripOperatingProfitPaise({ ...parts, fuelPaise, tollPaise }) }
}

function Form({ trip, onClose, onSaved }: { trip?: Trip; onClose: () => void; onSaved: () => void }) {
  const save = useSaveTrip(trip?.id)
  const options = useTripOptions()
  const costs = useTripCosts(trip?.id)
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema), defaultValues: initial(trip, costs.data),
  })
  const [odoStart, odoEnd, manualKm, rate, driverPay, status, fuelL, fuelP, toll] = watch(['odometerStart', 'odometerEnd', 'distanceKm', 'ratePerKm', 'driverPayment', 'status', 'fuelLitres', 'fuelPrice', 'tollAmount'])
  // Old trips that already hold several fuel or toll entries keep them as they are; only 0 or 1 entry is edited here.
  const fuelManaged = !costs.data || costs.data.fuelCount <= 1
  const tollManaged = !costs.data || costs.data.tollCount <= 1
  const litresH = parseKmHundredths(fuelL), priceP = parseMoney(fuelP)
  const fuelNow = litresH !== null && priceP !== null ? fuelTotalPaise({ litres: litresH / 100, pricePerLitrePaise: priceP }) : 0
  const tollNow = toll.trim() === '' ? 0 : (parseMoney(toll) ?? 0)
  // Distance = ending odometer - starting odometer. Only old trips saved without readings keep a typed distance.
  const manualDistance = trip !== undefined && trip.odometerStartKm === null
  const km = tripDistanceHundredths(odoStart, odoEnd, manualKm)
  const { revenue, profit } = livePreview(km, rate, driverPay, fuelManaged ? fuelNow : (trip?.fuelPaise ?? 0), tollManaged ? tollNow : (trip?.tollPaise ?? 0))

  // New trips list active vehicles/drivers only; an old trip keeps showing its own vehicle/driver even if now inactive.
  // A vehicle with a trip still in progress cannot start another: complete or cancel that trip first.
  const busy = new Set((options.data?.inProgress ?? []).filter((t) => t.tripId !== trip?.id).map((t) => t.vehicleId))
  const activeVehicles = (options.data?.vehicles ?? []).filter((v) => v.status === 'active' || v.id === trip?.vehicleId)
  const vehicles = activeVehicles.filter((v) => !busy.has(v.id) || v.id === trip?.vehicleId)
  const drivers = (options.data?.drivers ?? []).filter((d) => d.status === 'active' || d.id === trip?.driverId)
  const customers = options.data?.customers ?? []

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    const input = toTripInput(values)
    if (!fuelManaged) { input.fuelLitres = null; input.fuelPricePaise = null }
    if (!tollManaged) input.tollPaise = null
    try { await save.mutateAsync(input); onSaved() } catch { /* shown via save.isError */ }
  })

  if (options.isError || costs.isError) {
    return (
      <div role="alert" className="py-6 text-center">
        <p className="text-sm font-medium">Could not load vehicles, drivers and customers</p>
        <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => { void options.refetch(); void costs.refetch() }}>Try again</button>
      </div>
    )
  }
  if (options.isLoading || (trip && costs.isLoading)) return <p className="py-10 text-center text-sm text-muted" role="status">Loading…</p>

  const missing = activeVehicles.length === 0 ? 'Add an active vehicle first (Transport → Vehicles).'
    : vehicles.length === 0 ? 'Every vehicle has a trip in progress. Complete or cancel one of those trips first.'
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
      <FormField id="tr-odo-start" label="Odometer start (KM)" error={errors.odometerStart?.message}>
        <input {...register('odometerStart')} {...fieldA11y('tr-odo-start', errors.odometerStart?.message)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      <FormField id="tr-odo-end" label="Odometer end (KM)" error={errors.odometerEnd?.message} hint="Add when the vehicle reaches the destination.">
        <input {...register('odometerEnd')} {...fieldA11y('tr-odo-end', errors.odometerEnd?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      {manualDistance ? (
        <FormField id="tr-km" label="Distance (KM)" error={errors.distanceKm?.message} hint="Old trip without odometer readings.">
          <input {...register('distanceKm')} {...fieldA11y('tr-km', errors.distanceKm?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
        </FormField>
      ) : (
        <FormField id="tr-km" label="Distance (KM)" hint="End − start odometer.">
          <input id="tr-km" readOnly tabIndex={-1} value={km > 0 ? (km / 100).toString() : '—'} aria-describedby="tr-km-hint" className={`${inputClass} bg-canvas`} />
        </FormField>
      )}
      <FormField id="tr-rate" label="Rate per KM (₹)" error={errors.ratePerKm?.message}>
        <input {...register('ratePerKm')} {...fieldA11y('tr-rate', errors.ratePerKm?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="tr-driverpay" label="Driver payment (₹)" error={errors.driverPayment?.message} hint="Leave blank if none.">
        <input {...register('driverPayment')} {...fieldA11y('tr-driverpay', errors.driverPayment?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="tr-date" label="Trip date" error={errors.tripDate?.message}>
        <FormDatePicker control={control} name="tripDate" {...fieldA11y('tr-date', errors.tripDate?.message)} className={inputClass} />
      </FormField>
      {fuelManaged ? (
        <>
          <FormField id="tr-fuel-l" label="Fuel litres (optional)" error={errors.fuelLitres?.message}>
            <input {...register('fuelLitres')} {...fieldA11y('tr-fuel-l', errors.fuelLitres?.message)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
          </FormField>
          <FormField id="tr-fuel-p" label="Price per litre (₹)" error={errors.fuelPrice?.message}>
            <input {...register('fuelPrice')} {...fieldA11y('tr-fuel-p', errors.fuelPrice?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
          </FormField>
        </>
      ) : (
        <p className="col-span-2 text-xs text-muted">This trip has several earlier fuel entries ({formatINR(trip?.fuelPaise ?? 0)} in total). They stay as they are.</p>
      )}
      {tollManaged ? (
        <FormField id="tr-toll" label="Toll (₹, optional)" error={errors.tollAmount?.message} hint={fuelManaged && fuelNow > 0 ? `Fuel total ${formatINR(fuelNow)}` : undefined}>
          <input {...register('tollAmount')} {...fieldA11y('tr-toll', errors.tollAmount?.message, fuelManaged && fuelNow > 0)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
        </FormField>
      ) : (
        <p className="col-span-2 text-xs text-muted">This trip has several earlier toll entries ({formatINR(trip?.tollPaise ?? 0)} in total). They stay as they are.</p>
      )}
      <p className="col-span-2 -mt-2 text-xs text-muted">Fuel and toll can be added after the vehicle reaches the destination. Saving also adds them as expenses in Finance.</p>
      <div className="rounded-md bg-canvas px-3 py-2 text-sm col-span-2" aria-live="polite">
        <div><span className="text-muted">Revenue (distance × rate): </span><span className="font-medium tabular-nums">{formatINR(revenue)}</span></div>
        <div>
          <span className="text-muted">Operating profit (after driver payment, fuel and toll): </span>
          <span className="font-medium tabular-nums">{profit < 0 ? '−' : ''}{formatINR(Math.abs(profit))}</span>
        </div>
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
