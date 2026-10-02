import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import type { SheetVariant } from '../../types/sheets'
import { useProductChoices, useSaveVariant } from './hooks'
import { ACTIVE_STATUS_LABELS } from './labels'
import { defaultVariantValues, toVariantInput, variantFormSchema, type VariantFormValues } from './sheetForms'
import { sheetSubmitError } from './submitError'

const initial = (v?: SheetVariant): VariantFormValues => v
  ? { productId: v.productId, lengthFt: String(v.lengthFt), totalQuantity: String(v.totalQuantity), status: v.status, notes: v.notes ?? '' }
  : defaultVariantValues()

function Form({ variant, onClose, onSaved }: { variant?: SheetVariant; onClose: () => void; onSaved: () => void }) {
  const save = useSaveVariant(variant?.id)
  const products = useProductChoices()
  const { register, handleSubmit, formState: { errors } } = useForm<VariantFormValues>({ resolver: zodResolver(variantFormSchema), defaultValues: initial(variant) })
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return
    try { await save.mutateAsync(toVariantInput(values)); onSaved() } catch { /* shown via save.isError */ }
  })
  const choices = (products.data ?? []).filter((p) => p.status === 'active' || p.id === variant?.productId)

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField id="vr-product" label="Product" error={errors.productId?.message}>
        <select {...register('productId')} {...fieldA11y('vr-product', errors.productId?.message)} data-autofocus className={inputClass} disabled={products.isLoading}>
          <option value="">Choose a product</option>
          {choices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </FormField>
      <FormField id="vr-length" label="Length (feet)" error={errors.lengthFt?.message} hint="For example 8 or 10.5. Each size is its own variant.">
        <input {...register('lengthFt')} {...fieldA11y('vr-length', errors.lengthFt?.message, true)} inputMode="decimal" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="vr-total" label="Total quantity owned" error={errors.totalQuantity?.message} hint="Every sheet you own of this size, including any out on rent, damaged or missing.">
        <input {...register('totalQuantity')} {...fieldA11y('vr-total', errors.totalQuantity?.message, true)} inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="vr-status" label="Status" error={errors.status?.message}>
        <select {...register('status')} {...fieldA11y('vr-status', errors.status?.message)} className={inputClass}>
          {(['active', 'inactive'] as const).map((s) => <option key={s} value={s}>{ACTIVE_STATUS_LABELS[s]}</option>)}
        </select>
      </FormField>
      {variant && (
        <div className="rounded-md bg-canvas px-3 py-2 text-xs text-muted md:col-span-2">
          Right now: {variant.rentedQuantity} rented, {variant.damagedQuantity} damaged, {variant.missingQuantity} missing, {variant.availableQuantity} available.
          The total cannot go below rented + damaged + missing.
        </div>
      )}
      <FormField id="vr-notes" label="Notes (optional)" error={errors.notes?.message} className="md:col-span-2">
        <input {...register('notes')} {...fieldA11y('vr-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      {products.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">Could not load products. Close this and try again.</p>}
      {!products.isLoading && !products.isError && choices.length === 0 && <p className="rounded-md bg-gold-soft px-3 py-2 text-sm text-primary md:col-span-2">Add a product in the Products tab first.</p>}
      {save.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2">{sheetSubmitError(save.error, 'variant')}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save variant'}</button>
      </div>
    </form>
  )
}

export function VariantDialog({ open, variant, onClose, onSaved }: { open: boolean; variant?: SheetVariant; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={variant ? 'Edit variant' : 'Add variant'}>
      <Form variant={variant} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
