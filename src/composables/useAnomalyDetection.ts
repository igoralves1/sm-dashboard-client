/**
 * Control-chart anomaly detection for pump flow series.
 *
 * For each flagged hour, computes a two-tailed p-value:
 *   "probability that this value would occur under normal operation"
 *
 * Low p-value (e.g. 0.3%) means the value is statistically unexpected —
 * it does NOT say what is wrong, only that something is.
 *
 * Stage 1 — Pump-off: values ≤ 5% of series max (always extreme z-score)
 * Stage 2 — IQR on running values with 30% relative-deviation guard
 *
 * Normal distribution parameters (μ, σ) computed from running values only.
 */

export type AnomalySeverity = 'critical' | 'warning' | 'info'
export type AnomalyType     = 'pump_off' | 'outlier_low' | 'outlier_high'

export interface Anomaly {
  ptp:         string
  hours:       number[]
  type:        AnomalyType
  severity:    AnomalySeverity
  pValuePct:   number    // probability of occurrence in normal flow (0–100)
  detail:      string
}

// ── Normal distribution helpers ───────────────────────────────────────────

function erf(x: number): number {
  // Abramowitz & Stegun approximation — max error 1.5×10⁻⁷
  const sign = x >= 0 ? 1 : -1
  const ax = Math.abs(x)
  const t  = 1 / (1 + 0.3275911 * ax)
  const y  = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
               - 0.284496736) * t + 0.254829592) * t) * Math.exp(-ax * ax)
  return sign * y
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/** Two-tailed p-value for a z-score */
function twoTailP(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)))
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function std(arr: number[], mu: number): number {
  const variance = arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo  = Math.floor(pos)
  const hi  = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function fmt(n: number) { return n.toFixed(2) }

/** Format p-value for display */
function fmtP(p: number): string {
  if (p < 0.0001) return '< 0.01%'
  if (p < 0.001)  return (p * 100).toFixed(3) + '%'
  if (p < 0.01)   return (p * 100).toFixed(2) + '%'
  return (p * 100).toFixed(1) + '%'
}

const PUMP_OFF_RATIO = 0.05
const MIN_REL_DEV    = 0.30

export function detectAnomalies(
  data: Record<string, any>[],
  xField: string,
  ptpKeys: string[]
): Anomaly[] {
  const results: Anomaly[] = []

  ptpKeys.forEach(ptp => {
    const series: { hour: number; value: number }[] = []

    data.forEach(row => {
      const raw = row[ptp]
      const missing = raw === null || raw === undefined ||
        (typeof raw === 'string' && raw.trim() === '')
      if (missing) return
      const v = +raw
      if (!isNaN(v)) series.push({ hour: +row[xField], value: v })
    })

    if (series.length < 4) return

    const maxVal       = Math.max(...series.map(p => p.value))
    const offThreshold = maxVal * PUMP_OFF_RATIO
    const offPoints    = series.filter(p => p.value <= offThreshold)
    const runPoints    = series.filter(p => p.value  > offThreshold)

    // Normal distribution parameters from running values
    const runVals = runPoints.map(p => p.value)
    const mu      = runVals.length >= 2 ? mean(runVals) : 0
    const sigma   = runVals.length >= 2 ? std(runVals, mu) : 1

    // ── Stage 1: pump off ────────────────────────────────────────────────
    if (offPoints.length) {
      const hrs = offPoints.map(p => p.hour)
      // Worst-case z-score (most extreme off-point vs running distribution)
      const minZ   = offPoints.reduce((best, p) => {
        const z = sigma > 0 ? Math.abs((p.value - mu) / sigma) : 99
        return Math.max(best, z)
      }, 0)
      const p = sigma > 0 ? twoTailP(minZ) : 0

      results.push({
        ptp, hours: hrs, type: 'pump_off', severity: 'critical',
        pValuePct: p * 100,
        detail: `Bomba desligada ou fluxo próximo de zero (≤ ${fmt(offThreshold)} m³/h) nas horas: ${hrs.join(', ')}h.`
      })
    }

    // ── Stage 2: IQR on running values only ─────────────────────────────
    if (runPoints.length < 4) return

    const sorted = [...runVals].sort((a, b) => a - b)
    const q1     = quantile(sorted, 0.25)
    const q3     = quantile(sorted, 0.75)
    const iqr    = q3 - q1
    const med    = quantile(sorted, 0.5)
    const lo     = q1 - 1.5 * iqr
    const hi     = q3 + 1.5 * iqr

    const iqrLowPts = runPoints.filter(
      p => p.value < lo && Math.abs(p.value - med) / med > MIN_REL_DEV
    )
    const iqrHighPts = runPoints.filter(
      p => p.value > hi && Math.abs(p.value - med) / med > MIN_REL_DEV
    )

    function worstP(pts: typeof iqrLowPts): number {
      if (!pts.length || sigma === 0) return 0
      const maxZ = pts.reduce((best, p) => Math.max(best, Math.abs((p.value - mu) / sigma)), 0)
      return twoTailP(maxZ) * 100
    }

    if (iqrLowPts.length) {
      const hrs = iqrLowPts.map(p => p.hour)
      results.push({
        ptp, hours: hrs, type: 'outlier_low', severity: 'warning',
        pValuePct: worstP(iqrLowPts),
        detail: `Queda anômala durante operação (< ${fmt(lo)} m³/h) nas horas: ${hrs.join(', ')}h  ·  μ=${fmt(mu)}  σ=${fmt(sigma)}`
      })
    }

    if (iqrHighPts.length) {
      const hrs = iqrHighPts.map(p => p.hour)
      results.push({
        ptp, hours: hrs, type: 'outlier_high', severity: 'info',
        pValuePct: worstP(iqrHighPts),
        detail: `Pico anômalo durante operação (> ${fmt(hi)} m³/h) nas horas: ${hrs.join(', ')}h  ·  μ=${fmt(mu)}  σ=${fmt(sigma)}`
      })
    }
  })

  const order: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 }
  return results.sort((a, b) => order[a.severity] - order[b.severity])
}

export { fmtP }
