/**
 * IQR outlier detection (1.5×IQR rule) per PTP.
 * Flags hours where value < Q1−1.5×IQR  or  > Q3+1.5×IQR.
 */

export type AnomalySeverity = 'critical' | 'warning' | 'info'
export type AnomalyType = 'outlier_low' | 'outlier_high'

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

export function detectAnomalies(
  data: Record<string, any>[],
  xField: string,
  ptpKeys: string[]
): Anomaly[] {
  const results: Anomaly[] = []

  ptpKeys.forEach(ptp => {
    const numeric: { hour: number; value: number }[] = []

    data.forEach(row => {
      const raw = row[ptp]
      const isMissing = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')
      if (isMissing) return
      const v = +raw
      if (!isNaN(v)) numeric.push({ hour: +row[xField], value: v })
    })

    if (numeric.length < 4) return

    const sorted = [...numeric.map(p => p.value)].sort((a, b) => a - b)
    const q1  = quantile(sorted, 0.25)
    const q3  = quantile(sorted, 0.75)
    const iqr = q3 - q1
    const lo  = q1 - 1.5 * iqr
    const hi  = q3 + 1.5 * iqr

    const lowHours  = numeric.filter(p => p.value < lo).map(p => p.hour)
    const highHours = numeric.filter(p => p.value > hi).map(p => p.hour)

    if (lowHours.length) {
      results.push({
        ptp, hours: lowHours, type: 'outlier_low', severity: 'critical',
        detail: `Valor abaixo do limite inferior IQR (${fmt(lo)} m³/h) nas horas: ${lowHours.join(', ')}h  ·  Q1=${fmt(q1)}  Q3=${fmt(q3)}  IQR=${fmt(iqr)}`
      })
    }

    if (highHours.length) {
      results.push({
        ptp, hours: highHours, type: 'outlier_high', severity: 'warning',
        detail: `Valor acima do limite superior IQR (${fmt(hi)} m³/h) nas horas: ${highHours.join(', ')}h  ·  Q1=${fmt(q1)}  Q3=${fmt(q3)}  IQR=${fmt(iqr)}`
      })
    }
  })

  return results
}
