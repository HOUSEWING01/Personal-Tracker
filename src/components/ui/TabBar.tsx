import { useEffect, useRef } from 'react'
import { tabsKeyDown } from './tabsKeys'

/**
 * Tab strip for a page. Scrolls sideways on narrow screens (scrollbar hidden, the chosen tab scrolled into view) and
 * keeps the WAI-ARIA keyboard behaviour. Pair with a `role="tabpanel"` whose id is `panelId`.
 */
export function TabBar({ tabs, current, onSelect, label, idPrefix, panelId }: {
  tabs: readonly { id: string; label: string }[]; current: string; onSelect: (id: string) => void
  label: string; idPrefix: string; panelId: string
}) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (el && list.current) {
      const box = list.current
      box.scrollTo?.({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [current])
  return (
    <div className="-mx-4 mb-5 border-b border-line lg:mx-0">
      <div
        ref={list} role="tablist" aria-label={label}
        onKeyDown={tabsKeyDown(tabs.map((t) => t.id), current, idPrefix, onSelect)}
        className="scrollbar-hide flex gap-1 overflow-x-auto overflow-y-hidden px-4 lg:px-0"
      >
        {tabs.map((t) => {
          const selected = t.id === current
          return (
            <button
              key={t.id} type="button" role="tab" id={`${idPrefix}${t.id}`} aria-selected={selected} aria-controls={panelId} tabIndex={selected ? 0 : -1}
              className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium lg:min-h-0 ${selected ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
              onClick={() => onSelect(t.id)}
            >{t.label}</button>
          )
        })}
      </div>
    </div>
  )
}
