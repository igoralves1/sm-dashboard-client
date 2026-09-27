/**
 * Readings derived from a captured waveform.
 *
 * The three analysis panels plot the same capture three ways — as samples over
 * time, as fundamental phasors, and as a spectrum — so each one supports a
 * different question. This module computes what each panel can actually tell
 * you, rather than leaving the chart to be read by eye.
 *
 * ── On the thresholds ────────────────────────────────────────────────────
 *   • Voltage distortion (DTT) — ANEEL PRODIST Módulo 8 sets 10 % for systems
 *     at or below 1 kV.
 *   • Current distortion — IEEE 519 sets limits by short-circuit ratio, which
 *     telemetry alone cannot establish; 10 % / 20 % here are practical
 *     screening levels, not the standard's own figures.
 *   • Phase separation — 120° is the definition of a balanced three-phase
 *     system; a few degrees of drift is normal, beyond ~10° points at an
 *     unbalanced load or a connection fault.
 *   • Crest factor — √2 ≈ 1.414 for a pure sinusoid. Well above it means a
 *     peaky current typical of rectifier loads.
 */

import { fourier, fundamental, thd, type Harmonic } from './fourier'

export interface WaveChannel {
  channel: number
  voltage: number[]
  current: number[]
}

export type NoteSeverity = 'good' | 'watch' | 'warning' | 'critical' | 'unknown'

/** A single derived reading, with its working. */
export interface Reading {
  label: string
  value: string
}

export interface AnalysisNote {
  /** i18n root: `energisa.wave.<key>`. */
  key: string
  severity: NoteSeverity
  /** LaTeX for the headline relationship. */
  tex: string
  /** Plain-text equivalent, shown until MathJax resolves. */
  formula: string
  readings: Reading[]
  /** Interpolated into the assessment sentence. */
  params: Record<string, string | number>
}

const SQRT2 = Math.SQRT2
const round = (v: number, d = 2) => Number(v.toFixed(d))

/** RMS of a sampled waveform — the value a meter would report. */
function rms(samples: number[]): number {
  if (!samples.length) return 0
  const sum = samples.reduce((acc, s) => acc + s * s, 0)
  return Math.sqrt(sum / samples.length)
}

const peak = (samples: number[]) =>
  samples.length ? Math.max(...samples.map(Math.abs)) : 0

/**
 * Temporal analysis: is the wave actually a sine?
 *
 * Crest factor is the discriminator. A pure sinusoid has peak/RMS = √2; a
 * rectifier drawing short current spikes pushes it well above, and a saturated
 * or flat-topped wave pulls it below.
 */
export function analyseTemporal(channels: WaveChannel[]): AnalysisNote | null {
  const usable = channels.filter((c) => c.voltage.length && c.current.length)
  if (!usable.length) return null

  // Report the worst channel — one bad phase is the finding, not the average.
  const perChannel = usable.map((c) => {
    const iRms = rms(c.current)
    return {
      channel: c.channel,
      vPeak: peak(c.voltage),
      vRms: rms(c.voltage),
      iPeak: peak(c.current),
      iRms,
      crest: iRms > 0.01 ? peak(c.current) / iRms : 0,
    }
  })

  const worst = perChannel.reduce((a, b) => (b.crest > a.crest ? b : a))

  let severity: NoteSeverity = 'good'
  if (worst.crest >= 2.5) severity = 'warning'
  else if (worst.crest >= 1.8) severity = 'watch'
  else if (worst.crest > 0 && worst.crest < 1.1) severity = 'watch'

  return {
    key: 'temporal',
    severity: worst.crest > 0 ? severity : 'unknown',
    tex:
      `V_{rms}=\\sqrt{\\frac{1}{N}\\sum_{n=1}^{N} v_n^{2}}` +
      `\\qquad FC=\\frac{I_{pico}}{I_{rms}}=\\frac{${round(worst.iPeak)}}{${round(worst.iRms)}}=${round(worst.crest)}`,
    formula: `Vrms = √(Σv²/N)   ·   FC = Ipico/Irms = ${round(worst.iPeak)}/${round(worst.iRms)} = ${round(worst.crest)}`,
    readings: [
      ...perChannel.flatMap((c) => [
        { label: `V CH${c.channel} pico / rms`, value: `${round(c.vPeak)} / ${round(c.vRms)} V` },
        { label: `I CH${c.channel} pico / rms`, value: `${round(c.iPeak)} / ${round(c.iRms)} A` },
      ]),
      { label: 'Fator de crista (senóide pura)', value: `${round(SQRT2)}` },
    ],
    params: { crest: round(worst.crest), channel: worst.channel, ideal: round(SQRT2) },
  }
}

/**
 * Phasor analysis: are the three phases where they should be?
 *
 * Two independent questions: the separation between voltage phasors (120° in a
 * balanced system) and the angle between voltage and current on each phase,
 * which is the power-factor angle.
 */
