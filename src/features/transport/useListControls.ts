import { useEffect, useState } from 'react'
import { useUrlState } from '../../hooks/useUrlState'

/** URL params shared by every Transport tab. `tab` is owned by the page; the rest by the active tab. */
export const TRANSPORT_URL_DEFAULTS = { tab: 'trips', q: '', status: 'all', vehicle: 'all', page: '1', from: '', to: '' }

/** Search (debounced), status filter and page for the active tab, all kept in the URL. */
export function useListControls() {
  const [p, update] = useUrlState(TRANSPORT_URL_DEFAULTS)
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
    vehicle: p.vehicle,
    setVehicle: (s: string) => update({ vehicle: s }),
    page: Math.max(1, Number.parseInt(p.page, 10) || 1),
    setPage: (n: number) => update({ page: String(n) }),
    clear: () => { setQText(''); update({ q: '', status: 'all', vehicle: 'all' }) },
  }
}
