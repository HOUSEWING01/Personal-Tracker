import { useState } from 'react'
import type { SheetVariant, SheetVariantStatus } from '../../types/sheets'
import { MasterList, type Column } from '../transport/MasterList'
import { useVariants } from './hooks'
import { ACTIVE_STATUS_LABELS } from './labels'
import { variantLabel } from './sheetEngine'
import { StatusPill } from './StatusPill'
import { useSheetListControls } from './useSheetListControls'
import { VariantDialog } from './VariantDialog'

const columns: Column<SheetVariant>[] = [
  { header: 'Variant', cell: (v) => (<><span className="font-medium">{variantLabel(v.lengthFt)}</span><div className="text-xs font-normal text-muted">{v.productName}</div></>) },
  { header: 'Total', align: 'right', cell: (v) => v.totalQuantity },
  { header: 'Rented', align: 'right', cell: (v) => v.rentedQuantity },
  { header: 'Damaged', align: 'right', cell: (v) => v.damagedQuantity },
  { header: 'Missing', align: 'right', cell: (v) => v.missingQuantity },
  { header: 'Available', align: 'right', cell: (v) => <span className="font-medium">{v.availableQuantity}</span> },
  { header: 'Status', cell: (v) => <StatusPill tone={v.status === 'active' ? 'good' : 'neutral'}>{ACTIVE_STATUS_LABELS[v.status]}</StatusPill> },
]

export function StockTab() {
  const c = useSheetListControls()
  const status: SheetVariantStatus | undefined = c.status === 'active' || c.status === 'inactive' ? c.status : undefined
  const list = useVariants({ status, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ variant?: SheetVariant } | null>(null)

  return (
    <>
      <VariantDialog key={dialog?.variant?.id ?? 'new'} open={dialog !== null} variant={dialog?.variant} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <MasterList
        noun="variant" columns={columns} rowKey={(v) => v.id} rowLabel={(v) => `${v.productName} ${variantLabel(v.lengthFt)}`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by product or size"
        status={{ value: status ?? 'all', onChange: c.setStatus, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }}
        filtered={Boolean(status || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(variant) => setDialog({ variant })}
        emptyHint="Add each size you rent out (for example 8 ft) with how many you own. Rented, damaged and missing sheets are tracked from rentals and returns."
      />
    </>
  )
}
