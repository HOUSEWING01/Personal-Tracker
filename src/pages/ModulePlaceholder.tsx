import { useLocation } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { ALL_NAV_ITEMS } from '../lib/navigation'

export function ModulePlaceholder() {
  const { pathname } = useLocation()
  const item = ALL_NAV_ITEMS.find((n) => n.to === pathname)
  return (
    <>
      <PageHeader title={item?.label ?? 'Not found'} />
      <EmptyState
        title={item ? 'Not built yet' : 'Page not found'}
        description={item ? `This module is planned for Phase ${item.phase}. See IMPLEMENTATION_PLAN.md.` : 'Use the menu to go to an existing page.'}
      />
    </>
  )
}
