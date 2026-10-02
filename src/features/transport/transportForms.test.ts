import { describe, expect, it } from 'vitest'
import {
  customerFormSchema, defaultCustomerValues, defaultDriverValues, defaultVehicleValues, driverFormSchema,
  toCustomerInput, toDriverInput, toVehicleInput, vehicleFormSchema,
} from './transportForms'

const vehicle = (over: Record<string, string> = {}) => ({ ...defaultVehicleValues(), name: 'Lorry 1', registrationNumber: 'tn 38 ab 1234', purchaseDate: '2026-03-10', ...over })
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? []

describe('vehicleFormSchema', () => {
  it('accepts a vehicle with name, registration and purchase date (prices blank = 0)', () => {
    const r = vehicleFormSchema.safeParse(vehicle())
    expect(r.success).toBe(true)
    if (r.success) {
      const i = toVehicleInput(r.data)
      expect(i.registrationNumber).toBe('TN 38 AB 1234')
      expect(i.purchasePricePaise).toBe(0)
      expect(i.containerPricePaise).toBe(0)
      expect(i.purchaseDate).toBe('2026-03-10')
      expect(i.containerDetails).toBeNull()
    }
  })
  it('converts prices to whole paise', () => {
    const r = vehicleFormSchema.safeParse(vehicle({ purchasePrice: '2500000.50', containerPrice: '300000' }))
    expect(r.success).toBe(true)
    if (r.success) {
      const i = toVehicleInput(r.data)
      expect(i.purchasePricePaise).toBe(250_000_050)
      expect(i.containerPricePaise).toBe(30_000_000)
    }
  })
  it('requires a name and a registration number', () => {
    const r = vehicleFormSchema.safeParse(vehicle({ name: ' ', registrationNumber: '' }))
    expect(r.success).toBe(false)
    expect(messages(r)).toEqual(expect.arrayContaining(['Enter a vehicle name.', 'Enter the registration number.']))
  })
  it('rejects negative, malformed and over-precise prices', () => {
    for (const bad of ['-5', 'abc', '10.123']) {
      expect(vehicleFormSchema.safeParse(vehicle({ purchasePrice: bad })).success).toBe(false)
    }
  })
  it('rejects odd characters in the registration number', () => {
    expect(vehicleFormSchema.safeParse(vehicle({ registrationNumber: 'TN@38' })).success).toBe(false)
    expect(vehicleFormSchema.safeParse(vehicle({ registrationNumber: 'TN-38-AB-1234' })).success).toBe(true)
  })
  it('requires a purchase date', () => {
    const r = vehicleFormSchema.safeParse(vehicle({ purchaseDate: '' }))
    expect(r.success).toBe(false)
    expect(messages(r)).toContain('Enter the purchase date.')
  })
  it('rejects an impossible purchase date', () => {
    expect(vehicleFormSchema.safeParse(vehicle({ purchaseDate: '2026-02-31' })).success).toBe(false)
    expect(vehicleFormSchema.safeParse(vehicle({ purchaseDate: '2026-02-20' })).success).toBe(true)
  })
})

describe('driverFormSchema', () => {
  it('needs only a name; blank mobile becomes null', () => {
    const r = driverFormSchema.safeParse({ ...defaultDriverValues(), name: ' Murugan ' })
    expect(r.success).toBe(true)
    if (r.success) expect(toDriverInput(r.data)).toEqual({ name: 'Murugan', mobile: null, address: null, status: 'active', notes: null })
  })
  it('requires a 10-digit mobile when given', () => {
    expect(driverFormSchema.safeParse({ ...defaultDriverValues(), name: 'A', mobile: '12345' }).success).toBe(false)
    expect(driverFormSchema.safeParse({ ...defaultDriverValues(), name: 'A', mobile: '9876543210' }).success).toBe(true)
  })
})

describe('customerFormSchema', () => {
  it('trims and nulls blank optional fields', () => {
    const r = customerFormSchema.safeParse({ ...defaultCustomerValues(), name: ' Kumar Traders ', mobile: '9000000001' })
    expect(r.success).toBe(true)
    if (r.success) expect(toCustomerInput(r.data)).toEqual({ name: 'Kumar Traders', mobile: '9000000001', address: null, notes: null })
  })
  it('requires a name', () => {
    expect(customerFormSchema.safeParse(defaultCustomerValues()).success).toBe(false)
  })
})
