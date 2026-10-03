import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomer, createDriver, getTripCosts, listCustomers, listDrivers, listFuelLogs, listLoanPayments, listLoans, listMaintenance, listMaintenanceDue, listTolls, listVehicleProfitTotals, listTripChoices, listTripOptions, listTrips, listVehicles,
  saveFuelLog, saveLoanPayment, saveMaintenance, saveToll, saveTrip, saveVehicle, saveVehicleLoan,
  updateCustomer, updateDriver,
  type CustomerInput, type DriverFilters, type DriverInput, type FuelFilters, type FuelInput, type LoanFilters, type LoanInput, type LoanPaymentInput, type MaintenanceFilters, type MaintenanceInput, type TollFilters, type TollInput,
  type TripFilters, type TripInput, type VehicleFilters, type VehicleInput,
} from '../../services/transportService'

export const TRANSPORT_PAGE_SIZE = 25

export const useVehicles = (f: VehicleFilters, page: number) =>
  useQuery({ queryKey: ['vehicles', f, page], queryFn: () => listVehicles(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useDrivers = (f: DriverFilters, page: number) =>
  useQuery({ queryKey: ['drivers', f, page], queryFn: () => listDrivers(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useCustomers = (f: { q?: string }, page: number) =>
  useQuery({ queryKey: ['customers', f, page], queryFn: () => listCustomers(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })

export const useTrips = (f: TripFilters, page: number) =>
  useQuery({ queryKey: ['trips', f, page], queryFn: () => listTrips(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useTripCosts = (tripId?: string) => useQuery({ queryKey: ['trip-costs', tripId], queryFn: () => getTripCosts(tripId as string), enabled: Boolean(tripId) })
export const useTripOptions = () => useQuery({ queryKey: ['trip-options'], queryFn: listTripOptions })

export const useFuelLogs = (f: FuelFilters, page: number) =>
  useQuery({ queryKey: ['fuel-logs', f, page], queryFn: () => listFuelLogs(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useTolls = (f: TollFilters, page: number) =>
  useQuery({ queryKey: ['tolls', f, page], queryFn: () => listTolls(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useTripChoices = () => useQuery({ queryKey: ['trip-choices'], queryFn: listTripChoices })

/** Fuel and tolls change a trip's profit and post expenses, so refresh trips and the finance screens too. */
const refreshAfterCost = (qc: ReturnType<typeof useQueryClient>) => Promise.all([
  qc.invalidateQueries({ queryKey: ['fuel-logs'] }),
  qc.invalidateQueries({ queryKey: ['tolls'] }),
  qc.invalidateQueries({ queryKey: ['trips'] }),
  qc.invalidateQueries({ queryKey: ['transactions'] }),
  qc.invalidateQueries({ queryKey: ['finance-summary'] }),
  qc.invalidateQueries({ queryKey: ['vehicle-profit'] }),
])
export function useSaveFuelLog(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Fuel entry updated' : 'Fuel entry added' }, mutationFn: (f: FuelInput) => saveFuelLog(id, f), onSuccess: () => refreshAfterCost(qc) })
}
export function useSaveToll(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Toll updated' : 'Toll added' }, mutationFn: (t: TollInput) => saveToll(id, t), onSuccess: () => refreshAfterCost(qc) })
}

export function useSaveTrip(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Trip updated' : 'Trip added' },
    mutationFn: (t: TripInput) => saveTrip(id, t),
    // A completed trip also writes ledger entries, so refresh the finance screens too.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['trips'] }),
      qc.invalidateQueries({ queryKey: ['trip-options'] }),
      qc.invalidateQueries({ queryKey: ['trip-costs'] }),
      qc.invalidateQueries({ queryKey: ['trip-choices'] }),
      qc.invalidateQueries({ queryKey: ['fuel-logs'] }),
      qc.invalidateQueries({ queryKey: ['tolls'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['finance-summary'] }),
  qc.invalidateQueries({ queryKey: ['vehicle-profit'] }),
    ]),
  })
}

export function useSaveVehicle(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Vehicle updated' : 'Vehicle added' },
    mutationFn: (v: VehicleInput) => saveVehicle(id, v),
    // Saving a vehicle also writes its investment entries, so refresh the finance screens too.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['vehicles'] }),
      qc.invalidateQueries({ queryKey: ['trip-options'] }),
      qc.invalidateQueries({ queryKey: ['trips'] }),
      qc.invalidateQueries({ queryKey: ['fuel-logs'] }),
      qc.invalidateQueries({ queryKey: ['tolls'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['finance-summary'] }),
  qc.invalidateQueries({ queryKey: ['vehicle-profit'] }),
    ]),
  })
}
export function useSaveDriver(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Driver updated' : 'Driver added' },
    mutationFn: (d: DriverInput) => (id ? updateDriver(id, d).then(() => id) : createDriver(d)),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['drivers'] }), qc.invalidateQueries({ queryKey: ['trip-options'] }), qc.invalidateQueries({ queryKey: ['trips'] })]),
  })
}
export function useSaveCustomer(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: CustomerInput) => (id ? updateCustomer(id, c).then(() => id) : createCustomer(c)),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['customers'] }), qc.invalidateQueries({ queryKey: ['trip-options'] }), qc.invalidateQueries({ queryKey: ['trips'] })]),
  })
}

