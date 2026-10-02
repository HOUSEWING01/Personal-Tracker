import { useId, useState, type ReactNode } from 'react'
import { MagnifyingGlass, SlidersHorizontal } from '@phosphor-icons/react'
import { buttonSecondary } from './FullScreenMessage'

/**
 * Search plus filters for a list. Search is always visible. On phones the other filters sit behind a "Filters" button
 * (with a count of the active ones) so they do not push the list off screen; from md up they show inline.
 * Filter children are normally `<label>` + Select / DatePicker blocks; the panel is a 2-column grid on phones, 4 from md.
 */
export function ListToolbar({ searchLabel, searchValue, onSearch, activeCount = 0, onClear, children }: {
  searchLabel: string; searchValue: string; onSearch: (v: string) => void
  activeCount?: number; onClear?: () => void; children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const hasFilters = Boolean(children)
  return (
    <div role="search" className="rounded-lg border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search" value={searchValue} onChange={(e) => onSearch(e.target.value)}
            aria-label={searchLabel} placeholder={searchLabel} autoComplete="off" enterKeyHint="search"
            className="w-full rounded-md border border-line bg-surface py-2.5 pl-9 pr-3 text-sm md:py-2"
          />
        </div>
        {hasFilters && (
          <button
            type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
            className={`${buttonSecondary} shrink-0 gap-1.5 md:hidden`}
          >
            <SlidersHorizontal size={16} aria-hidden /> Filters
            {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-white">{activeCount}</span>}
          </button>
        )}
      </div>
      {hasFilters && (
        <div id={panelId} className={`mt-3 grid-cols-2 gap-3 md:grid-cols-4 ${open ? 'grid' : 'hidden md:grid'}`}>
          {children}
        </div>
      )}
      {activeCount > 0 && onClear && (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span className="text-muted">{activeCount} {activeCount === 1 ? 'filter' : 'filters'} active</span>
          <button type="button" className="rounded-md px-2 py-1.5 font-medium text-primary underline-offset-2 hover:underline" onClick={onClear}>Clear all</button>
        </div>
      )}
    </div>
  )
}

/** Label wrapper for a filter inside ListToolbar. */
export const filterLabel = 'text-sm font-medium'
/** Class for a Select / DatePicker inside ListToolbar. */
export const filterField = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm md:py-2'
