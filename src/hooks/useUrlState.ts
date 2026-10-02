import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Typed string query-param state for list screens (search, status, sort, page...).
 * Values equal to their default are removed from the URL. Updates use `replace`
 * so Back/Forward moves between pages, not between keystrokes. Changing any
 * param other than `page` resets `page`.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams()

  const state = Object.fromEntries(
    Object.entries(defaults).map(([k, d]) => [k, params.get(k) ?? d]),
  ) as T

  const update = useCallback(
    (patch: Partial<T>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === defaults[k]) next.delete(k)
            else next.set(k, v)
          }
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams, defaults],
  )

  return [state, update] as const
}
