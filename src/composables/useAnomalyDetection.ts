/**
 * Two-stage anomaly detection for pump flow series.
 *
 * Stage 1 — Pump-off detection:
 *   Values ≤ 5% of series max are treated as "pump off / near-zero".
 *   Always flagged as critical regardless of the rest of the series.
 *
 * Stage 2 — IQR outlier on running values only:
 *   IQR computed only on points where pump is running (> threshold).
 *   A second guard: only flag if the deviation is also > 30% from the
 *   running median, preventing false alarms on extremely stable series
 *   where IQR is tiny (e.g. 0.04 m³/h).
 */

export type AnomalySeverity = 'critical' | 'warning' | 'info'
export type AnomalyType = 'pump_off' | 'outlier_low' | 'outlier_high'

export interface Anomaly {
  ptp: string
  hours: number[]
  type: AnomalyType
  severity: AnomalySeverity
  detail: string
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function fmt(n: number) { return n.toFixed(2) }

const PUMP_OFF_RATIO  = 0.05   // ≤ 5% of series max  → pump off
const MIN_REL_DEV     = 0.30   // outlier must also be > 30% from running median

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

    const maxVal = Math.max(...series.map(p => p.value))
    const offThreshold = maxVal * PUMP_OFF_RATIO

    // ── Stage 1: pump off ────────────────────────────────────────────────
    const offPoints  = series.filter(p => p.value <= offThreshold)
    const runPoints  = series.filter(p => p.value  > offThreshold)

    if (offPoints.length) {
      const hrs = offPoints.map(p => p.hour)
      results.push({
        ptp, hours: hrs, type: 'pump_off', severity: 'critical',
        detail: `Bomba desligada ou fluxo próximo de zero (≤ ${fmt(offThreshold)} m³/h) nas horas: ${hrs.join(', ')}h.`
      })
    }

    // ── Stage 2: IQR on running values only ─────────────────────────────
    if (runPoints.length < 4) return

    const runValues = runPoints.map(p => p.value)
    const sorted    = [...runValues].sort((a, b) => a - b)
    const q1        = quantile(sorted, 0.25)
    const q3        = quantile(sorted, 0.75)
    const iqr       = q3 - q1
    const med       = quantile(sorted, 0.5)
    const lo        = q1 - 1.5 * iqr
    const hi        = q3 + 1.5 * iqr

    const iqrLowHrs  = runPoints
      .filter(p => p.value < lo && Math.abs(p.value - med) / med > MIN_REL_DEV)
      .map(p => p.hour)

    const iqrHighHrs = runPoints
      .filter(p => p.value > hi && Math.abs(p.value - med) / med > MIN_REL_DEV)
      .map(p => p.hour)

    if (iqrLowHrs.length) {
      results.push({
        ptp, hours: iqrLowHrs, type: 'outlier_low', severity: 'warning',
        detail: `Queda anômala durante operação (< ${fmt(lo)} m³/h) nas horas: ${iqrLowHrs.join(', ')}h  ·  mediana=${fmt(med)}  Q1=${fmt(q1)}  Q3=${fmt(q3)}`
      })
    }

    if (iqrHighHrs.length) {
      results.push({
        ptp, hours: iqrHighHrs, type: 'outlier_high', severity: 'info',
        detail: `Pico anômalo durante operação (> ${fmt(hi)} m³/h) nas horas: ${iqrHighHrs.join(', ')}h  ·  mediana=${fmt(med)}  Q1=${fmt(q1)}  Q3=${fmt(q3)}`
      })
    }
  })

  const order: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 }
  return results.sort((a, b) => order[a.severity] - order[b.severity])
}
