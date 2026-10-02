import { useState } from 'react'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { Toll } from '../../types/transport'
import { useTolls } from './hooks'
import { MasterList, type Column } from './MasterList'
import { TollDialog } from './TollDialog'
import { useListControls } from './useListControls'
import { VehicleFilter } from './VehicleFilter'

const columns: Column<Toll>[] = [
  {
    header: 'Toll',
    cell: (t) => (<><span className="font-medium">{formatDate(t.tollDate)}</span><div className="text-xs font-normal text-muted">{t.vehicleName} ({t.vehicleRegistration})</div></>),
  },
  { header: 'Amount', align: 'right', cell: (t) => <span className="font-medium">{formatINR(t.amountPaise)}</span> },
  { header: 'Location', cell: (t) => t.location ?? '—' },
  { header: 'Trip', cell: (t) => t.tripLabel },
]

export function TollsTab() {
  const c = useListControls()
  const vehicleId = c.vehicle !== 'all' ? c.vehicle : undefined
  const list = useTolls({ vehicleId, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ toll?: Toll } | null>(null)

  return (
    <>
      <TollDialog key={dialog?.toll?.id ?? 'new'} open={dialog !== null} toll={dialog?.toll} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <MasterList
        filters={<VehicleFilter value={vehicleId ?? 'all'} onChange={c.setVehicle} />} filterCount={vehicleId ? 1 : 0}
        noun="toll" columns={columns} rowKey={(t) => t.id} rowLabel={(t) => `${t.vehicleName} on ${formatDate(t.tollDate)}`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by location or notes"
        filtered={Boolean(vehicleId || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(toll) => setDialog({ toll })}
        emptyHint="Record tolls against the trip they were paid on. Tolls post to Finance as an expense."
      />
    </>
  )
}
