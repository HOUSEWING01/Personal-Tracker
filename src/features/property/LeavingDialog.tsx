import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { FormDatePicker } from '../../components/forms/DatePicker'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatINR } from '../../lib/money'
import type { Tenant } from '../../types/property'
import { useLeaveTenancy } from './hooks'
import { defaultLeavingValues, makeLeavingSchema, toLeavingInput, type LeavingFormValues } from './propertyForms'
import { submitError } from './submitError'

function Form({ propertyId, tenant, advancePaise, outstandingPaise, onClose, onSaved }: {
  propertyId: string; tenant: Tenant; advancePaise: number; outstandingPaise: number; onClose: () => void; onSaved: () => void
}) {
  const save = useLeaveTenancy(propertyId, tenant)
  const schema = useMemo(() => makeLeavingSchema(advancePaise, tenant.rentalStartDate), [advancePaise, tenant.rentalStartDate])
  const { register, handleSubmit, control, formState: { errors } } = useForm<LeavingFormValues>({
    resolver: zodResolver(schema), defaultValues: defaultLeavingValues(advancePaise),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toLeavingInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <p className="text-sm text-muted md:col-span-2">
        Advance held: <strong className="text-ink">{formatINR(advancePaise)}</strong>
        {outstandingPaise > 0 && <> · Rent still unpaid: <strong className="text-ink">{formatINR(outstandingPaise)}</strong></>}
      </p>
      <FormField id="lv-date" label="Leaving date" error={errors.leaveDate?.message} hint="Rent is charged up to this month.">
        <FormDatePicker control={control} name="leaveDate" {...fieldA11y('lv-date', errors.leaveDate?.message, true)} data-autofocus className={inputClass} />
      </FormField>
      <FormField id="lv-return" label="Advance returned (₹)" error={errors.returnAmount?.message}
        hint={advancePaise > 0 ? 'Lower it if you keep part of the advance.' : 'No advance is held.'}>
        <input {...register('returnAmount')} {...fieldA11y('lv-return', errors.returnAmount?.message, true)} inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={advancePaise === 0} className={inputClass} />
      </FormField>
      <p className="text-xs text-muted md:col-span-2">The returned advance is added to Finance → Transactions as money paid out. It never counts as an expense or lowers profit.</p>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{submitError(save.error, 'tenant')} Press Save again to retry. Anything already saved is not repeated.</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Tenant has left'}</button>
      </DialogActions>
    </form>
  )
}

export function LeavingDialog(props: {
  open: boolean; propertyId: string; tenant: Tenant; advancePaise: number; outstandingPaise: number; onClose: () => void; onSaved: () => void
}) {
  const { open, onClose, ...rest } = props
  return (
    <Dialog open={open} onClose={onClose} title="Tenant leaving">
      <Form {...rest} onClose={onClose} />
    </Dialog>
  )
}
