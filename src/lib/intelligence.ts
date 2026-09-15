/**
 * Pure, deterministic math helpers backing src/pages/api/intelligence/insights.ts.
 * Extracted so the statistical logic (linear projection, z-score outlier
 * detection) can be unit tested independently of Prisma/DB access. None
 * of this calls an external AI/LLM provider — see insights.ts header
 * comment for the full "not an LLM" rationale.
 */

/** Simple linear run-rate projection: (netAmountOverWindow / windowDays) * forecastDays. */
export function computeLinearForecast(netAmountOverWindow: number, windowDays = 90, forecastDays = 30) {
  const dailyRate = windowDays !== 0 ? netAmountOverWindow / windowDays : 0
  const projected = dailyRate * forecastDays
  return { dailyRate, projected }
}

/**
 * Cash-shortage forecast: how many days until cash on hand is depleted
 * at the current burn rate. Returns `daysToShortage: null` when cash
 * flow is non-negative (no shortage to project) or current cash is
 * already zero/negative (nothing left to project a countdown from).
 */
export function computeCashShortageForecast(currentCash: number, netCashFlowWindow: number, windowDays = 90) {
  const { dailyRate: dailyBurn } = computeLinearForecast(netCashFlowWindow, windowDays, 1)
  const daysToShortage = dailyBurn < 0 && currentCash > 0 ? Math.floor(currentCash / -dailyBurn) : null
  return { dailyBurn, daysToShortage }
}

/**
 * Z-score outlier detection: flags entries whose `total` is more than
 * `thresholdStdDev` standard deviations from the sample mean. Returns
 * an empty `outliers` array (rather than throwing) for empty input or
 * a zero-variance sample (all totals identical).
 */
export function computeZScoreOutliers<T extends { total: number }>(entries: T[], thresholdStdDev = 2) {
  const n = entries.length
  const mean = n > 0 ? entries.reduce((s, e) => s + e.total, 0) / n : 0
  const variance = n > 0 ? entries.reduce((s, e) => s + (e.total - mean) ** 2, 0) / n : 0
  const stdDev = Math.sqrt(Math.max(0, variance))
  const outliers = stdDev > 0 ? entries.filter((e) => Math.abs(e.total - mean) > thresholdStdDev * stdDev) : []
  return { mean, variance, stdDev, outliers }
}
