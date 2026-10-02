import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/** Set when a click outside closed a popover, so the click that follows does not also close the dialog behind it. */
let closedByOutsideAt = 0
export function popoverJustClosed(): boolean {
  return performance.now() - closedByOutsideAt < 350
}

type Pos = { top?: number; bottom?: number; left: number; width?: number; minWidth?: number; maxHeight: number }

/**
 * Floating panel for Select and DatePicker. Rendered in a portal with fixed positioning so a dialog's scroll area never
 * clips it; opens below the anchor and flips above when there is more room there. Closes on a press outside it.
 */
export function Popover({ anchor, onClose, matchWidth = true, minWidth, maxHeight = 320, className = '', popRef, children }: {
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  matchWidth?: boolean
  minWidth?: number
  maxHeight?: number
  className?: string
  popRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const local = useRef<HTMLDivElement>(null)
  const pop = popRef ?? local
  const [pos, setPos] = useState<Pos | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const place = useCallback(() => {
    const a = anchor.current, p = pop.current
    if (!a || !p) return
    const r = a.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const gap = 4, margin = 8
    const width = matchWidth ? r.width : undefined
    const effWidth = Math.max(width ?? 0, minWidth ?? 0) || r.width
    // Full content height (not capped), so the panel flips above when it cannot fit below.
    const natural = p.scrollHeight
    const below = vh - r.bottom - margin - gap
    const above = r.top - margin - gap
    const up = below < natural && above > below
    const next: Pos = {
      left: Math.max(margin, Math.min(r.left, vw - effWidth - margin)),
      width, minWidth,
      maxHeight: Math.max(120, Math.min(maxHeight, up ? above : below)),
      ...(up ? { bottom: vh - r.top + gap } : { top: r.bottom + gap }),
    }
    setPos((prev) => (prev && prev.top === next.top && prev.bottom === next.bottom && prev.left === next.left
      && prev.width === next.width && prev.maxHeight === next.maxHeight ? prev : next))
  }, [anchor, pop, matchWidth, minWidth, maxHeight])

  // Re-measure after every render: the content height changes (month vs year view) and the anchor can move.
  useLayoutEffect(() => { place() })

  useEffect(() => {
    const onScroll = (e: Event) => { if (!pop.current?.contains(e.target as Node)) place() }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (pop.current?.contains(t) || anchor.current?.contains(t)) return
      closedByOutsideAt = performance.now()
      closeRef.current()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [anchor, pop, place])

  return createPortal(
    <div
      ref={pop}
      style={{ position: 'fixed', zIndex: 60, visibility: pos ? 'visible' : 'hidden', ...pos }}
      className={`overflow-y-auto rounded-lg border border-line bg-surface shadow-md ${className}`}
    >
      {children}
    </div>,
    document.body,
  )
}
