import { describe, it, expect } from 'vitest'
import { mileageAmount } from '../src/lib/mileage'

describe('mileage.ts', () => {
  it('computes miles * rate rounded to cents', () => {
    expect(mileageAmount(100, 0.67)).toBe(67)
    expect(mileageAmount(12.3, 0.655)).toBeCloseTo(8.06, 2)
  })

  it('handles zero miles', () => {
    expect(mileageAmount(0, 0.67)).toBe(0)
  })
})
