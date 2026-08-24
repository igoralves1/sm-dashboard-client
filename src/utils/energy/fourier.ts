/**
 * Harmonic analysis of captured waveforms.
 *
 * Direct port of the DFT in MonorepoFront pages/Devices/polarChart.ts. It is a
 * naive O(n·k) transform rather than an FFT, which is fine here: the captured
 * waveform is short (tens of samples) and we only want the first 15 harmonics.
 *
 * Bin 0 is DC; bin 1 is the fundamental (60 Hz), and its magnitude and angle
 * are what the phasor diagram plots.
 */

/** How many harmonics to compute. Never exceeds len/2 — above that is aliased. */
const HARMONIC_COUNT = 15

export interface Harmonic {
  /** Harmonic index: 0 = DC, 1 = fundamental. */
  k: number
  /** Voltage magnitude, volts. */
  vMagnitude: number
  /** Voltage phase angle, degrees. */
  vAngle: number
  /** Current magnitude, amps. */
  iMagnitude: number
  /** Current phase angle, degrees. */
  iAngle: number
}

/**
 * Discrete Fourier transform of a paired voltage/current waveform.
 * Both arrays must be the same length; the shorter one bounds the transform.
 */
export function fourier(voltage: number[], current: number[]): Harmonic[] {
  const len = Math.min(voltage.length, current.length)
  if (len === 0) return []

  const bins = Math.min(HARMONIC_COUNT, Math.floor(len / 2) || 1)
  const output: Harmonic[] = []

  for (let k = 0; k < bins; k++) {
    let realV = 0
    let imagV = 0
    let realI = 0
    let imagI = 0

    for (let n = 0; n < len; n++) {
      const theta = (-2 * Math.PI * k * n) / len
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      realV += voltage[n] * cos
      imagV += voltage[n] * sin
      realI += current[n] * cos
      imagI += current[n] * sin
    }

    // Scale by len/2 so the fundamental comes out as an amplitude, not a sum.
    const scale = len / 2

    output.push({
      k,
      vMagnitude: Math.hypot(realV, imagV) / scale,
      vAngle: (Math.atan2(imagV, realV) * 180) / Math.PI,
      iMagnitude: Math.hypot(realI, imagI) / scale,
      iAngle: (Math.atan2(imagI, realI) * 180) / Math.PI,
    })
  }

  return output
}

/** The fundamental (60 Hz) component — what the phasor diagram draws. */
export function fundamental(harmonics: Harmonic[]): Harmonic | null {
  return harmonics.find((h) => h.k === 1) ?? null
}

/**
 * Total harmonic distortion, as a fraction of the fundamental.
 * Returns null when there is no fundamental to compare against.
 */
export function thd(harmonics: Harmonic[], field: 'vMagnitude' | 'iMagnitude'): number | null {
  const base = harmonics.find((h) => h.k === 1)?.[field]
  if (!base) return null

  const sumSquares = harmonics
    .filter((h) => h.k >= 2)
    .reduce((acc, h) => acc + h[field] ** 2, 0)

  return Math.sqrt(sumSquares) / base
}