export function analysePhasor(channels: WaveChannel[]): AnalysisNote | null {
  const phasors = channels
    .map((c) => {
      const f = fundamental(fourier(c.voltage, c.current))
      return f ? { channel: c.channel, vAngle: f.vAngle, iAngle: f.iAngle, vMag: f.vMagnitude } : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  if (phasors.length < 2) return null

  /** Smallest absolute separation between two angles, 0–180°. */
  const separation = (a: number, b: number) => {
    const diff = Math.abs(((a - b) % 360 + 540) % 360 - 180)
    return 180 - diff
  }

  const separations: { pair: string; deg: number }[] = []
  for (let i = 0; i < phasors.length - 1; i++) {
    for (let j = i + 1; j < phasors.length; j++) {
      separations.push({
        pair: `CH${phasors[i].channel}–CH${phasors[j].channel}`,
        deg: round(separation(phasors[i].vAngle, phasors[j].vAngle)),
      })
    }
  }

  const worstDrift = separations.reduce(
    (acc, s) => Math.max(acc, Math.abs(s.deg - 120)),
    0,
  )

  // Power-factor angle per phase.
  const phi = phasors.map((p) => ({
    channel: p.channel,
    deg: round(((p.vAngle - p.iAngle) % 360 + 540) % 360 - 180),
  }))

  let severity: NoteSeverity = 'good'
  if (worstDrift >= 20) severity = 'critical'
  else if (worstDrift >= 10) severity = 'warning'
  else if (worstDrift >= 5) severity = 'watch'

  return {
    key: 'phasor',
    severity,
    tex:
      `\\varphi_n=\\theta_{V_n}-\\theta_{I_n}` +
      `\\qquad \\Delta_{ij}=\\left|\\theta_{V_i}-\\theta_{V_j}\\right| \\approx 120^{\\circ}`,
    formula: 'φn = θVn − θIn   ·   Δij = |θVi − θVj| ≈ 120°',
    readings: [
      ...separations.map((s) => ({ label: `Separação ${s.pair}`, value: `${s.deg}°` })),
      ...phi.map((p) => ({
        label: `φ CH${p.channel} (V→I)`,
        value: `${p.deg}° · cos φ = ${round(Math.cos((p.deg * Math.PI) / 180), 3)}`,
      })),
    ],
    params: { drift: round(worstDrift), worst: separations.reduce((a, b) => (Math.abs(b.deg - 120) > Math.abs(a.deg - 120) ? b : a)).pair },
  }
}

/**
 * Harmonic analysis: how much of the current is not at 60 Hz?
 *
 * Reports the dominant order alongside the total, because the order points at
 * the cause — the 3rd is characteristic of single-phase non-linear loads and
 * accumulates in the neutral, the 5th and 7th of three-phase rectifiers.
 */
export function analyseHarmonics(channels: WaveChannel[]): AnalysisNote | null {
  const usable = channels.filter((c) => c.voltage.length && c.current.length)
  if (!usable.length) return null

  const rows = usable.map((c) => {
    const harmonics: Harmonic[] = fourier(c.voltage, c.current)
    const vThd = thd(harmonics, 'vMagnitude')
    const iThd = thd(harmonics, 'iMagnitude')

    // Loudest harmonic above the fundamental, as a share of it.
    const base = harmonics.find((h) => h.k === 1)?.iMagnitude ?? 0
    const dominant = harmonics
      .filter((h) => h.k >= 2)
      .reduce<{ k: number; pct: number }>(
        (acc, h) => {
          const pct = base ? (Math.abs(h.iMagnitude) / base) * 100 : 0
          return pct > acc.pct ? { k: h.k, pct } : acc
        },
        { k: 0, pct: 0 },
      )

    return { channel: c.channel, vThd, iThd, dominant }
  })

  const worstV = Math.max(...rows.map((r) => (r.vThd ?? 0) * 100))
  const worstI = Math.max(...rows.map((r) => (r.iThd ?? 0) * 100))
  const worstRow = rows.reduce((a, b) => ((b.iThd ?? 0) > (a.iThd ?? 0) ? b : a))

  let severity: NoteSeverity = 'good'
  if (worstV >= 10) severity = 'critical'
  else if (worstI >= 20) severity = 'warning'
  else if (worstI >= 10 || worstV >= 8) severity = 'watch'

  return {
    key: 'harmonics',
    severity,
    tex:
      `\\mathrm{THD}=\\frac{\\sqrt{\\sum_{h\\geq 2} X_h^{2}}}{X_1}\\times 100` +
      `\\qquad \\mathrm{THD}_I=${round(worstI)}\\,\\%\\quad \\mathrm{DTT}_V=${round(worstV)}\\,\\%`,
    formula: `THD = √(Σ X²ₕ, h≥2) / X₁ × 100 → THD_I = ${round(worstI)} % · DTT_V = ${round(worstV)} %`,
    readings: [
      ...rows.map((r) => ({
        label: `CH${r.channel} · DTT_V / THD_I`,
        value: `${round((r.vThd ?? 0) * 100)} % / ${round((r.iThd ?? 0) * 100)} %`,
      })),
      {
        label: 'Harmônica dominante (corrente)',
        value: worstRow.dominant.k
          ? `${worstRow.dominant.k}ª ordem · ${round(worstRow.dominant.pct)} % da fundamental`
          : '—',
      },
      { label: 'Limite DTT (PRODIST, Vn ≤ 1 kV)', value: '10 %' },
    ],
    params: {
      thdI: round(worstI),
      dttV: round(worstV),
      order: worstRow.dominant.k,
      channel: worstRow.channel,
    },
  }
}
