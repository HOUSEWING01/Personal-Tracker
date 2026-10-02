import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/ui/Dialog'
import { FormField, fieldA11y, inputClass } from '../../components/forms/FormField'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatDate, todayIST } from '../../lib/dates'
import type { SheetRental } from '../../types/sheets'
import { useDeleteReturn, useRecordReturn, useSheetReturns } from './hooks'
import { stillOutQuantity, variantLabel } from './sheetEngine'
import { defaultSheetReturnValues, makeSheetReturnSchema, toSheetReturnInput, type SheetReturnFormValues } from './sheetForms'
import { sheetSubmitError } from './submitError'

function ReturnForm({ rental, onSaved }: { rental: SheetRental; onSaved: () => void }) {
  const stillOut = stillOutQuantity(rental)
  const record = useRecordReturn(rental.id)
  const today = todayIST()
  const schema = useMemo(() => makeSheetReturnSchema(stillOut, rental.rentalDate, today), [stillOut, rental.rentalDate, today])
  const { register, handleSubmit, formState: { errors } } = useForm<SheetReturnFormValues>({
    resolver: zodResolver(schema), defaultValues: defaultSheetReturnValues(today, stillOut),
  })
  const onSubmit = handleSubmit(async (values) => {
    if (record.isPending) return
    try { await record.mutateAsync(toSheetReturnInput(values)); onSaved() } catch { /* shown via record.isError */ }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Record return">
      <FormField id="sr-date" label="Return date" error={errors.returnDate?.message} className="md:col-span-3">
        <input type="date" {...register('returnDate')} {...fieldA11y('sr-date', errors.returnDate?.message)} className={inputClass} />
      </FormField>
      <FormField id="sr-returned" label="Returned in good condition" error={errors.returned?.message}>
        <input {...register('returned')} {...fieldA11y('sr-returned', errors.returned?.message)} data-autofocus inputMode="numeric" autoComplete="off" className={inputClass} />
      </FormField>
      <FormField id="sr-damaged" label="Returned damaged" error={errors.damaged?.message}>
        <input {...register('damaged')} {...fieldA11y('sr-damaged', errors.damaged?.message)} inputMode="numeric" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      <FormField id="sr-missing" label="Not returned (missing)" error={errors.missing?.message}>
        <input {...register('missing')} {...fieldA11y('sr-missing', errors.missing?.message)} inputMode="numeric" autoComplete="off" placeholder="0" className={inputClass} />
      </FormField>
      <FormField id="sr-notes" label="Notes (optional)" error={errors.notes?.message} className="md:col-span-3">
        <input {...register('notes')} {...fieldA11y('sr-notes', errors.notes?.message)} autoComplete="off" className={inputClass} />
      </FormField>
      <p className="text-xs text-muted md:col-span-3">Partial returns are fine: record what came back now and the rest later. Good sheets go back into stock; damaged and missing sheets stay out of stock.</p>
      {record.isError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-3">{sheetSubmitError(record.error, 'return')}</p>}
      <div className="flex justify-end md:col-span-3">
        <button type="submit" className={buttonPrimary} disabled={record.isPending}>{record.isPending ? 'Saving…' : 'Record return'}</button>
      </div>
    </form>
  )
}

function Body({ rental }: { rental: SheetRental }) {
  const returns = useSheetReturns(rental.id)
  const del = useDeleteReturn()
  const [saved, setSaved] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null)
  const stillOut = stillOutQuantity(rental)

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 rounded-md bg-canvas px-4 py-3 text-sm md:grid-cols-5">
        <div><dt className="text-xs text-muted">Rented</dt><dd className="font-medium tabular-nums">{rental.quantity}</dd></div>
        <div><dt className="text-xs text-muted">Returned</dt><dd className="font-medium tabular-nums">{rental.returnedQuantity}</dd></div>
        <div><dt className="text-xs text-muted">Damaged</dt><dd className="font-medium tabular-nums">{rental.damagedQuantity}</dd></div>
        <div><dt className="text-xs text-muted">Missing</dt><dd className="font-medium tabular-nums">{rental.missingQuantity}</dd></div>
        <div><dt className="text-xs text-muted">Still out</dt><dd className="font-medium tabular-nums">{stillOut}</dd></div>
      </dl>

      {rental.status === 'cancelled' ? (
        <p className="rounded-md bg-canvas px-3 py-2 text-sm text-muted">This rental is cancelled.</p>
      ) : stillOut > 0 ? (
        <section aria-labelledby="sr-form-title">
          <h3 id="sr-form-title" className="mb-3 text-sm font-medium">Record a return</h3>
          <ReturnForm key={formKey} rental={rental} onSaved={() => { setFormKey((k) => k + 1); setSaved(true) }} />
        </section>
      ) : (
        <p className="rounded-md bg-sage-soft px-3 py-2 text-sm text-primary">All sheets are accounted for. This rental is closed.</p>
      )}
      <p className="sr-only" role="status" aria-live="polite">{saved ? 'Return saved.' : ''}</p>
      {saved && <p className="text-sm text-primary" aria-hidden>Return saved.</p>}

      <section aria-labelledby="sr-history-title">
        <h3 id="sr-history-title" className="mb-2 text-sm font-medium">Return history</h3>
        {returns.isError ? (
          <div role="alert" className="rounded-md border border-line px-4 py-4 text-center">
            <p className="text-sm font-medium">Could not load returns</p>
            <button type="button" className={`${buttonPrimary} mt-3`} onClick={() => void returns.refetch()}>Try again</button>
          </div>
        ) : returns.isLoading ? (
          <p className="py-4 text-center text-sm text-muted" role="status">Loading returns…</p>
        ) : (returns.data ?? []).length === 0 ? (
          <p className="rounded-md border border-line px-4 py-4 text-center text-sm text-muted">No returns recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {(returns.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{formatDate(r.returnDate)}</span>
                  <div className="text-xs text-muted">{r.returnedQuantity} good · {r.damagedQuantity} damaged · {r.missingQuantity} missing{r.notes ? ` · ${r.notes}` : ''}</div>
                </div>
                {confirming === r.id ? (
                  <span className="flex shrink-0 gap-2">
                    <button type="button" className={buttonSecondary} onClick={() => setConfirming(null)}>Keep</button>
                    <button
                      type="button" className={buttonSecondary} disabled={del.isPending}
                      onClick={async () => { try { await del.mutateAsync(r.id); setConfirming(null); setSaved(false) } catch { /* shown below */ } }}
                    >{del.isPending ? 'Undoing…' : 'Yes, undo'}</button>
                  </span>
                ) : (
                  <button type="button" className={`${buttonSecondary} shrink-0`} aria-label={`Undo return of ${formatDate(r.returnDate)}`} onClick={() => { del.reset(); setConfirming(r.id) }}>Undo</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {del.isError && <p role="alert" className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{sheetSubmitError(del.error, 'return')}</p>}
      </section>
    </div>
  )
}

export function RentalReturnsDialog({ open, rental, onClose }: { open: boolean; rental?: SheetRental; onClose: () => void }) {
  return (
    <Dialog open={open && rental !== undefined} onClose={onClose} title={rental ? `Returns · ${rental.customerName} · ${rental.quantity} × ${variantLabel(rental.lengthFt)}` : 'Returns'}>
      {rental && <Body rental={rental} />}
    </Dialog>
  )
}
