import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST } from '../../lib/dates'
import { GOLD_LOAN_STATUSES, type GoldLoan } from '../../types/gold'
import { defaultGoldLoanValues, goldLoanFormSchema, toGoldLoanInput, type GoldLoanFormValues } from './goldForms'
import { useSaveGoldLoan } from './hooks'
import { GOLD_STATUS_LABELS } from './labels'
import { goldSubmitError } from './submitError'
import { FormDatePicker } from '../../components/forms/DatePicker'
import { FormSelect } from '../../components/forms/Select'

function initial(l?: GoldLoan): GoldLoanFormValues {
  if (!l) return defaultGoldLoanValues(todayIST())
  return {
    personName: l.personName, mobile: l.mobile ?? '', goldDescription: l.goldDescription,
    goldWeight: l.goldWeightGrams === null ? '' : String(l.goldWeightGrams), bank: l.bank, pledgeDate: l.pledgeDate,
    dueDate: l.dueDate ?? '', principal: (l.principalPaise / 100).toFixed(2), annualRate: String(l.annualRate),
    status: l.status, closedDate: l.closedDate ?? '', notes: l.notes ?? '',
  }
}

function Form({ loan, onClose, onSaved }: { loan?: GoldLoan; onClose: () => void; onSaved: () => void }) {
  const save = useSaveGoldLoan(loan?.id)
  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<GoldLoanFormValues>({
    resolver: zodResolver(goldLoanFormSchema), defaultValues: initial(loan),
  })
  const status = useWatch({ control, name: 'status' })

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toGoldLoanInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="gl-person" label="Person name" error={errors.personName?.message}>
        <input {...register('personName')} {...fieldA11y('gl-person', errors.personName?.message)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="gl-mobile" label="Mobile (optional)" error={errors.mobile?.message}>
        <input {...register('mobile')} {...fieldA11y('gl-mobile', errors.mobile?.message)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="gl-gold" label="Gold description" error={errors.goldDescription?.message}>
        <input {...register('goldDescription')} {...fieldA11y('gl-gold', errors.goldDescription?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="gl-weight" label="Gold weight in grams (optional)" error={errors.goldWeight?.message} hint="Up to 3 decimals. No value is calculated from the weight.">
        <input {...register('goldWeight')} {...fieldA11y('gl-weight', errors.goldWeight?.message, true)} inputMode="decimal" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="gl-bank" label="Bank" error={errors.bank?.message}>
        <input {...register('bank')} {...fieldA11y('gl-bank', errors.bank?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="gl-principal" label="Amount received from bank (₹)" error={errors.principal?.message}>
        <input {...register('principal')} {...fieldA11y('gl-principal', errors.principal?.message)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="gl-pledge" label="Date pledged" error={errors.pledgeDate?.message}>
        <FormDatePicker control={control} name="pledgeDate" {...fieldA11y('gl-pledge', errors.pledgeDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="gl-due" label="Due date (optional)" error={errors.dueDate?.message}>
        <FormDatePicker control={control} name="dueDate" {...fieldA11y('gl-due', errors.dueDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="gl-rate" label="Interest rate (% per year)" error={errors.annualRate?.message} hint="Interest = amount x rate x days / 365.">
        <input {...register('annualRate')} {...fieldA11y('gl-rate', errors.annualRate?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      <FormField id="gl-status" label="Status" error={errors.status?.message}>
        <FormSelect control={control} name="status" {...fieldA11y('gl-status', errors.status?.message)} className={inputClass}
          // Offer today as the closing date the first time the loan leaves Active.
          onValueChange={(v) => { if (v !== 'active' && getValues('closedDate') === '') setValue('closedDate', todayIST()) }}>
          {GOLD_LOAN_STATUSES.map((s) => <option key={s} value={s}>{GOLD_STATUS_LABELS[s]}</option>)}
        </FormSelect>
      </FormField>
      {status !== 'active' && (
        <FormField id="gl-closed" label="Date loan closed" error={errors.closedDate?.message} hint="Interest stops accruing on this date." className="col-span-2">
          <FormDatePicker control={control} name="closedDate" {...fieldA11y('gl-closed', errors.closedDate?.message, true)} className={inputClass} />
        </FormField>
      )}
      <div className="rounded-md bg-canvas px-3 py-2 text-xs text-muted col-span-2">
        Saving records the amount received in Finance as a loan received, dated the pledge date. Editing the loan later updates that entry.
      </div>
      <FormField id="gl-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('gl-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{goldSubmitError(save.error, 'gold loan')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save gold loan'}</button>
      </DialogActions>
    </form>
  )
}

export function GoldLoanDialog({ open, loan, onClose, onSaved }: {
  open: boolean; loan?: GoldLoan; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={loan ? 'Edit gold loan' : 'Add gold loan'}>
      <Form loan={loan} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
