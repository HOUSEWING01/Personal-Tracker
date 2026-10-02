import { describe, expect, it } from 'vitest'
import { normalizeRegistration, vehicleTotalInvestmentPaise } from './transportEngine'

describe('vehicleTotalInvestmentPaise', () => {
  it('adds purchase and container price', () => {
    expect(vehicleTotalInvestmentPaise({ purchasePricePaise: 250_000_000, containerPricePaise: 30_000_050 })).toBe(280_000_050)
  })
  it('is zero when nothing is entered', () => {
    expect(vehicleTotalInvestmentPaise({ purchasePricePaise: 0, containerPricePaise: 0 })).toBe(0)
  })
  it('works with only one part', () => {
    expect(vehicleTotalInvestmentPaise({ purchasePricePaise: 500_000, containerPricePaise: 0 })).toBe(500_000)
  })
})

describe('normalizeRegistration', () => {
  it('upper-cases, trims and collapses spaces', () => {
    expect(normalizeRegistration('  tn 38   ab 1234 ')).toBe('TN 38 AB 1234')
  })
  it('keeps hyphens as typed', () => {
    expect(normalizeRegistration('tn-38-ab-1234')).toBe('TN-38-AB-1234')
  })
})
