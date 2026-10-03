import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { accruedInterestPaise } from '../../services/goldInterest'
import type { GoldLoan, GoldLoanPayment } from '../../types/gold'
import { estimatedBalancePaise } from './goldEngine'
import { defaultGoldPaymentValues, goldPaymentFormSchema, toGoldPaymentInput, type GoldPaymentFormValues } from './goldForms'
import { useGoldLoanPayments, useSaveGoldLoanPayment } from './hooks'
import { GOLD_STATUS_LABELS } from './labels'
import { goldSubmitError } from './submitError'
import { FormDatePicker } from '../../components/forms/DatePicker'

function PaymentForm({ loan, editing, onSaved, onCancelEdit }: {
  loan: GoldLoan; editing: GoldLoanPayment | null; onSaved: () => void; onCancelEdit: () => void
}) {
  const save = useSaveGoldLoanPayment(loan.id, editing?.id)
  const { register, handleSubmit, control, formState: { errors } } = useForm<GoldPaymentFormValues>({
    resolver: zodResolver(goldPaymentFormSchema),
    defaultValues: editing
      ? { paymentDate: editing.paymentDate, amount: (editing.amountPaise / 100).toFixed(2), notes: editing.notes ?? '' }
      : defaultGoldPaymentValues(todayIST()),
  })

  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toGoldPaymentInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4" aria-label={editing ? 'Edit payment' : 'Record payment'}>
      <FormField id="gp-date" label="Payment date" error={errors.paymentDate?.message}>
        <FormDatePicker control={control} name="paymentDate" {...fieldA11y('gp-date', errors.paymentDate?.message)} data-autofocus className={inputClass} />
      </FormField>
      <FormField id="gp-amount" label="Amount paid (₹)" error={errors.amount?.message} hint="The full amount paid, interest included.">
        <input {...register('amount')} {...fieldA11y('gp-amount', errors.amount?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="gp-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('gp-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <p className="text-xs text-muted col-span-2">Saving records this in Finance as a loan repayment for the full amount. Editing it later updates that entry.</p>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{goldSubmitError(save.error, 'payment')}</p>}
      <DialogActions>
        {editing && <button type="button" className={buttonSecondary} onClick={onCancelEdit}>Cancel edit</button>}
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Record payment'}</button>
      </DialogActions>
    </form>
  )
}

function Body({ loan }: { loan: GoldLoan }) {
  const payments = useGoldLoanPayments(loan.id)
  const [editing, setEditing] = useState<GoldLoanPayment | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [saved, setSaved] = useState(false)
  const today = todayIST()
  const il = { ...loan }
  const interest = accruedInterestPaise(il, today)
  const canRecord = loan.status === 'active'

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 rounded-md bg-canvas px-4 py-3 text-sm md:grid-cols-5">
        <div><dt className="text-xs text-muted">Received</dt><dd className="font-medium tabular-nums">{formatINR(loan.principalPaise)}</dd></div>
        <div><dt className="text-xs text-muted">Interest so far</dt><dd className="font-medium tabular-nums">{formatINR(interest)}</dd></div>
        <div><dt className="text-xs text-muted">Repaid so far</dt><dd className="font-medium tabular-nums">{formatINR(loan.paidPaise)}</dd></div>
        <div><dt className="text-xs text-muted">Estimated balance</dt><dd className="font-medium tabular-nums">{formatINR(estimatedBalancePaise(il, loan.paidPaise, today))}</dd></div>
        <div><dt className="text-xs text-muted">Status</dt><dd className="font-medium">{GOLD_STATUS_LABELS[loan.status]}</dd></div>
      </dl>
      <p className="-mt-3 text-xs text-muted">Estimate = amount received + simple interest ({loan.annualRate}% a year, per day) - repaid. The bank&apos;s own figure is the one that counts.</p>

      {canRecord || editing ? (
        <section aria-labelledby="gp-form-title">
          <h3 id="gp-form-title" className="mb-3 text-sm font-medium">{editing ? `Edit payment of ${formatDate(editing.paymentDate)}` : 'Record a payment'}</h3>
          <PaymentForm
            key={`${editing?.id ?? 'new'}-${formKey}`} loan={loan} editing={editing}
            onSaved={() => { setEditing(null); setFormKey((k) => k + 1); setSaved(true) }}
            onCancelEdit={() => { setEditing(null); setSaved(false) }}
          />
        </section>
      ) : (
        <p className="rounded-md bg-canvas px-3 py-2 text-sm text-muted">This loan is {GOLD_STATUS_LABELS[loan.status].toLowerCase()}. Set it back to Active (Edit on the loan) to record a new payment.</p>
      )}
      <p className="sr-only" role="status" aria-live="polite">{saved ? 'Payment saved.' : ''}</p>
      {saved && <p className="text-sm text-primary" aria-hidden>Payment saved.</p>}

      <section aria-labelledby="gp-history-title">
        <h3 id="gp-history-title" className="mb-2 text-sm font-medium">Payment history</h3>
        {payments.isError ? (
          <div role="alert" className="rounded-md border border-line px-4 py-4 text-center">
            <p className="text-sm font-medium">Could not load payments</p>
            <button type="button" className={`${buttonPrimary} mt-3`} onClick={() => void payments.refetch()}>Try again</button>
          </div>
        ) : payments.isLoading ? (
          <p className="py-4 text-center text-sm text-muted" role="status">Loading payments…</p>
        ) : (payments.data ?? []).length === 0 ? (
          <p className="rounded-md border border-line px-4 py-4 text-center text-sm text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {(payments.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{formatDate(p.paymentDate)}</span>
                  {p.notes && <div className="truncate text-xs text-muted">{p.notes}</div>}
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-medium tabular-nums">{formatINR(p.amountPaise)}</span>
                  <button type="button" className={buttonSecondary} aria-label={`Edit payment of ${formatDate(p.paymentDate)}`} onClick={() => { setEditing(p); setSaved(false) }}>Edit</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function GoldPaymentsDialog({ open, loan, onClose }: { open: boolean; loan?: GoldLoan; onClose: () => void }) {
  return (
    <Dialog open={open && loan !== undefined} onClose={onClose} title={loan ? `Payments · ${loan.personName} · ${loan.bank}` : 'Payments'}>
      {loan && <Body loan={loan} />}
    </Dialog>
  )
}
