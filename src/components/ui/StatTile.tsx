import type { ReactNode } from 'react'

/** Grid for StatTiles: one column on very narrow phones so large rupee amounts never clip, two from ~420px, four on desktop. */
export const statGrid = 'grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4'

/** A label + value tile; use inside a `<dl className={statGrid}>`. Values wrap instead of overflowing. */
export function StatTile({ label, value, hint, negative }: { label: string; value: ReactNode; hint?: string; negative?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 break-words text-lg font-semibold tabular-nums ${negative ? 'text-danger' : 'text-ink'}`}>{value}</dd>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}
