import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelSheetRental, createProduct, deleteSheetReturn, listCustomerChoices, listProductChoices, listProducts, listRentals, listSheetPayments,
  listSheetReturns, listVariantChoices, listVariants, recordSheetReturn, saveSheetPayment, saveSheetRental, saveSheetVariant, updateProduct,
  type ProductFilters, type ProductInput, type RentalFilters, type RentalInput, type SheetPaymentInput, type SheetReturnInput, type VariantFilters, type VariantInput,
} from '../../services/sheetService'
import { TRANSPORT_PAGE_SIZE } from '../transport/hooks'

/** Same page size as the shared MasterList (it computes page counts from this constant). */
export const SHEETS_PAGE_SIZE = TRANSPORT_PAGE_SIZE

export const useProducts = (f: ProductFilters, page: number) =>
  useQuery({ queryKey: ['sheet-products', f, page], queryFn: () => listProducts(f, { page, pageSize: SHEETS_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useProductChoices = () => useQuery({ queryKey: ['sheet-product-choices'], queryFn: listProductChoices })

export const useVariants = (f: VariantFilters, page: number) =>
  useQuery({ queryKey: ['sheet-variants', f, page], queryFn: () => listVariants(f, { page, pageSize: SHEETS_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useVariantChoices = () => useQuery({ queryKey: ['sheet-variant-choices'], queryFn: listVariantChoices })
export const useCustomerChoices = () => useQuery({ queryKey: ['sheet-customer-choices'], queryFn: listCustomerChoices })

export const useRentals = (f: RentalFilters, page: number) =>
  useQuery({ queryKey: ['sheet-rentals', f, page], queryFn: () => listRentals(f, { page, pageSize: SHEETS_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useSheetPayments = (rentalId: string) =>
  useQuery({ queryKey: ['sheet-payments', rentalId], queryFn: () => listSheetPayments(rentalId) })
export const useSheetReturns = (rentalId: string) =>
  useQuery({ queryKey: ['sheet-returns', rentalId], queryFn: () => listSheetReturns(rentalId) })

type QC = ReturnType<typeof useQueryClient>

/** Anything that changes stock (rentals, returns, variants) refreshes the lists, the pickers and the stock figures. */
const refreshStock = (qc: QC) => Promise.all([
  qc.invalidateQueries({ queryKey: ['sheet-rentals'] }),
  qc.invalidateQueries({ queryKey: ['sheet-variants'] }),
  qc.invalidateQueries({ queryKey: ['sheet-variant-choices'] }),
  qc.invalidateQueries({ queryKey: ['sheet-returns'] }),
  qc.invalidateQueries({ queryKey: ['sheet-payments'] }),
])
/** Payments (and an advance on a new rental) post to the ledger, so refresh the finance screens too. */
const refreshLedger = (qc: QC) => Promise.all([
  refreshStock(qc),
  qc.invalidateQueries({ queryKey: ['transactions'] }),
  qc.invalidateQueries({ queryKey: ['finance-summary'] }),
])

export function useSaveProduct(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: ProductInput) => (id ? updateProduct(id, p).then(() => id) : createProduct(p)),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['sheet-products'] }),
      qc.invalidateQueries({ queryKey: ['sheet-product-choices'] }),
      qc.invalidateQueries({ queryKey: ['sheet-variants'] }),
      qc.invalidateQueries({ queryKey: ['sheet-variant-choices'] }),
      qc.invalidateQueries({ queryKey: ['sheet-rentals'] }),
    ]),
  })
}
export function useSaveVariant(id?: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (v: VariantInput) => saveSheetVariant(id, v), onSuccess: () => refreshStock(qc) })
}

/** Saves a rental. A new customer (the shared `customers` table, D-017) is created by the form first, via `useSaveCustomer`. */
export function useSaveRental(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (r: RentalInput) => saveSheetRental(id, r),
    onSuccess: () => Promise.all([
      refreshLedger(qc),
      qc.invalidateQueries({ queryKey: ['sheet-customer-choices'] }),
    ]),
  })
}
export function useCancelRental() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => cancelSheetRental(id), onSuccess: () => refreshStock(qc) })
}
export function useSaveSheetPayment(rentalId: string, paymentId?: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (p: SheetPaymentInput) => saveSheetPayment(rentalId, paymentId, p), onSuccess: () => refreshLedger(qc) })
}
export function useRecordReturn(rentalId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (r: SheetReturnInput) => recordSheetReturn(rentalId, r), onSuccess: () => refreshStock(qc) })
}
export function useDeleteReturn() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => deleteSheetReturn(id), onSuccess: () => refreshStock(qc) })
}
