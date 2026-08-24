/**
 * Per-channel electrical quantities.
 *
 * Direct port of calcChData in MonorepoFront pages/Devices/SynchronizedCharts.tsx.
 * The meter reports voltage, current, their phase angles and active power;
 * everything else on the page is derived from those five numbers.
 *
 *   θ = θv − θi            phase difference, degrees
 *   S = |v| · |i|          apparent power, VA
 *   Q = S · sin θ          reactive power, var
 *   FP = |cos θ|           power factor
 *   FC = √(P² + Q²) / rating · 100
 *
 * Note S here is the product of magnitudes, so Q is derived from S rather than
 * from √(S² − P²). The two disagree when the meter's P is not exactly S·cos θ,
 * and the production charts use this form — matching it matters more than
 * being theoretically tidier.
 */

const DEG = Math.PI / 180

export interface ChannelElectrical {
  /** Phase difference θv − θi, degrees. */
  theta: number
  /** Apparent power, VA. */
  s: number
  /** Reactive power, var. */
  q: number
  /** Power factor, 0..1. */
  fp: number
}

export function calcChannel(input: {
  p: number
  v: number
  i: number
  va: number
  ia: number
}): ChannelElectrical {
  const theta = input.va - input.ia
  const s = Math.abs(input.v) * Math.abs(input.i)

  return {
    theta,
    s,
    q: s * Math.sin(theta * DEG),
    fp: Math.abs(Math.cos(theta * DEG)),
  }
}

/**
 * Load factor for one phase: apparent power against a third of the
 * transformer's nominal rating, since each phase carries a third.
 */
export function channelLoadFactor(p: number, q: number, nominalPower: number): number {
  if (!nominalPower) return 0
  return (Math.hypot(p, q) / (nominalPower / 3)) * 100
}

export interface ThreePhase {
  p: number
  q: number
  s: number
  fp: number
  fc: number
}

/**
 * Three-phase totals.
 *
 * P and Q sum across phases; S is rebuilt from those sums rather than summing
 * the per-phase S values, because apparent power does not add arithmetically
 * when the phases differ in angle.
 */
export function threePhase(
  channels: { p: number; q: number }[],
  nominalPower: number,
): ThreePhase {
  const p = channels.reduce((sum, c) => sum + c.p, 0)
  const q = channels.reduce((sum, c) => sum + c.q, 0)
  const s = Math.hypot(p, q)

  return {
    p,
    q,
    s,
    fp: s ? p / s : 0,
    fc: nominalPower ? (s / nominalPower) * 100 : 0,
  }
}

/** Series colours, from ChartColors in lineChart.ts. */
export const CHART_COLORS = {
  v: ['#0000FF', '#006699', '#7300E6'],
  i: ['#FF0000', '#FFCC00', '#99CC00'],
  p: ['#7ba7e8', '#3b3a3f', '#83ee72'],
  kwh: ['#D4E6B5', '#E2D686', '#877B66'],
  trif: '#000000',
} as const
