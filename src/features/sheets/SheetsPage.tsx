import { PageHeader } from '../../components/ui/PageHeader'
import { tabsKeyDown } from '../../components/ui/tabsKeys'
import { useUrlState } from '../../hooks/useUrlState'
import { ProductsTab } from './ProductsTab'
import { RentalsTab } from './RentalsTab'
import { StockTab } from './StockTab'
import { SHEETS_URL_DEFAULTS } from './useSheetListControls'

const TABS = [
  { id: 'rentals', label: 'Rentals' },
  { id: 'stock', label: 'Stock' },
  { id: 'products', label: 'Products' },
] as const
type TabId = (typeof TABS)[number]['id']

export function SheetsPage() {
  const [p, update] = useUrlState(SHEETS_URL_DEFAULTS)
  const tab: TabId = TABS.some((t) => t.id === p.tab) ? (p.tab as TabId) : 'rentals'

  const selectTab = (id: string) => update({ tab: id, q: '', status: 'all', variant: 'all', page: '1' })

  return (
    <>
      <PageHeader title="Sheet rental" description="Rentals with partial returns and payments, stock by size, and the products you rent out." />
      <div role="tablist" aria-label="Sheet rental sections" onKeyDown={tabsKeyDown(TABS.map((t) => t.id), tab, 'sh-tab-', selectTab)} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const selected = t.id === tab
          return (
            <button
              key={t.id} type="button" role="tab" id={`sh-tab-${t.id}`} aria-selected={selected} aria-controls="sh-panel" tabIndex={selected ? 0 : -1}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${selected ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
              onClick={() => selectTab(t.id)}
            >{t.label}</button>
          )
        })}
      </div>
      <div role="tabpanel" id="sh-panel" tabIndex={0} aria-labelledby={`sh-tab-${tab}`}>
        {tab === 'rentals' && <RentalsTab />}
        {tab === 'stock' && <StockTab />}
        {tab === 'products' && <ProductsTab />}
      </div>
    </>
  )
}
