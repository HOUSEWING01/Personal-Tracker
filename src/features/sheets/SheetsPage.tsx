import { PageHeader } from '../../components/ui/PageHeader'
import { TabBar } from '../../components/ui/TabBar'
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
      <TabBar tabs={TABS} current={tab} onSelect={selectTab} label="Sheet rental sections" idPrefix="sh-tab-" panelId="sh-panel" />
      <div role="tabpanel" id="sh-panel" tabIndex={0} aria-labelledby={`sh-tab-${tab}`}>
        {tab === 'rentals' && <RentalsTab />}
        {tab === 'stock' && <StockTab />}
        {tab === 'products' && <ProductsTab />}
      </div>
    </>
  )
}
