import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  createProperty, ensureRentCharges, getProperty, getTenant, listAdvanceMovements, listProperties, listRentCharges,
  listRentPayments, recordAdvanceMovement, recordRentPayment, saveTenant, updateProperty,
  type AdvanceInput, type PropertyFilters, type PropertyInput, type RentPaymentInput, type TenantInput,
} from '../../services/propertyService'

export const PROPERTY_PAGE_SIZE = 25

/** Charges are created lazily (idempotent). Screens wait for this before reading rent figures. */
export function useRentSync(propertyId?: string) {
  return useQuery({ queryKey: ['rent-sync', propertyId ?? 'all'], queryFn: () => ensureRentCharges(propertyId) })
}

export function useProperties(filters: PropertyFilters, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['properties', filters, page],
    queryFn: () => listProperties(filters, { page, pageSize: PROPERTY_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
  })
}
export const useProperty = (id: string, enabled: boolean) =>
  useQuery({ queryKey: ['property', id], queryFn: () => getProperty(id), enabled })
export const useTenant = (id: string) => useQuery({ queryKey: ['tenant', id], queryFn: () => getTenant(id) })
export const useRentCharges = (id: string, enabled: boolean) =>
  useQuery({ queryKey: ['rent-charges', id], queryFn: () => listRentCharges(id), enabled })
export const useRentPayments = (id: string) => useQuery({ queryKey: ['rent-payments', id], queryFn: () => listRentPayments(id) })
export const useAdvanceMovements = (id: string) => useQuery({ queryKey: ['advance', id], queryFn: () => listAdvanceMovements(id) })

const refreshProperty = (qc: QueryClient) => Promise.all([
  qc.invalidateQueries({ queryKey: ['properties'] }),
  qc.invalidateQueries({ queryKey: ['property'] }),
])

export function useSaveProperty(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: PropertyInput) => (id ? updateProperty(id, p).then(() => id) : createProperty(p)),
    onSuccess: () => refreshProperty(qc),
  })
}
export function useSaveTenant(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (t: TenantInput) => saveTenant(propertyId, t),
    // Tenancy dates decide which months get charges, so re-sync them.
    onSuccess: () => Promise.all([
      refreshProperty(qc),
      qc.invalidateQueries({ queryKey: ['tenant', propertyId] }),
      qc.invalidateQueries({ queryKey: ['rent-sync'] }),
      qc.invalidateQueries({ queryKey: ['rent-charges', propertyId] }),
    ]),
  })
}
export function useRecordRentPayment(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ period, ...p }: RentPaymentInput & { period: string }) => recordRentPayment(propertyId, period, p),
    // The payment also created a ledger entry, so refresh the finance screens too.
    onSuccess: () => Promise.all([
      refreshProperty(qc),
      qc.invalidateQueries({ queryKey: ['rent-charges', propertyId] }),
      qc.invalidateQueries({ queryKey: ['rent-payments', propertyId] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['finance-summary'] }),
    ]),
  })
}
export function useRecordAdvance(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: AdvanceInput) => recordAdvanceMovement(propertyId, a),
    onSuccess: () => Promise.all([refreshProperty(qc), qc.invalidateQueries({ queryKey: ['advance', propertyId] })]),
  })
}
