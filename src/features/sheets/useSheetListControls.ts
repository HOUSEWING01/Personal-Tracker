import { useEffect, useState } from 'react'
import { useUrlState } from '../../hooks/useUrlState'

/** URL params shared by every Sheet rental tab. `tab` is owned by the page; the rest by the active tab. */
export const SHEETS_URL_DEFAULTS = { tab: 'rentals', q: '', status: 'all', variant: 'all', page: '1' }

/** Search (debounced), status filter, variant filter and page for the active tab, all kept in the URL. */
export function useSheetListControls() {
  const [p, update] = useUrlState(SHEETS_URL_DEFAULTS)
  const [qText, setQText] = useState(p.q)

  useEffect(() => {
    const id = setTimeout(() => { if (qText !== p.q) update({ q: qText }) }, 300)
    return () => clearTimeout(id)
  }, [qText, p.q, update])

  return {
    q: p.q,
    qText,
    setQText,
    status: p.status,
    setStatus: (s: string) => update({ status: s }),
    variant: p.variant,
    setVariant: (s: string) => update({ variant: s }),
    page: Math.max(1, Number.parseInt(p.page, 10) || 1),
    setPage: (n: number) => update({ page: String(n) }),
    clear: () => { setQText(''); update({ q: '', status: 'all', variant: 'all' }) },
  }
}
