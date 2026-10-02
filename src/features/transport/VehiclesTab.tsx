import { useState } from 'react'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { VEHICLE_STATUSES, type Vehicle, type VehicleStatus } from '../../types/transport'
import { Pill } from '../property/StatusBadge'
import { useVehicles } from './hooks'
import { VEHICLE_STATUS_LABELS } from './labels'
import { MasterList, type Column } from './MasterList'
import { vehicleTotalInvestmentPaise } from './transportEngine'
import { useListControls } from './useListControls'
import { VehicleDialog } from './VehicleDialog'

const columns: Column<Vehicle>[] = [
  {
    header: 'Vehicle',
    cell: (v) => (<><span className="font-medium">{v.name}</span><div className="text-xs font-normal text-muted">{v.registrationNumber}</div></>),
  },
  { header: 'Purchase price', align: 'right', cell: (v) => formatINR(v.purchasePricePaise) },
  { header: 'Container', align: 'right', cell: (v) => formatINR(v.containerPricePaise) },
  { header: 'Total investment', align: 'right', cell: (v) => <span className="font-medium">{formatINR(vehicleTotalInvestmentPaise(v))}</span> },
  { header: 'Purchased', cell: (v) => formatDate(v.purchaseDate) },
  { header: 'Status', cell: (v) => <Pill tone={v.status === 'active' ? 'good' : 'neutral'}>{VEHICLE_STATUS_LABELS[v.status]}</Pill> },
]

export function VehiclesTab() {
  const c = useListControls()
  const status = (VEHICLE_STATUSES as readonly string[]).includes(c.status) ? (c.status as VehicleStatus) : undefined
  const list = useVehicles({ status, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ vehicle?: Vehicle } | null>(null)

  return (
    <>
      <VehicleDialog key={dialog?.vehicle?.id ?? 'new'} open={dialog !== null} vehicle={dialog?.vehicle} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <MasterList
        noun="vehicle" columns={columns} rowKey={(v) => v.id} rowLabel={(v) => v.name}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by name or registration"
        status={{ value: status ?? 'all', onChange: c.setStatus, options: VEHICLE_STATUSES.map((s) => ({ value: s, label: VEHICLE_STATUS_LABELS[s] })) }}
        filtered={Boolean(status || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(vehicle) => setDialog({ vehicle })}
        emptyHint="Add your first vehicle with its registration number and what you paid for it."
      />
    </>
  )
}