// ---------- vehicle loans (D-020) ----------
export const useLoans = (f: LoanFilters, page: number) =>
  useQuery({ queryKey: ['loans', f, page], queryFn: () => listLoans(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useLoanPayments = (loanId: string) =>
  useQuery({ queryKey: ['loan-payments', loanId], queryFn: () => listLoanPayments(loanId) })

/** A loan or a repayment posts to the ledger, so refresh the finance screens as well. */
const refreshAfterLoan = (qc: ReturnType<typeof useQueryClient>) => Promise.all([
  qc.invalidateQueries({ queryKey: ['loans'] }),
  qc.invalidateQueries({ queryKey: ['loan-payments'] }),
  qc.invalidateQueries({ queryKey: ['transactions'] }),
  qc.invalidateQueries({ queryKey: ['finance-summary'] }),
  qc.invalidateQueries({ queryKey: ['vehicle-profit'] }),
])
export function useSaveLoan(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Loan updated' : 'Loan added' }, mutationFn: (l: LoanInput) => saveVehicleLoan(id, l), onSuccess: () => refreshAfterLoan(qc) })
}
export function useSaveLoanPayment(loanId: string, paymentId?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: paymentId ? 'Payment updated' : 'Payment recorded' }, mutationFn: (p: LoanPaymentInput) => saveLoanPayment(loanId, paymentId, p), onSuccess: () => refreshAfterLoan(qc) })
}

export const useVehicleProfit = (from: string, to: string) =>
  useQuery({ queryKey: ['vehicle-profit', from, to], queryFn: () => listVehicleProfitTotals(from, to) })

export const useMaintenance = (f: MaintenanceFilters, page: number) =>
  useQuery({ queryKey: ['maintenance', f, page], queryFn: () => listMaintenance(f, { page, pageSize: TRANSPORT_PAGE_SIZE }), placeholderData: keepPreviousData })
export const useMaintenanceDue = () => useQuery({ queryKey: ['maintenance-due'], queryFn: listMaintenanceDue })
/** Maintenance posts an expense and changes vehicle profit and the due list, so refresh those and the finance screens. */
export function useSaveMaintenance(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { success: id ? 'Maintenance entry updated' : 'Maintenance entry added' },
    mutationFn: (m: MaintenanceInput) => saveMaintenance(id, m),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['maintenance'] }),
      qc.invalidateQueries({ queryKey: ['maintenance-due'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['finance-summary'] }),
      qc.invalidateQueries({ queryKey: ['vehicle-profit'] }),
    ]),
  })
}
