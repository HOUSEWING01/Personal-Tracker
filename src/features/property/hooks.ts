import { useRef } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  createProperty, deleteRentPayment, ensureRentCharges, getProperty, getTenant, listAdvanceMovements, listProperties, listRentCharges,
  listRentPayments, recordAdvanceMovement, recordRentPayment, saveTenant, updateProperty,
  type AdvanceInput, type PropertyFilters, type PropertyInput, type RentPaymentInput, type TenantInput,
} from '../../services/propertyService'
import type { PropertyOverview, Tenant } from '../../types/property'
import type { GodownInput } from './propertyForms'

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
export function useDeleteRentPayment(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) => deleteRentPayment(paymentId),
    onSuccess: () => Promise.all([
      refreshProperty(qc),
      qc.invalidateQueries({ queryKey: ['rent-charges', propertyId] }),
      qc.invalidateQueries({ queryKey: ['rent-payments', propertyId] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }), qc.invalidateQueries({ queryKey: ['finance-summary'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }), qc.invalidateQueries({ queryKey: ['report-breakdown'] }),
    ]),
  })
}
export function useRecordAdvance(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: AdvanceInput) => recordAdvanceMovement(propertyId, a),
    onSuccess: () => Promise.all([
      refreshProperty(qc), qc.invalidateQueries({ queryKey: ['advance', propertyId] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }), qc.invalidateQueries({ queryKey: ['finance-summary'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }), qc.invalidateQueries({ queryKey: ['report-breakdown'] }),
    ]),
  })
}

/** Everything that changes after a godown, its tenant, its advance or its rent changes. */
const refreshGodown = (qc: QueryClient, id: string) => Promise.all([
  refreshProperty(qc),
  qc.invalidateQueries({ queryKey: ['tenant', id] }),
  qc.invalidateQueries({ queryKey: ['rent-sync'] }),
  qc.invalidateQueries({ queryKey: ['rent-charges', id] }),
  qc.invalidateQueries({ queryKey: ['advance', id] }),
  qc.invalidateQueries({ queryKey: ['transactions'] }), qc.invalidateQueries({ queryKey: ['finance-summary'] }),
  qc.invalidateQueries({ queryKey: ['dashboard'] }), qc.invalidateQueries({ queryKey: ['report-breakdown'] }),
])

/**
 * One save for a godown, its tenant and the advance received.
 *   add   - new godown + its first tenant (+ advance)
 *   edit  - change name, mobile, rent, start date or location; the tenancy end date and notes stay
 *   relet - a new tenant for an existing godown (+ advance); replaces the old tenant (D-012)
 * The steps run in order. If a later step fails, a retry skips the ones already done, so nothing is saved twice.
 */
export function useSaveGodown(mode: 'add' | 'edit' | 'relet', property?: PropertyOverview, tenant?: Tenant | null) {
  const qc = useQueryClient()
  const done = useRef<{ id?: string; advance?: boolean }>({})
  return useMutation({
    mutationFn: async (v: GodownInput): Promise<string> => {
      const d = done.current
      let id = property?.id ?? d.id
      if (!id) {
        id = await createProperty({ name: v.name, type: 'godown', status: 'active', monthlyRentPaise: v.monthlyRentPaise, address: v.address, description: null })
        d.id = id
      } else if (property) {
        await updateProperty(id, {
          name: v.name, type: property.type, status: property.status, monthlyRentPaise: v.monthlyRentPaise,
          address: v.address, description: property.description,
        })
      }
      const keep = mode === 'edit' ? tenant : null
      await saveTenant(id, {
        name: v.name, mobile: v.mobile, address: keep?.address ?? null, notes: keep?.notes ?? null,
        rentalStartDate: v.rentalStartDate, rentalEndDate: keep?.rentalEndDate ?? null,
      })
      if (mode !== 'edit' && v.advancePaise > 0 && !d.advance) {
        await recordAdvanceMovement(id, { kind: 'received', amountPaise: v.advancePaise, date: v.rentalStartDate, notes: null })
        d.advance = true
      }
      return id
    },
    onSettled: (id) => { if (id ?? property?.id) void refreshGodown(qc, (id ?? property?.id) as string) },
  })
}

/** The tenant is leaving: set the end date, then hand back the advance. A retry never returns it twice. */
export function useLeaveTenancy(propertyId: string, tenant: Tenant) {
  const qc = useQueryClient()
  const returned = useRef(false)
  return useMutation({
    mutationFn: async ({ leaveDate, returnPaise }: { leaveDate: string; returnPaise: number }) => {
      await saveTenant(propertyId, {
        name: tenant.name, mobile: tenant.mobile, address: tenant.address, notes: tenant.notes,
        rentalStartDate: tenant.rentalStartDate, rentalEndDate: leaveDate,
      })
      if (returnPaise > 0 && !returned.current) {
        await recordAdvanceMovement(propertyId, { kind: 'returned', amountPaise: returnPaise, date: leaveDate, notes: 'Tenant left' })
        returned.current = true
      }
    },
    onSettled: () => { void refreshGodown(qc, propertyId) },
  })
}
