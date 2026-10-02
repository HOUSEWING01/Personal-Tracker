import { describe, expect, it } from 'vitest'
import { formatINR, toPaise } from './money'

describe('money', () => {
  it('parses without float error', () => {
    expect(toPaise('0.1') + toPaise('0.2')).toBe(30)
    expect(toPaise('₹1,23,456.5')).toBe(12345650)
    expect(toPaise(6000)).toBe(600000)
  })
  it('rejects invalid input', () => {
    expect(() => toPaise('12.345')).toThrow()
    expect(() => toPaise('abc')).toThrow()
  })
  it('formats as INR', () => {
    expect(formatINR(12345650)).toContain('1,23,456.50')
  })
})
