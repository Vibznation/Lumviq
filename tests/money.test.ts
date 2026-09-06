import { describe, it, expect } from 'vitest'
import { toMinorUnits, fromMinorUnits, addMinor, multiplyMinor } from '../src/lib/money'

describe('money.ts minor-unit arithmetic', () => {
  it('converts whole and fractional strings to minor units', () => {
    expect(toMinorUnits('10')).toBe(10_000000n)
    expect(toMinorUnits('10.5')).toBe(10_500000n)
    expect(toMinorUnits('0.000001')).toBe(1n)
  })

  it('handles negative amounts', () => {
    expect(toMinorUnits('-5.25')).toBe(-5_250000n)
  })

  it('handles numeric input via toFixed(6)', () => {
    expect(toMinorUnits(10.5)).toBe(10_500000n)
  })

  it('round-trips fromMinorUnits', () => {
    expect(fromMinorUnits(10_500000n)).toBe('10.500000')
    expect(fromMinorUnits(-5_250000n)).toBe('-5.250000')
    expect(fromMinorUnits(0n)).toBe('0.000000')
  })

  it('adds minor units', () => {
    expect(addMinor(1n, 2n, 3n)).toBe(6n)
    expect(addMinor()).toBe(0n)
  })

  it('multiplies minor units, rescaling back to 6 decimals', () => {
    expect(multiplyMinor(toMinorUnits('2'), toMinorUnits('3'))).toBe(toMinorUnits('6'))
    expect(multiplyMinor(toMinorUnits('2.5'), toMinorUnits('4'))).toBe(toMinorUnits('10'))
  })

  it('matches the tax-rate-as-fraction convention used by invoices/bills', () => {
    // 100 * 0.0825 (8.25%) = 8.25
    expect(fromMinorUnits(multiplyMinor(toMinorUnits('100'), toMinorUnits('0.0825')))).toBe('8.250000')
  })
})
