import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import type { Customer } from '../../types/transport'
import { toast } from '../../lib/toast'
import { useSaveCustomer } from './hooks'
import { transportSubmitError } from './submitError'
import { customerFormSchema, defaultCustomerValues, toCustomerInput, type CustomerFormValues } from './transportForms'

const initial = (c?: Customer): CustomerFormValues =>
  c ? { name: c.name, mobile: c.mobile ?? '', address: c.address ?? '', notes: c.notes ?? '' } : defaultCustomerValues()

function Form({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: () => void }) {
  const save = useSaveCustomer(customer?.id)
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema), defaultValues: initial(customer),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toCustomerInput(values)); toast.success(customer ? 'Customer updated' : 'Customer added'); onSaved() } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="cu-name" label="Customer name" error={errors.name?.message}>
        <input {...register('name')} {...fieldA11y('cu-name', errors.name?.message)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="cu-mobile" label="Mobile (optional)" error={errors.mobile?.message} hint="10 digits. Each mobile number can belong to one customer only.">
        <input {...register('mobile')} {...fieldA11y('cu-mobile', errors.mobile?.message, true)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="cu-address" label="Address (optional)" error={errors.address?.message} className="col-span-2">
        <input {...register('address')} {...fieldA11y('cu-address', errors.address?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="cu-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('cu-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{transportSubmitError(save.error, 'customer')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save customer'}</button>
      </DialogActions>
    </form>
  )
}

export function CustomerDialog({ open, customer, onClose, onSaved }: { open: boolean; customer?: Customer; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={customer ? 'Edit customer' : 'Add customer'}>
      <Form customer={customer} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
