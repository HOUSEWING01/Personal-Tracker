import { describe, expect, it } from 'vitest'
import { maintenanceDueLabel, maintenanceDueState, sumProfitTotals, vehicleAfterFinancingPaise, vehicleOperatingProfitPaise } from './transportEngine'
import { defaultMaintenanceValues, maintenanceFormSchema, toMaintenanceInput } from './transportForms'

const entry = (over: Record<string, string> = {}) => ({
  ...defaultMaintenanceValues('2026-10-03'), vehicleId: 'v-1', amount: '4500', ...over,
})
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? []

describe('maintenanceFormSchema', () => {
  it('accepts the minimum entry and converts to paise', () => {
    const r = maintenanceFormSchema.safeParse(entry())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(toMaintenanceInput(r.data)).toEqual({
        vehicleId: 'v-1', serviceDate: '2026-10-03', kind: 'service', vendor: null, amountPaise: 450_000,
        odometerKm: null, nextDueDate: null, notes: null,
      })
    }
  })
  it('keeps the optional fields', () => {
    const r = maintenanceFormSchema.safeParse(entry({ kind: 'insurance', vendor: ' New India ', odometerKm: '125000', nextDueDate: '2027-10-02', notes: ' renewed ' }))
    expect(r.success).toBe(true)
    if (r.success) {
      const i = toMaintenanceInput(r.data)
      expect(i).toMatchObject({ kind: 'insurance', vendor: 'New India', odometerKm: 125000, nextDueDate: '2027-10-02', notes: 'renewed' })
    }
  })
  it('requires a vehicle and an amount above zero', () => {
    const m = messages(maintenanceFormSchema.safeParse(entry({ vehicleId: '', amount: '' })))
    expect(m).toContain('Choose a vehicle.')
    expect(m).toContain('Enter the amount.')
    expect(messages(maintenanceFormSchema.safeParse(entry({ amount: '0' })))).toContain('Amount must be greater than zero.')
  })
  it('rejects an unknown type, a bad odometer and a next due date before the entry date', () => {
    expect(maintenanceFormSchema.safeParse(entry({ kind: 'washing' })).success).toBe(false)
    expect(maintenanceFormSchema.safeParse(entry({ odometerKm: '12.5' })).success).toBe(false)
    expect(messages(maintenanceFormSchema.safeParse(entry({ nextDueDate: '2026-10-02' })))).toContain('The next due date cannot be before the date of this entry.')
    expect(maintenanceFormSchema.safeParse(entry({ nextDueDate: '2026-10-03' })).success).toBe(true)
  })
})

describe('maintenanceDueState', () => {
  it('is null without a due date or when it is far off', () => {
    expect(maintenanceDueState(null, '2026-10-03')).toBeNull()
    expect(maintenanceDueState('2027-01-01', '2026-10-03')).toBeNull()
  })
  it('flags soon (within 30 days, today included) and overdue', () => {
    expect(maintenanceDueState('2026-10-03', '2026-10-03')).toEqual({ kind: 'soon', days: 0 })
    expect(maintenanceDueState('2026-11-02', '2026-10-03')).toEqual({ kind: 'soon', days: 30 })
    expect(maintenanceDueState('2026-11-03', '2026-10-03')).toBeNull()
    expect(maintenanceDueState('2026-10-01', '2026-10-03')).toEqual({ kind: 'overdue', days: 2 })
  })
  it('words the state', () => {
    expect(maintenanceDueLabel({ kind: 'soon', days: 0 })).toBe('Due today')
    expect(maintenanceDueLabel({ kind: 'soon', days: 1 })).toBe('Due in 1 day')
    expect(maintenanceDueLabel({ kind: 'overdue', days: 5 })).toBe('Overdue by 5 days')
  })
})

describe('vehicle profit with maintenance', () => {
  const a = { vehicleId: 'v-1', vehicleName: 'Bolero', vehicleRegistration: null, revenuePaise: 100_000, driverPaise: 10_000, fuelPaise: 20_000, tollPaise: 5_000, maintenancePaise: 15_000, loanRepaidPaise: 30_000 }
  it('takes maintenance out of operating profit, then loan repayments', () => {
    expect(vehicleOperatingProfitPaise(a)).toBe(50_000)
    expect(vehicleAfterFinancingPaise(a)).toBe(20_000)
  })
  it('sums maintenance across vehicles', () => {
    const t = sumProfitTotals([a, { ...a, maintenancePaise: 5_000 }])
    expect(t.maintenancePaise).toBe(20_000)
    expect(vehicleOperatingProfitPaise(t)).toBe(2 * 100_000 - 2 * 10_000 - 2 * 20_000 - 2 * 5_000 - 20_000)
  })
})
