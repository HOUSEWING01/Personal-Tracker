import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { ModulePlaceholder } from '../pages/ModulePlaceholder'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAdmin } from '../features/auth/RequireAdmin'

// Each module is its own chunk, so the first screen does not download every module (Phase 10 performance).
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const TransactionsPage = lazy(() => import('../features/finance/TransactionsPage').then((m) => ({ default: m.TransactionsPage })))
const PropertyListPage = lazy(() => import('../features/property/PropertyListPage').then((m) => ({ default: m.PropertyListPage })))
const PropertyDetailPage = lazy(() => import('../features/property/PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage })))
const TransportPage = lazy(() => import('../features/transport/TransportPage').then((m) => ({ default: m.TransportPage })))
const SheetsPage = lazy(() => import('../features/sheets/SheetsPage').then((m) => ({ default: m.SheetsPage })))
const GoldLoansPage = lazy(() => import('../features/gold/GoldLoansPage').then((m) => ({ default: m.GoldLoansPage })))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))

const page = (el: ReactNode) => <Suspense fallback={<p role="status" className="py-10 text-center text-sm text-muted">Loading…</p>}>{el}</Suspense>

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: page(<DashboardPage />) },
          { path: '/finance', element: page(<TransactionsPage />) },
          { path: '/property', element: page(<PropertyListPage />) },
          { path: '/property/:id', element: page(<PropertyDetailPage />) },
          { path: '/transport', element: page(<TransportPage />) },
          { path: '/sheets', element: page(<SheetsPage />) },
          { path: '/gold-loans', element: page(<GoldLoansPage />) },
          { path: '/reports', element: page(<ReportsPage />) },
          { path: '*', element: <ModulePlaceholder /> },
        ],
      },
    ],
  },
])
