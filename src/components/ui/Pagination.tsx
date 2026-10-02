import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { buttonSecondary } from './FullScreenMessage'

/** "Showing 1–10 of 42" with Previous / Next. One footer for every list, so paging looks and works the same everywhere. */
export function Pagination({ page, pageSize, total, onPage, noun = 'items' }: {
  page: number; pageSize: number; total: number; onPage: (n: number) => void; noun?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-3 text-sm">
      <p className="min-w-0 text-muted">
        <span className="font-medium text-ink tabular-nums">{from}–{to}</span> of <span className="font-medium text-ink tabular-nums">{total}</span> {noun}
        <span className="hidden sm:inline"> · page {page} of {totalPages}</span>
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" className={`${buttonSecondary} gap-1`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <CaretLeft size={14} aria-hidden /> <span className="hidden min-[380px]:inline">Previous</span>
        </button>
        <button type="button" className={`${buttonSecondary} gap-1`} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <span className="hidden min-[380px]:inline">Next</span> <CaretRight size={14} aria-hidden />
        </button>
      </div>
    </nav>
  )
}
