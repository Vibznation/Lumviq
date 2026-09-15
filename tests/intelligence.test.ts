import { describe, it, expect } from 'vitest'
import { computeCashShortageForecast, computeLinearForecast, computeZScoreOutliers } from '../src/lib/intelligence'

describe('computeLinearForecast', () => {
  it('projects a positive run rate forward', () => {
    const { dailyRate, projected } = computeLinearForecast(900, 90, 30)
    expect(dailyRate).toBe(10)
    expect(projected).toBe(300)
  })

  it('projects a negative run rate forward', () => {
    const { dailyRate, projected } = computeLinearForecast(-900, 90, 30)
    expect(dailyRate).toBe(-10)
    expect(projected).toBe(-300)
  })

  it('does not divide by zero when windowDays is 0', () => {
    const { dailyRate, projected } = computeLinearForecast(500, 0, 30)
    expect(dailyRate).toBe(0)
    expect(projected).toBe(0)
  })
})

describe('computeCashShortageForecast', () => {
  it('returns null daysToShortage when cash flow is non-negative', () => {
    const { daysToShortage } = computeCashShortageForecast(10000, 900, 90)
    expect(daysToShortage).toBeNull()
  })

  it('projects days to shortage for a negative burn rate', () => {
    const { dailyBurn, daysToShortage } = computeCashShortageForecast(1000, -100, 90)
    expect(dailyBurn).toBeCloseTo(-100 / 90)
    expect(daysToShortage).toBe(Math.floor(1000 / (100 / 90)))
  })

  it('returns null when current cash is already zero or negative', () => {
    expect(computeCashShortageForecast(0, -100, 90).daysToShortage).toBeNull()
    expect(computeCashShortageForecast(-50, -100, 90).daysToShortage).toBeNull()
  })
})

describe('computeZScoreOutliers', () => {
  it('flags no outliers when all totals are identical (zero variance)', () => {
    const entries = [{ total: 100 }, { total: 100 }, { total: 100 }]
    const { outliers, stdDev } = computeZScoreOutliers(entries)
    expect(stdDev).toBe(0)
    expect(outliers).toHaveLength(0)
  })

  it('flags a clear outlier more than 2 standard deviations from the mean', () => {
    const entries = [{ total: 100 }, { total: 105 }, { total: 95 }, { total: 102 }, { total: 98 }, { total: 101 }, { total: 99 }, { total: 1000000 }]
    const { outliers } = computeZScoreOutliers(entries, 2)
    expect(outliers).toHaveLength(1)
    expect(outliers[0].total).toBe(1000000)
  })

  it('handles an empty input array without throwing', () => {
    const { mean, stdDev, outliers } = computeZScoreOutliers([])
    expect(mean).toBe(0)
    expect(stdDev).toBe(0)
    expect(outliers).toHaveLength(0)
  })

  it('respects a custom threshold', () => {
    const entries = [{ total: 10 }, { total: 12 }, { total: 8 }, { total: 20 }]
    const wide = computeZScoreOutliers(entries, 3)
    const narrow = computeZScoreOutliers(entries, 0.5)
    expect(wide.outliers.length).toBeLessThanOrEqual(narrow.outliers.length)
  })
})
