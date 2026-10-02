import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTransaction, getTotalsByType, listTransactions, type TransactionFilters, type TransactionSort } from '../../services/transactionService'
import { summarizeFromTotals } from './financeEngine'

export const PAGE_SIZE = 25

export function useTransactions(filters: TransactionFilters, page: number, sort: TransactionSort, enabled: boolean) {
  return useQuery({
    queryKey: ['transactions', filters, page, sort],
    queryFn: () => listTransactions(filters, { page, pageSize: PAGE_SIZE, sort }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useFinanceSummary(range: Pick<TransactionFilters, 'from' | 'to' | 'module'>, enabled: boolean) {
  return useQuery({
    queryKey: ['finance-summary', range],
    queryFn: async () => summarizeFromTotals(await getTotalsByType(range)),
    enabled,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: 'Transaction added' },
    mutationFn: createTransaction,
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['finance-summary'] }),
    ]),
  })
}
