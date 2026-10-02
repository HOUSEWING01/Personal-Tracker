import type { KeyboardEvent } from 'react'

/**
 * Keyboard behaviour for a `role="tablist"` (WAI-ARIA tabs): Left / Right move between tabs and wrap, Home / End jump to
 * the first / last. Put the result on the tablist's `onKeyDown`, give each tab `tabIndex={selected ? 0 : -1}` and an
 * element id of `idPrefix + tabId`, so Tab moves into the panel instead of through every tab.
 */
export function tabsKeyDown(ids: readonly string[], current: string, idPrefix: string, select: (id: string) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const i = ids.indexOf(current)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % ids.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = ids.length - 1
    if (next < 0) return
    e.preventDefault()
    select(ids[next])
    setTimeout(() => document.getElementById(`${idPrefix}${ids[next]}`)?.focus(), 0)
  }
}
