import { useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import { parseMoney } from '../property/propertyForms'
import { loanInterestRate } from './transportEngine'
import { LOAN_STATUSES, type VehicleLoan } from '../../types/transport'
import { useSaveLoan, useTripOptions } from './hooks'
import { LOAN_STATUS_LABELS } from './labels'
import { transportSubmitError } from './submitError'
import { defaultLoanValues, loanFormSchema, toLoanInput, type LoanFormValues } from './transportForms'
import { FormSelect } from '../../components/forms/Select'
import { FormDatePicker } from '../../components/forms/DatePicker'

function initial(l?: VehicleLoan): LoanFormValues {
  if (!l) return defaultLoanValues(todayIST())
  return {
    vehicleId: l.vehicleId ?? '', lender: l.lender, principal: (l.principalPaise / 100).toFixed(2), startDate: l.startDate,
    interestRate: String(l.interestRate), emi: (l.emiPaise / 100).toFixed(2),
    tenureMonths: l.tenureMonths === null ? '' : String(l.tenureMonths), status: l.status, notes: l.notes ?? '',
  }
}

function Form({ loan, onClose, onSaved }: { loan?: VehicleLoan; onClose: () => void; onSaved: () => void }) {
  const save = useSaveLoan(loan?.id)
  const options = useTripOptions()
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitted } } = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema), defaultValues: initial(loan),
  })

  // The interest rate follows the amount, EMI and tenure: change any of them and the rate is worked out again.
  const [principal, emi, tenure] = watch(['principal', 'emi', 'tenureMonths'])
  const first = useRef(true)
  const tenureN = /^\d{1,4}$/.test(tenure.trim()) ? Number(tenure.trim()) : 0
  const rate = loanInterestRate(parseMoney(principal) ?? 0, parseMoney(emi) ?? 0, tenureN)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (rate !== null) setValue('interestRate', String(rate), { shouldValidate: isSubmitted })
  }, [rate, setValue, isSubmitted])

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toLoanInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="ln-lender" label="Lender" error={errors.lender?.message}>
        <input {...register('lender')} {...fieldA11y('ln-lender', errors.lender?.message)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="ln-vehicle" label="Vehicle (optional)" error={errors.vehicleId?.message} hint="The vehicle this loan financed.">
        <FormSelect control={control} name="vehicleId" {...fieldA11y('ln-vehicle', errors.vehicleId?.message, true)} className={inputClass} disabled={options.isLoading}>
          <option value="">Not linked to a vehicle</option>
          {(options.data?.vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
        </FormSelect>
      </FormField>
      <FormField id="ln-principal" label="Amount received (₹)" error={errors.principal?.message}>
        <input {...register('principal')} {...fieldA11y('ln-principal', errors.principal?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="ln-start" label="Start date" error={errors.startDate?.message}>
        <FormDatePicker control={control} name="startDate" {...fieldA11y('ln-start', errors.startDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="ln-rate" label="Interest rate (% per year)" error={errors.interestRate?.message} hint={rate !== null ? 'Worked out from the amount, EMI and tenure.' : 'Fills in once amount, EMI and tenure are entered.'}>
        <input {...register('interestRate')} {...fieldA11y('ln-rate', errors.interestRate?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      <FormField id="ln-emi" label="Monthly instalment, EMI (₹)" error={errors.emi?.message}>
        <input {...register('emi')} {...fieldA11y('ln-emi', errors.emi?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="ln-tenure" label="Tenure in months (optional)" error={errors.tenureMonths?.message} hint="Fills in the interest rate.">
        <input {...register('tenureMonths')} {...fieldA11y('ln-tenure', errors.tenureMonths?.message, true)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="ln-status" label="Status" error={errors.status?.message}>
        <FormSelect control={control} name="status" {...fieldA11y('ln-status', errors.status?.message)} className={inputClass}>
          {LOAN_STATUSES.map((s) => <option key={s} value={s}>{LOAN_STATUS_LABELS[s]}</option>)}
        </FormSelect>
      </FormField>
      <div className="rounded-md bg-canvas px-3 py-2 text-xs text-muted col-span-2">
        Saving records the amount received in Finance as a loan received, dated the start date. Editing the loan later updates that entry.
      </div>
      <FormField id="ln-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('ln-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {options.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">Could not load vehicles. You can still save the loan without linking a vehicle.</p>}
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{transportSubmitError(save.error, 'loan')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save loan'}</button>
      </DialogActions>
    </form>
  )
}

export function LoanDialog({ open, loan, onClose, onSaved }: {
  open: boolean; loan?: VehicleLoan; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={loan ? 'Edit vehicle loan' : 'Add vehicle loan'}>
      <Form loan={loan} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
