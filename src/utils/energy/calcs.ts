/**
 * Per-channel statistics over an interval of readings.
 *
 * Ported from MonorepoFront pages/Devices/calcs.ts. Two behaviours from the
 * original are preserved on purpose:
 *
 *  - Energy is integrated from instantaneous power using the real gap between
 *    consecutive samples, not a fixed cadence, because the device reports
 *    irregularly. The first sample contributes nothing (no preceding gap).
 *  - min/max are taken over raw values including negatives. Reverse power flow
 *    is meaningful for these meters — the card in the screenshots shows
 *    -6531.71 W — so clamping at zero would hide real behaviour.
 *
 * The original built min/max with Math.min(...spread), which overflows the
 * stack on long intervals; this reduces instead.
 */

import type { ChannelStats, ConsumptionPoint, ConsumptionResumes } from '@/services/energisa/types'

const CHANNELS = [1, 2, 3] as const

/** Milliseconds in an hour, for Ws → Wh, then /1000 again for kWh. */
const MS_PER_HOUR = 3600 * 1000

interface Spread {
  min: number
  med: number
  max: number
}

function spread(values: number[]): Spread {
  if (!values.length) return { min: 0, med: 0, max: 0 }

  let min = values[0]
  let max = values[0]
  let sum = 0

  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }

  return { min, med: sum / values.length, max }
}

/**
 * Statistics plus integrated energy for all three channels.
 * Safe on an empty array — every figure comes back as zero.
 */
export function calculateResumes(data: ConsumptionPoint[]): ConsumptionResumes {
  const metrics: ChannelStats[] = []
  const energy: Record<number, number> = { 1: 0, 2: 0, 3: 0 }

  for (const ch of CHANNELS) {
    const voltage: number[] = []
    const current: number[] = []
    const power: number[] = []
    let accumulated = 0

    for (let i = 0; i < data.length; i++) {
      const point = data[i] as unknown as Record<string, number>
      const p = point[`p_c${ch}`] ?? 0

      voltage.push(point[`v_c${ch}`] ?? 0)
      current.push(point[`i_c${ch}`] ?? 0)
      power.push(p)

      if (i > 0) {
        const gapMs = data[i].timestamp - data[i - 1].timestamp
        // Guard against clock jumps and duplicate timestamps.
        if (gapMs > 0) accumulated += (p * gapMs) / MS_PER_HOUR / 1000
      }
    }

    energy[ch] = accumulated
    metrics.push({
      ch,
      vef: spread(voltage),
      ief: spread(current),
      pef: spread(power),
    })
  }

  return {
    metrics,
    energyCh1: energy[1],
    energyCh2: energy[2],
    energyCh3: energy[3],
  }
}

/**
 * Load factor: mean power as a percentage of peak power.
 * Null when there is no peak to divide by.
 */
export function loadFactor(stats: ChannelStats): number | null {
  if (!stats.pef.max) return null
  return (stats.pef.med / stats.pef.max) * 100
}

/** Apparent power S = V·I, volt-amps. */
export const apparentPower = (v: number, i: number): number => v * i

/** Reactive power Q = √(S² − P²); zero when P exceeds S from rounding. */
export function reactivePower(apparent: number, active: number): number {
  const q = apparent ** 2 - active ** 2
  return q > 0 ? Math.sqrt(q) : 0
}

/** Power factor P/S, clamped to [-1, 1]. Null when there is no apparent power. */
export function powerFactor(active: number, apparent: number): number | null {
  if (!apparent) return null
  return Math.max(-1, Math.min(1, active / apparent))
}
