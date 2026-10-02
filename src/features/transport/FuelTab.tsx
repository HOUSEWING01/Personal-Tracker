import { useState } from 'react'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { FuelLog } from '../../types/transport'
import { FuelDialog } from './FuelDialog'
import { useFuelLogs } from './hooks'
import { MasterList, type Column } from './MasterList'
import { useListControls } from './useListControls'
import { VehicleFilter } from './VehicleFilter'

const columns: Column<FuelLog>[] = [
  {
    header: 'Fuel',
    cell: (f) => (<><span className="font-medium">{formatDate(f.fuelDate)}</span><div className="text-xs font-normal text-muted">{f.vehicleName} ({f.vehicleRegistration})</div></>),
  },
  { header: 'Litres × price', align: 'right', cell: (f) => `${f.litres} L × ${formatINR(f.pricePerLitrePaise)}` },
  { header: 'Total', align: 'right', cell: (f) => <span className="font-medium">{formatINR(f.totalPaise)}</span> },
  { header: 'Odometer', align: 'right', cell: (f) => (f.odometerKm === null ? '—' : `${f.odometerKm.toLocaleString('en-IN')} km`) },
  { header: 'Trip', cell: (f) => f.tripLabel ?? 'Not linked' },
]

export function FuelTab() {
  const c = useListControls()
  const vehicleId = c.vehicle !== 'all' ? c.vehicle : undefined
  const list = useFuelLogs({ vehicleId, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ fuel?: FuelLog } | null>(null)

  return (
    <>
      <FuelDialog key={dialog?.fuel?.id ?? 'new'} open={dialog !== null} fuel={dialog?.fuel} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <VehicleFilter value={vehicleId ?? 'all'} onChange={c.setVehicle} />
      <MasterList
        noun="fuel log" columns={columns} rowKey={(f) => f.id} rowLabel={(f) => `${f.vehicleName} on ${formatDate(f.fuelDate)}`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by notes"
        filtered={Boolean(vehicleId || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(fuel) => setDialog({ fuel })}
        emptyHint="Record each fill-up with litres and price per litre. Fuel posts to Finance as an expense."
      />
    </>
  )
}
