import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { popoverJustClosed } from '../forms/Popover'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

const SIZES = { md: 'md:max-w-lg', lg: 'md:max-w-2xl' } as const

/**
 * Accessible modal: labelled, Esc closes, Tab is trapped, focus returns to the opener.
 * Layout: a fixed header, a body that scrolls on its own, and (via `DialogActions`) a footer that stays pinned while the
 * body scrolls. Bottom sheet on phones (dynamic viewport height, so the browser bar never hides the buttons), centred card
 * from md up.
 */
export function Dialog({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: keyof typeof SIZES
}) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const titleId = useId()

  useEffect(() => {
    if (!open || !panel.current) return
    const el = panel.current
    const opener = document.activeElement as HTMLElement | null
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('[data-dialog-body] input,[data-dialog-body] button,[data-dialog-body] textarea') ?? items()[0])?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return }
      if (e.key !== 'Tab') return
      const list = items()
      if (list.length === 0) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    el.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      el.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="backdrop-in absolute inset-0 bg-ink/40" onClick={() => { if (!popoverJustClosed()) onClose() }} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-lg md:max-h-[88dvh] md:rounded-xl ${SIZES[size]}`}
      >
        <div className="shrink-0 border-b border-line px-4 pt-2 md:px-5 md:pt-4">
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3 pb-2 md:pb-3">
            <h2 id={titleId} className="min-w-0 truncate text-base font-semibold">{title}</h2>
            <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 shrink-0 rounded-md p-2.5 hover:bg-canvas"><X size={20} aria-hidden /></button>
          </div>
        </div>
        <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 md:px-5 md:pb-5">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Action row for the bottom of a dialog form. Sticks to the bottom of the dialog's scrolling body, so Save and Cancel are
 * always reachable. Side by side and full width on phones, right-aligned from md up. Put the Cancel button first.
 */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 col-span-full -mx-4 -mb-4 mt-1 flex gap-2 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:-mx-5 md:-mb-5 md:justify-end md:px-5 md:pb-4 [&>button]:flex-1 md:[&>button]:flex-none">
      {children}
    </div>
  )
}
