import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { BUSINESS_MODULES, MANUAL_TRANSACTION_TYPES } from '../../types/finance'
import { useCreateTransaction } from './hooks'
import { MODULE_LABELS, PAYMENT_METHODS, TYPE_LABELS } from './labels'
import { defaultFormValues, toNewTransaction, transactionFormSchema, type TransactionFormValues } from './transactionForm'

function submitErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message.toLowerCase() : ''
  if (msg.includes('row-level security') || msg.includes('permission')) return 'You do not have permission to save transactions.'
  return 'Could not save the transaction. Check your connection and try again.'
}

function Form({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const create = useCreateTransaction()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaultFormValues(),
  })
  const isAdjustment = watch('type') === 'adjustment'

  const onSubmit = handleSubmit(async (values) => {
    if (create.isPending) return // duplicate-submit guard
    try {
      await create.mutateAsync(toNewTransaction(values))
      onSaved()
    } catch { /* surfaced via create.isError */ }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField id="tx-type" label="Type" error={errors.type?.message}>
        <select {...register('type')} {...fieldA11y('tx-type', errors.type?.message)} data-autofocus className={inputClass}>
          {MANUAL_TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </FormField>
      <FormField id="tx-module" label="Module" error={errors.module?.message}>
        <select {...register('module')} {...fieldA11y('tx-module', errors.module?.message)} className={inputClass}>
          {BUSINESS_MODULES.map((m) => <option key={m} value={m}>{MODULE_LABELS[m]}</option>)}
        </select>
      </FormField>
      <FormField id="tx-amount" label="Amount (₹)" error={errors.amount?.message}
        hint={isAdjustment ? 'Use a minus sign to deduct, for example -250.50.' : 'Up to 2 decimals.'}>
        <input {...register('amount')} {...fieldA11y('tx-amount', errors.amount?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" className={inputClass} />
      </FormField>
      <FormField id="tx-date" label="Date" error={errors.date?.message}>
        <input type="date" {...register('date')} {...fieldA11y('tx-date', errors.date?.message)} className={inputClass} />
      </FormField>
      <FormField id="tx-method" label="Payment method (optional)" error={errors.paymentMethod?.message}>
        <select {...register('paymentMethod')} {...fieldA11y('tx-method', errors.paymentMethod?.message)} className={inputClass}>
          <option value="">Not specified</option>
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </FormField>
      <FormField id="tx-desc" label={isAdjustment ? 'Reason' : 'Description (optional)'} error={errors.description?.message} className="md:col-span-2">
        <input {...register('description')} {...fieldA11y('tx-desc', errors.description?.message)} autoComplete="off" className={inputClass} />
      </FormField>

      {create.isError && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{submitErrorMessage(create.error)}</p>
      )}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Save transaction'}</button>
      </div>
    </form>
  )
}

export function AddTransactionDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add transaction">
      <Form onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
