import type { ReactNode } from 'react'

/**
 * Grid for StatTiles: two columns on phones (an odd last tile spans the row), four on desktop. Values wrap instead of
 * overflowing, so large rupee amounts never clip.
 */
export const statGrid = 'grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1'

/** A label + value tile; use inside a `<dl className={statGrid}>`. */
export function StatTile({ label, value, hint, negative }: { label: string; value: ReactNode; hint?: string; negative?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-3 sm:px-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 break-words text-base font-semibold tabular-nums sm:text-lg ${negative ? 'text-danger' : 'text-ink'}`}>{value}</dd>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}
