import type { ReactNode } from 'react'

export const inputClass = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm aria-[invalid=true]:border-danger md:py-2'

/** Label + control + hint + error. Pass `fieldA11y(id, error)` to the control. */
export function FormField({ id, label, error, hint, className, children }: {
  id: string; label: string; error?: string; hint?: string; className?: string; children: ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

export function fieldA11y(id: string, error?: string, hasHint = false) {
  return {
    id,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  }
}
