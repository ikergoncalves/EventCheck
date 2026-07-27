/** Presentation helpers with no domain knowledge beyond formatting. */

/**
 * The attendance ratio shown across the app, e.g. `24 / 37`.
 *
 * Kept as a pair of raw counters rather than a percentage: the contract's
 * `tickets_issued` can be 0, and "0 / 0" reads better than "NaN%".
 */
export function formatRatio(numerator: number, denominator: number): string {
  return `${numerator} / ${denominator}`
}

/** Attendance as a whole percentage; 0 when nothing has been issued. */
export function formatPercentage(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}
