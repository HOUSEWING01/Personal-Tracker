import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog, DialogActions } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import type { SheetProduct } from '../../types/sheets'
import { useSaveProduct } from './hooks'
import { ACTIVE_STATUS_LABELS } from './labels'
import { defaultProductValues, productFormSchema, toProductInput, type ProductFormValues } from './sheetForms'
import { sheetSubmitError } from './submitError'
import { FormSelect } from '../../components/forms/Select'

const initial = (p?: SheetProduct): ProductFormValues => (p ? { name: p.name, status: p.status, notes: p.notes ?? '' } : defaultProductValues())

function Form({ product, onClose, onSaved }: { product?: SheetProduct; onClose: () => void; onSaved: () => void }) {
  const save = useSaveProduct(product?.id)
  const { register, handleSubmit, control, formState: { errors } } = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: initial(product) })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toProductInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-4">
      <FormField id="pr-name" label="Product name" error={errors.name?.message} hint="For example Roofing Sheet. Sizes are added as variants in Stock.">
        <input {...register('name')} {...fieldA11y('pr-name', errors.name?.message, true)} data-autofocus autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="pr-status" label="Status" error={errors.status?.message}>
        <FormSelect control={control} name="status" {...fieldA11y('pr-status', errors.status?.message)} className={inputClass}>
          {(['active', 'inactive'] as const).map((s) => <option key={s} value={s}>{ACTIVE_STATUS_LABELS[s]}</option>)}
        </FormSelect>
      </FormField>
      <FormField id="pr-notes" label="Notes (optional)" error={errors.notes?.message} className="col-span-2">
        <input {...register('notes')} {...fieldA11y('pr-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger col-span-2">{sheetSubmitError(save.error, 'product')}</p>}
      <DialogActions>
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save product'}</button>
      </DialogActions>
    </form>
  )
}

export function ProductDialog({ open, product, onClose, onSaved }: { open: boolean; product?: SheetProduct; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={product ? 'Edit product' : 'Add product'}>
      <Form product={product} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
