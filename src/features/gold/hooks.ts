import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listGoldLoanPayments, listGoldLoans, saveGoldLoan, saveGoldLoanPayment,
  type GoldLoanFilters, type GoldLoanInput, type GoldLoanPaymentInput,
} from '../../services/goldLoanService'

export const GOLD_PAGE_SIZE = 25

export const useGoldLoans = (f: GoldLoanFilters, page: number) =>
  useQuery({ queryKey: ['gold-loans', f, page], queryFn: () => listGoldLoans(f, { page, pageSize: GOLD_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useGoldLoanPayments = (loanId: string) =>
  useQuery({ queryKey: ['gold-loan-payments', loanId], queryFn: () => listGoldLoanPayments(loanId) })

/** A loan or a repayment posts to the ledger, so refresh the finance screens as well. */
const refresh = (qc: ReturnType<typeof useQueryClient>) => Promise.all([
  qc.invalidateQueries({ queryKey: ['gold-loans'] }),
  qc.invalidateQueries({ queryKey: ['gold-loan-payments'] }),
  qc.invalidateQueries({ queryKey: ['transactions'] }),
  qc.invalidateQueries({ queryKey: ['finance-summary'] }),
])
export function useSaveGoldLoan(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Gold loan updated' : 'Gold loan added' }, mutationFn: (l: GoldLoanInput) => saveGoldLoan(id, l), onSuccess: () => refresh(qc) })
}
export function useSaveGoldLoanPayment(loanId: string, paymentId?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: paymentId ? 'Payment updated' : 'Payment recorded' }, mutationFn: (p: GoldLoanPaymentInput) => saveGoldLoanPayment(loanId, paymentId, p), onSuccess: () => refresh(qc) })
}
