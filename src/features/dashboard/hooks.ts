import { useQuery } from '@tanstack/react-query'
import { getDashboardCounts } from '../../services/dashboardService'
import { listActiveGoldLoans } from '../../services/goldLoanService'

export const useDashboardCounts = (today: string, monthFrom: string, monthTo: string) =>
  useQuery({ queryKey: ['dashboard-counts', today, monthFrom, monthTo], queryFn: () => getDashboardCounts(today, monthFrom, monthTo), staleTime: 0 })
export const useActiveGoldLoans = () =>
  useQuery({ queryKey: ['gold-loans', 'active-all'], queryFn: listActiveGoldLoans, staleTime: 0 })
