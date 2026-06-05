/**
 * Statistical anomaly detection for time-series production data.
 *
 * Three complementary models run in sequence:
 *   1. Sudden change  — rolling 3-point mean, flags >60% drop or >80% spike
 *   2. IQR outlier    — classical box-plot fence (1.5×IQR), catches sustained lows/highs
 *   3. Sustained low  — N consecutive values below 10% of series median
 *
 * All models operate per-PTP so each pump's own baseline is used.
 */

export type AnomalySeverity = 'critical' | 'warning' | 'info'
export type AnomalyType =
  | 'sudden_drop'
  | 'sudden_spike'
  | 'outlier_low'
  | 'outlier_high'
  | 'sustained_low'
  | 'missing'
  | 'zero'

export interface Anomaly {
  ptp: string
  hours: number[]
  type: AnomalyType
  severity: AnomalySeverity
  detail: string   // human-readable, includes numeric evidence
}

// ── helpers ────────────────────────────────────────────────────────────────

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  return quantile(s, 0.5)
}

function fmt(n: number) { return n.toFixed(2) }

// ── main export ────────────────────────────────────────────────────────────

export function detectAnomalies(
  data: Record<string, any>[],
  xField: string,
  ptpKeys: string[]
): Anomaly[] {
  const results: Anomaly[] = []

  ptpKeys.forEach(ptp => {
    // Build ordered series [{hour, value}], skip truly missing
    const series: { hour: number; value: number | null }[] = data.map(row => {
      const h = +row[xField]
      const raw = row[ptp]
      const isMissing =
        raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')
      const value = isMissing ? null : isNaN(+raw) ? null : +raw
      return { hour: h, value }
    })

    // ── missing / zero (data hygiene, not statistical) ──────────────────
    const missingHours = series.filter(p => p.value === null).map(p => p.hour)
    const zeroHours    = series.filter(p => p.value !== null && p.value === 0).map(p => p.hour)

    if (missingHours.length) {
      results.push({
        ptp, hours: missingHours, type: 'missing', severity: 'critical',
        detail: `Sem leitura (dado ausente) nas horas: ${missingHours.join(', ')}h. Verificar conectividade do sensor.`
      })
    }
    if (zeroHours.length) {
      results.push({
        ptp, hours: zeroHours, type: 'zero', severity: 'critical',
        detail: `Leitura exatamente zero nas horas: ${zeroHours.join(', ')}h. Bomba desligada ou sensor zerado.`
      })
    }

    // Numeric-only points for statistical models
    const numeric = series.filter(p => p.value !== null && p.value > 0) as { hour: number; value: number }[]
    if (numeric.length < 4) return  // not enough points for stats

    const values = numeric.map(p => p.value)
    const sorted = [...values].sort((a, b) => a - b)
    const med    = median(values)
    const q1     = quantile(sorted, 0.25)
    const q3     = quantile(sorted, 0.75)
    const iqr    = q3 - q1
    const fenceLo = q1 - 1.5 * iqr
    const fenceHi = q3 + 1.5 * iqr

    // ── Model 1: Sudden drop / spike (rolling 3-point mean) ───────────────
    const DROP_THRESHOLD  = 0.40  // value fell to < 40% of rolling mean
    const SPIKE_THRESHOLD = 1.80  // value rose to > 180% of rolling mean

    const suddenDropHours:  number[] = []
    const suddenSpikeHours: number[] = []

    for (let i = 3; i < numeric.length; i++) {
      const window = numeric.slice(i - 3, i).map(p => p.value)
      const rollingMean = window.reduce((s, v) => s + v, 0) / window.length
      if (rollingMean === 0) continue
      const ratio = numeric[i].value / rollingMean
      if (ratio < DROP_THRESHOLD)  suddenDropHours.push(numeric[i].hour)
      if (ratio > SPIKE_THRESHOLD) suddenSpikeHours.push(numeric[i].hour)
    }

    if (suddenDropHours.length) {
      const first = numeric.find(p => p.hour === suddenDropHours[0])!
      const prevWindow = numeric.slice(
        numeric.findIndex(p => p.hour === suddenDropHours[0]) - 3,
        numeric.findIndex(p => p.hour === suddenDropHours[0])
      )
      const rollingMean = prevWindow.reduce((s, p) => s + p.value, 0) / prevWindow.length
      const pct = ((first.value - rollingMean) / rollingMean * 100).toFixed(0)
      results.push({
        ptp, hours: suddenDropHours, type: 'sudden_drop', severity: 'critical',
        detail: `Queda brusca detectada na hora ${suddenDropHours[0]}h: valor caiu de ~${fmt(rollingMean)} para ${fmt(first.value)} m³/h (${pct}% vs média móvel de 3h). Possível falha na bomba ou bloqueio.`
      })
    }

    if (suddenSpikeHours.length) {
      results.push({
        ptp, hours: suddenSpikeHours, type: 'sudden_spike', severity: 'warning',
        detail: `Pico anômalo na hora ${suddenSpikeHours[0]}h: valor acima de 180% da média móvel de 3h (${fmt(fenceHi)} limite IQR). Verificar sensor ou pressão anormal.`
      })
    }

    // ── Model 2: IQR outlier ───────────────────────────────────────────────
    const iqrLowHours:  number[] = []
    const iqrHighHours: number[] = []

    numeric.forEach(p => {
      // Only flag if not already captured by sudden-drop
      if (p.value < fenceLo && !suddenDropHours.includes(p.hour))
        iqrLowHours.push(p.hour)
      if (p.value > fenceHi && !suddenSpikeHours.includes(p.hour))
        iqrHighHours.push(p.hour)
    })

    if (iqrLowHours.length) {
      results.push({
        ptp, hours: iqrLowHours, type: 'outlier_low', severity: 'warning',
        detail: `Valores abaixo do limite inferior IQR (${fmt(fenceLo)} m³/h) nas horas: ${iqrLowHours.join(', ')}h. Mediana da série: ${fmt(med)} m³/h.`
      })
    }
    if (iqrHighHours.length) {
      results.push({
        ptp, hours: iqrHighHours, type: 'outlier_high', severity: 'info',
        detail: `Valores acima do limite superior IQR (${fmt(fenceHi)} m³/h) nas horas: ${iqrHighHours.join(', ')}h. Mediana da série: ${fmt(med)} m³/h.`
      })
    }

    // ── Model 3: Sustained low (≥3 consecutive points < 10% of median) ────
    const LOW_RATIO = 0.10
    let runStart: number | null = null
    const sustainedRuns: { start: number; end: number }[] = []

    for (let i = 0; i < numeric.length; i++) {
      const isLow = numeric[i].value < med * LOW_RATIO
      if (isLow && runStart === null) runStart = i
      if (!isLow && runStart !== null) {
        if (i - runStart >= 3) sustainedRuns.push({ start: runStart, end: i - 1 })
        runStart = null
      }
    }
    if (runStart !== null && numeric.length - runStart >= 3)
      sustainedRuns.push({ start: runStart, end: numeric.length - 1 })

    sustainedRuns.forEach(run => {
      const hrs = numeric.slice(run.start, run.end + 1).map(p => p.hour)
      // Skip if already caught by zero/missing
      const newHrs = hrs.filter(h => !zeroHours.includes(h) && !missingHours.includes(h))
      if (!newHrs.length) return
      results.push({
        ptp, hours: newHrs, type: 'sustained_low', severity: 'warning',
        detail: `Operação sustentada abaixo de 10% da mediana (${fmt(med * LOW_RATIO)} m³/h) por ${newHrs.length}h consecutivas (horas: ${newHrs.join(', ')}h). Verificar restrição de fluxo.`
      })
    })
  })

  // Sort: critical first, then warning, then info
  const order: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 }
  return results.sort((a, b) => order[a.severity] - order[b.severity])
}
