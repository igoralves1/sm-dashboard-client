/**
 * Pure statistical engine — Six Sigma / SPC
 * No external dependencies. All math is self-contained.
 */

export interface SensorStats {
  n:           number
  mean:        number
  std:         number
  min:         number
  q1:          number
  median:      number
  q3:          number
  max:         number
  iqr:         number
  whiskerLow:  number
  whiskerHigh: number
  outliers:    number[]
  ucl:         number   // mean + 3σ  (Upper Control Limit)
  lcl:         number   // mean − 3σ  (Lower Control Limit)
  sigma1: { upper: number; lower: number }
  sigma2: { upper: number; lower: number }
  sigma3: { upper: number; lower: number }
}

// ── Percentile (linear interpolation) ────────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const lo  = Math.floor(idx)
  const hi  = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// ── Main stats computation ────────────────────────────────────────────────────
export function computeStats(values: number[]): SensorStats | null {
  const clean = values.filter(v => isFinite(v) && !isNaN(v))
  if (clean.length < 4) return null

  const sorted = [...clean].sort((a, b) => a - b)
  const n      = clean.length

  const mean     = clean.reduce((s, v) => s + v, 0) / n
  const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1)
  const std      = Math.sqrt(variance)

  const q1     = percentile(sorted, 25)
  const median = percentile(sorted, 50)
  const q3     = percentile(sorted, 75)
  const iqr    = q3 - q1

  // Tukey fences (1.5 × IQR)
  const fenceLo    = q1 - 1.5 * iqr
  const fenceHi    = q3 + 1.5 * iqr
  const whiskerLow  = sorted.find(v => v >= fenceLo) ?? sorted[0]
  const whiskerHigh = [...sorted].reverse().find(v => v <= fenceHi) ?? sorted[n - 1]
  const outliers    = sorted.filter(v => v < whiskerLow || v > whiskerHigh)

  return {
    n, mean, std,
    min: sorted[0],
    max: sorted[n - 1],
    q1, median, q3, iqr,
    whiskerLow, whiskerHigh, outliers,
    ucl: mean + 3 * std,
    lcl: mean - 3 * std,
    sigma1: { upper: mean +     std, lower: mean -     std },
    sigma2: { upper: mean + 2 * std, lower: mean - 2 * std },
    sigma3: { upper: mean + 3 * std, lower: mean - 3 * std },
  }
}

// ── z-score ───────────────────────────────────────────────────────────────────
export function zScore(x: number, mean: number, std: number): number {
  return std === 0 ? 0 : (x - mean) / std
}

// ── Abramowitz & Stegun erf approximation (max error 1.5×10⁻⁷) ───────────────
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1
  const a    = Math.abs(x)
  const t    = 1 / (1 + 0.3275911 * a)
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
                - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - poly * Math.exp(-a * a))
}

// ── Two-tailed p-value from z-score ──────────────────────────────────────────
export function pValue(z: number): number {
  const phi = (1 + erf(Math.abs(z) / Math.sqrt(2))) / 2
  return 2 * (1 - phi)
}

// ── Sigma zone (0 = within 1σ … 3 = beyond 3σ) ───────────────────────────────
export type SigmaZone = 0 | 1 | 2 | 3

export function sigmaZone(z: number): SigmaZone {
  const a = Math.abs(z)
  if (a <= 1) return 0
  if (a <= 2) return 1
  if (a <= 3) return 2
  return 3
}

// Zone colors: green → yellow → orange → red
export const ZONE_COLORS: Record<SigmaZone, string> = {
  0: '#73bf69',  // within 1σ  — normal
  1: '#fade2a',  // 1σ – 2σ    — watch
  2: '#f58b06',  // 2σ – 3σ    — alert
  3: '#e84040',  // beyond 3σ  — special cause
}
