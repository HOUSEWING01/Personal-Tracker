import { useState } from 'react'
import type { SheetProduct, SheetProductStatus } from '../../types/sheets'
import { MasterList, type Column } from '../transport/MasterList'
import { useProducts } from './hooks'
import { ACTIVE_STATUS_LABELS } from './labels'
import { ProductDialog } from './ProductDialog'
import { StatusPill } from './StatusPill'
import { useSheetListControls } from './useSheetListControls'

const columns: Column<SheetProduct>[] = [
  { header: 'Product', cell: (p) => <span className="font-medium">{p.name}</span> },
  { header: 'Notes', cell: (p) => p.notes ?? '—' },
  { header: 'Status', cell: (p) => <StatusPill tone={p.status === 'active' ? 'good' : 'neutral'}>{ACTIVE_STATUS_LABELS[p.status]}</StatusPill> },
]

export function ProductsTab() {
  const c = useSheetListControls()
  const status: SheetProductStatus | undefined = c.status === 'active' || c.status === 'inactive' ? c.status : undefined
  const list = useProducts({ status, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ product?: SheetProduct } | null>(null)

  return (
    <>
      <ProductDialog key={dialog?.product?.id ?? 'new'} open={dialog !== null} product={dialog?.product} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <MasterList
        noun="product" columns={columns} rowKey={(p) => p.id} rowLabel={(p) => p.name}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by name or notes"
        status={{ value: status ?? 'all', onChange: c.setStatus, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }}
        filtered={Boolean(status || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(product) => setDialog({ product })}
        emptyHint="Add the product you rent out (for example Roofing Sheet). Then add its sizes in Stock."
      />
    </>
  )
}
