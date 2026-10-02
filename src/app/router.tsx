import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { ModulePlaceholder } from '../pages/ModulePlaceholder'
import { ALL_NAV_ITEMS } from '../lib/navigation'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAdmin } from '../features/auth/RequireAdmin'
import { TransactionsPage } from '../features/finance/TransactionsPage'
import { PropertyListPage } from '../features/property/PropertyListPage'
import { PropertyDetailPage } from '../features/property/PropertyDetailPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/finance', element: <TransactionsPage /> },
          { path: '/property', element: <PropertyListPage /> },
          { path: '/property/:id', element: <PropertyDetailPage /> },
          ...ALL_NAV_ITEMS.filter((n) => n.to !== '/finance' && n.to !== '/property').map((n) => ({ path: n.to, element: <ModulePlaceholder /> })),
          { path: '*', element: <ModulePlaceholder /> },
        ],
      },
    ],
  },
])
