/**
 * Condition assessment for a pole-mounted distribution transformer.
 *
 * Turns raw telemetry into the handful of judgements an operator actually
 * acts on: is it overloaded, is the load balanced across phases, is the
 * delivered voltage compliant, is the power factor going to attract a
 * reactive-energy charge, is it running hot, and how distorted is the current.
 *
 * ── On the thresholds ────────────────────────────────────────────────────
 * The defaults below follow Brazilian distribution rules, since these units
 * sit on Energisa's LV network:
 *
 *   • Voltage bands — ANEEL PRODIST Módulo 8, "tensão em regime permanente",
 *     expressed as a fraction of nominal so they hold for 127 V or 220 V.
 *   • Power factor ≥ 0.92 — ANEEL Resolução Normativa nº 1.000/2021, which
 *     revoked REN 414/2010 (the figure itself came in via REN 569/2013).
 *     Below the floor the utility bills excess reactive energy.
 *   • Current unbalance — IEEE 1159 monitoring practice: a few percent is
 *     normal on a distribution feeder, beyond ~10 % it drives neutral current
 *     and extra heating.
 *   • Hot-spot temperature — IEEE C57.91 loading guide for a 65 °C-rise
 *     mineral-oil unit; sustained operation above ~110 °C accelerates
 *     insulation ageing sharply.
 *
 * These are defaults, not gospel: utilities set their own limits and a given
 * unit may be specified differently. Everything is overridable through
 * `DiagnosticThresholds` so the panel can be retuned without touching logic.
 */

import type { ChannelReading, DeviceRatings } from '@/services/energisa/types'
import { calcChannel, threePhase } from './electrical'
import { fourier, thd } from './fourier'

export type Severity = 'good' | 'watch' | 'warning' | 'critical' | 'unknown'

/** One band on an indicator's scale, e.g. "10–20 % → attention". */
export interface Band {
  severity: Exclude<Severity, 'unknown'>
  /** Null means unbounded on that side. */
  from: number | null
  to: number | null
}

export interface Indicator {
  /** Stable key — also the i18n lookup root, `energisa.diag.<key>`. */
  key: string
  severity: Severity
  /** Primary number, already scaled to `unit`. Null when not measurable. */
  value: number | null
  unit: string
  /** Contributes to the health index unless null. 0 = worst, 100 = best. */
  score: number | null
  /**
   * The arithmetic, with the real numbers substituted — shown verbatim so an
   * engineer can check the result rather than trust it.
   */
  formula: string
  /** Same expression as LaTeX, for MathJax. Empty when not applicable. */
  tex: string
  /** Named inputs that fed the formula, for the "values used" list. */
  inputs: { label: string; value: string }[]
  /** Full scale, so the reader sees where this reading sits among the limits. */
  bands: Band[]
  /**
   * Values the explanation text interpolates, e.g. { pct: 18.02 }. Keeps the
   * copy in the locale files rather than hard-coded here.
   */
  params: Record<string, string | number>
}

/** Ascending-threshold indicators share this band shape. */
function ascendingBands(watch: number, warning: number, critical: number): Band[] {
  return [
    { severity: 'good', from: 0, to: watch },
    { severity: 'watch', from: watch, to: warning },
    { severity: 'warning', from: warning, to: critical },
    { severity: 'critical', from: critical, to: null },
  ]
}

const EMPTY = { formula: '', tex: '', inputs: [], bands: [] as Band[] }

export interface DiagnosticThresholds {
  /** Loading as a percentage of nameplate rating. */
  loading: { watch: number; warning: number; critical: number }
  /** Current unbalance, percent. */
  unbalance: { watch: number; warning: number; critical: number }
  /** Voltage as a fraction of nominal (PRODIST bands). */
  voltage: { adequateLow: number; adequateHigh: number; precariousLow: number; precariousHigh: number }
  /** Nominal phase voltage in volts. */
  nominalVoltage: number
  /** Power factor floor before reactive billing. */
  powerFactorFloor: number
  /** Hot-spot temperature, °C. */
  temperature: { watch: number; warning: number; critical: number }
  /** Total harmonic distortion of current, percent. */
  thdCurrent: { watch: number; warning: number }
}

export const DEFAULT_THRESHOLDS: DiagnosticThresholds = {
  loading: { watch: 50, warning: 80, critical: 100 },
  unbalance: { watch: 10, warning: 20, critical: 40 },
  voltage: { adequateLow: 0.92, adequateHigh: 1.05, precariousLow: 0.87, precariousHigh: 1.06 },
  nominalVoltage: 220,
  powerFactorFloor: 0.92,
  temperature: { watch: 85, warning: 105, critical: 110 },
  thdCurrent: { watch: 10, warning: 20 },
}

/** Pick a severity from ascending cut-offs. */
function grade(value: number, watch: number, warning: number, critical: number): Severity {
  if (value >= critical) return 'critical'
  if (value >= warning) return 'warning'
  if (value >= watch) return 'watch'
  return 'good'
}

/**
 * Linear score that reaches 0 at `worst` and 100 at `best`, in either
 * direction. Used so every indicator contributes on the same 0–100 scale.
 */
function scoreBetween(value: number, best: number, worst: number): number {
  if (best === worst) return 100
  const t = (value - worst) / (best - worst)
  return Math.max(0, Math.min(100, t * 100))
}

export interface DiagnosticsInput {
  channels: ChannelReading[]
  ratings: DeviceRatings | null
  /** Latest board temperature, °C. */
  temperature: number | null
  thresholds?: DiagnosticThresholds
}

/** Loading against the transformer's nominal power. */
function loadingIndicator(
  channels: ChannelReading[],
  nominal: number | undefined,
  th: DiagnosticThresholds,
): Indicator {
  if (!nominal || !channels.length) {
    return { key: 'loading', severity: 'unknown', value: null, unit: '%', score: null, params: {}, ...EMPTY }
  }

  const derived = channels.map((c) => {
    const { q } = calcChannel({ p: c.p, v: c.v, i: c.i, va: c.v_a, ia: c.i_a })
    return { p: c.p, q }
  })

  const tp = threePhase(derived, nominal)
  const pct = tp.fc

  return {
    key: 'loading',
    severity: grade(pct, th.loading.watch, th.loading.warning, th.loading.critical),
    value: pct,
    unit: '%',
    // Headroom is what matters: 0 % loaded and 100 % loaded are the extremes.
    score: scoreBetween(pct, 0, th.loading.critical),
    formula: `S / Pnom × 100 = ${fmt(tp.s)} / ${fmt(nominal)} × 100 = ${round(pct)} %`,
    tex:
      `\\text{Carregamento} = \\frac{S}{P_{nom}}\\times 100 ` +
      `= \\frac{${tex(tp.s)}}{${tex(nominal)}}\\times 100 = ${round(pct)}\\,\\%`,
    inputs: [
      { label: 'P', value: `${fmt(tp.p)} W` },
      { label: 'Q', value: `${fmt(tp.q)} var` },
      { label: 'S = √(P² + Q²)', value: `${fmt(tp.s)} VA` },
      { label: 'Pnom', value: `${fmt(nominal)} VA` },
    ],
    bands: ascendingBands(th.loading.watch, th.loading.warning, th.loading.critical),
    params: { pct: round(pct), nominal: round(nominal / 1000, 1) },
  }
}

/**
 * Current unbalance across phases.
 *
 * Uses the NEMA definition — greatest deviation from the mean, over the mean —
 * rather than max-minus-min, because a single lightly-loaded phase should
 * register as strongly as a single overloaded one.
 */
function unbalanceIndicator(channels: ChannelReading[], th: DiagnosticThresholds): Indicator {
  const currents = channels.map((c) => Math.abs(c.i))
  const mean = currents.reduce((a, b) => a + b, 0) / (currents.length || 1)

  if (currents.length < 2 || mean <= 0.05) {
    // Below ~50 mA the percentages are noise, not imbalance.
    return { key: 'unbalance', severity: 'unknown', value: null, unit: '%', score: null, params: {}, ...EMPTY }
  }

  const maxDeviation = Math.max(...currents.map((i) => Math.abs(i - mean)))
  const pct = (maxDeviation / mean) * 100

  const highest = channels.reduce((a, b) => (Math.abs(a.i) > Math.abs(b.i) ? a : b))
  const lowest = channels.reduce((a, b) => (Math.abs(a.i) < Math.abs(b.i) ? a : b))

  return {
    key: 'unbalance',
    severity: grade(pct, th.unbalance.watch, th.unbalance.warning, th.unbalance.critical),
    value: pct,
    unit: '%',
    score: scoreBetween(pct, 0, th.unbalance.critical),
    formula:
      `máx|Ii − Ī| / Ī × 100 = ${fmt(maxDeviation)} / ${fmt(mean)} × 100 = ${round(pct)} %`,
    tex:
      `\\text{Desequil\u00edbrio} = \\frac{\\max_i\\left|I_i-\\bar{I}\\right|}{\\bar{I}}\\times 100 ` +
      `= \\frac{${tex(maxDeviation)}}{${tex(mean)}}\\times 100 = ${round(pct)}\\,\\%`,
    inputs: [
      ...channels.map((c) => ({ label: `I CH${c.channel}`, value: `${fmt(Math.abs(c.i))} A` })),
      { label: 'Ī (média)', value: `${fmt(mean)} A` },
      { label: 'maior desvio', value: `${fmt(maxDeviation)} A` },
    ],
    bands: ascendingBands(th.unbalance.watch, th.unbalance.warning, th.unbalance.critical),
    params: {
      pct: round(pct),
      high: highest.channel,
      highValue: round(Math.abs(highest.i)),
      low: lowest.channel,
      lowValue: round(Math.abs(lowest.i)),
    },
  }
}

/** Delivered voltage against the PRODIST adequate / precarious / critical bands. */
function voltageIndicator(channels: ChannelReading[], th: DiagnosticThresholds): Indicator {
  const voltages = channels.map((c) => c.v).filter((v) => v > 1)
  if (!voltages.length) {
    return { key: 'voltage', severity: 'unknown', value: null, unit: 'V', score: null, params: {}, ...EMPTY }
  }

  const mean = voltages.reduce((a, b) => a + b, 0) / voltages.length
  const ratio = mean / th.nominalVoltage

  let severity: Severity = 'good'
  if (ratio < th.voltage.precariousLow || ratio > th.voltage.precariousHigh) severity = 'critical'
  else if (ratio < th.voltage.adequateLow || ratio > th.voltage.adequateHigh) severity = 'warning'

  // Distance from nominal, as a fraction of the adequate half-band.
  const deviation = Math.abs(ratio - 1)
  const halfBand = (th.voltage.adequateHigh - th.voltage.adequateLow) / 2

  const nom = th.nominalVoltage

  return {
    key: 'voltage',
    severity,
    value: mean,
    unit: 'V',
    score: scoreBetween(deviation, 0, halfBand * 2),
    formula:
      `V̄ / Vnom = ${fmt(mean)} / ${nom} = ${round(ratio, 4)} → ${round((ratio - 1) * 100)} % do nominal`,
    tex:
      `\\frac{\\bar{V}}{V_{nom}} = \\frac{${round(mean)}}{${nom}} = ${round(ratio, 4)} ` +
      `\\;\\Rightarrow\\; ${round((ratio - 1) * 100)}\\,\\%\\ \\text{do nominal}`,
    inputs: [
      ...channels
        .filter((c) => c.v > 1)
        .map((c) => ({ label: `V CH${c.channel}`, value: `${fmt(c.v)} V` })),
      { label: 'V̄ (média)', value: `${fmt(mean)} V` },
      { label: 'Vnom', value: `${nom} V` },
    ],
    // Voltage is two-sided, so the bands are absolute volts around nominal.
    bands: [
      { severity: 'critical', from: null, to: round(th.voltage.precariousLow * nom) },
      { severity: 'warning', from: round(th.voltage.precariousLow * nom), to: round(th.voltage.adequateLow * nom) },
      { severity: 'good', from: round(th.voltage.adequateLow * nom), to: round(th.voltage.adequateHigh * nom) },
      { severity: 'warning', from: round(th.voltage.adequateHigh * nom), to: round(th.voltage.precariousHigh * nom) },
      { severity: 'critical', from: round(th.voltage.precariousHigh * nom), to: null },
    ],
    params: {
      volts: round(mean),
      nominal: th.nominalVoltage,
      deviation: round((ratio - 1) * 100),
      low: round(th.voltage.adequateLow * th.nominalVoltage),
      high: round(th.voltage.adequateHigh * th.nominalVoltage),
    },
  }
}

/** Power factor against the regulatory floor. */
function powerFactorIndicator(channels: ChannelReading[], th: DiagnosticThresholds): Indicator {
  if (!channels.length) {
    return { key: 'powerFactor', severity: 'unknown', value: null, unit: '', score: null, params: {}, ...EMPTY }
  }

  const derived = channels.map((c) => {
    const { q } = calcChannel({ p: c.p, v: c.v, i: c.i, va: c.v_a, ia: c.i_a })
    return { p: c.p, q }
  })

  const total = threePhase(derived, 1)
  if (!total.s) {
    return { key: 'powerFactor', severity: 'unknown', value: null, unit: '', score: null, params: {}, ...EMPTY }
  }

  const pf = Math.abs(total.p / total.s)

  let severity: Severity = 'good'
  if (pf < th.powerFactorFloor - 0.1) severity = 'warning'
  else if (pf < th.powerFactorFloor) severity = 'watch'

  return {
    key: 'powerFactor',
    severity,
    value: pf,
    unit: '',
    score: scoreBetween(pf, 1, th.powerFactorFloor - 0.25),
    formula: `|P| / S = ${fmt(Math.abs(total.p))} / ${fmt(total.s)} = ${pf.toFixed(3)}`,
    tex:
      `\\cos\\varphi = \\frac{\\left|P\\right|}{S} ` +
      `= \\frac{${tex(Math.abs(total.p))}}{${tex(total.s)}} = ${pf.toFixed(3)}`,
    inputs: [
      { label: 'P (ativa)', value: `${fmt(total.p)} W` },
      { label: 'Q (reativa)', value: `${fmt(total.q)} var` },
      { label: 'S = √(P² + Q²)', value: `${fmt(total.s)} VA` },
      { label: 'piso regulatório', value: String(th.powerFactorFloor) },
    ],
    // Higher is better here, so the scale runs the other way.
    bands: [
      { severity: 'warning', from: 0, to: round(th.powerFactorFloor - 0.1, 2) },
      { severity: 'watch', from: round(th.powerFactorFloor - 0.1, 2), to: th.powerFactorFloor },
      { severity: 'good', from: th.powerFactorFloor, to: 1 },
    ],
    params: { pf: pf.toFixed(3), floor: th.powerFactorFloor, reactive: round(total.q / 1000, 1) },
  }
}

/** Winding temperature against the ageing thresholds. */
function thermalIndicator(temperature: number | null, th: DiagnosticThresholds): Indicator {
  if (temperature === null || !Number.isFinite(temperature)) {
    return { key: 'thermal', severity: 'unknown', value: null, unit: '°C', score: null, params: {}, ...EMPTY }
  }

  return {
    key: 'thermal',
    severity: grade(temperature, th.temperature.watch, th.temperature.warning, th.temperature.critical),
    value: temperature,
    unit: '°C',
    score: scoreBetween(temperature, 30, th.temperature.critical),
    formula: `leitura direta do sensor = ${round(temperature)} °C`,
    tex: `\\theta = ${round(temperature)}\\,^{\\circ}\\mathrm{C} \\quad (\\theta_{lim} = ${th.temperature.critical}\\,^{\\circ}\\mathrm{C})`,
    inputs: [
      { label: 'temperatura medida', value: `${round(temperature)} °C` },
      { label: 'limite crítico', value: `${th.temperature.critical} °C` },
    ],
    bands: ascendingBands(th.temperature.watch, th.temperature.warning, th.temperature.critical),
    params: { temp: round(temperature), limit: th.temperature.critical },
  }
}

/** Current distortion, from the live waveform when the firmware reports one. */
/**
 * Minimum RMS current before a channel's distortion means anything.
 *
 * THD divides by the fundamental. On a channel carrying 0.05 A the
 * fundamental is sensor noise, and dividing by it produces figures like
 * 778 % that describe the noise floor rather than the installation. Below
 * this threshold the channel is skipped instead of reported.
 */
const THD_CURRENT_FLOOR_A = 1

function harmonicsIndicator(channels: ChannelReading[], th: DiagnosticThresholds): Indicator {
  const withWave = channels.filter(
    (c) => c.i_w?.length && c.v_w?.length && Math.abs(c.i) >= THD_CURRENT_FLOOR_A,
  )
  if (!withWave.length) {
    return { key: 'harmonics', severity: 'unknown', value: null, unit: '%', score: null, params: {}, ...EMPTY }
  }

  const distortions = withWave
    .map((c) => thd(fourier(c.v_w, c.i_w), 'iMagnitude'))
    .filter((d): d is number => d !== null)

  if (!distortions.length) {
    return { key: 'harmonics', severity: 'unknown', value: null, unit: '%', score: null, params: {}, ...EMPTY }
  }

  const worst = Math.max(...distortions) * 100
  const worstChannel = withWave[distortions.indexOf(Math.max(...distortions))]

  return {
    key: 'harmonics',
    severity: grade(worst, th.thdCurrent.watch, th.thdCurrent.warning, Infinity),
    value: worst,
    unit: '%',
    score: scoreBetween(worst, 0, th.thdCurrent.warning * 2),
    formula: `√(Σ I²ₕ para h ≥ 2) / I₁ × 100 = ${round(worst)} % (pior canal: CH${worstChannel?.channel ?? '—'})`,
    tex:
      `\\mathrm{THD}_I = \\frac{\\sqrt{\\sum_{h\\geq 2} I_h^{2}}}{I_1}\\times 100 = ${round(worst)}\\,\\%`,
    inputs: [
      ...withWave.map((c, i) => ({
        label: `THD CH${c.channel}`,
        value: `${round((distortions[i] ?? 0) * 100)} %`,
      })),
      { label: 'canais avaliados', value: `${withWave.length} de ${channels.length}` },
      { label: 'corrente mínima', value: `${THD_CURRENT_FLOOR_A} A` },
    ],
    bands: [
      { severity: 'good', from: 0, to: th.thdCurrent.watch },
      { severity: 'watch', from: th.thdCurrent.watch, to: th.thdCurrent.warning },
      { severity: 'warning', from: th.thdCurrent.warning, to: null },
    ],
    params: { thd: round(worst) },
  }
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits))
}

/** LaTeX-safe compact number: 22453.8 → "22.45\\,k". */
function tex(value: number): string {
  if (!Number.isFinite(value)) return '-'
  const abs = Math.abs(value)
  if (abs >= 1000) return `${(value / 1000).toFixed(2)}\\,\\mathrm{k}`
  return value.toFixed(2)
}

/** Compact number for the formula strings: 22453.8 → "22,45 k". */
function fmt(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1000) return `${(value / 1000).toFixed(2)} k`
  return value.toFixed(2)
}

export interface Diagnostics {
  indicators: Indicator[]
  /** 0–100 composite. Null when nothing measurable has arrived. */
  healthIndex: number | null
  healthSeverity: Severity
  /** Worst severity across all indicators — drives the headline. */
  overall: Severity
}

/**
 * Weights for the composite health index.
 *
 * Loading and temperature dominate because they drive insulation ageing
 * directly; voltage and unbalance matter for service quality and neutral
 * heating; power factor is commercial rather than physical; harmonics is
 * weighted lightly because it is only measurable on some firmware.
 */
const WEIGHTS: Record<string, number> = {
  loading: 0.3,
  thermal: 0.3,
  unbalance: 0.15,
  voltage: 0.15,
  powerFactor: 0.05,
  harmonics: 0.05,
}

const SEVERITY_RANK: Record<Severity, number> = {
  unknown: -1,
  good: 0,
  watch: 1,
  warning: 2,
  critical: 3,
}

export function analyse(input: DiagnosticsInput): Diagnostics {
  const th = input.thresholds ?? DEFAULT_THRESHOLDS
  const nominal = input.ratings?.nomP ?? input.ratings?.maxP

  const indicators = [
    loadingIndicator(input.channels, nominal, th),
    thermalIndicator(input.temperature, th),
    unbalanceIndicator(input.channels, th),
    voltageIndicator(input.channels, th),
    powerFactorIndicator(input.channels, th),
    harmonicsIndicator(input.channels, th),
  ]

  // Re-normalise over whatever could actually be measured, so a device with
  // no temperature probe is not penalised for the missing reading.
  const scored = indicators.filter((i) => i.score !== null)
  const totalWeight = scored.reduce((sum, i) => sum + (WEIGHTS[i.key] ?? 0), 0)

  const healthIndex = totalWeight
    ? scored.reduce((sum, i) => sum + (i.score as number) * (WEIGHTS[i.key] ?? 0), 0) / totalWeight
    : null

  const overall = indicators.reduce<Severity>(
    (worst, i) => (SEVERITY_RANK[i.severity] > SEVERITY_RANK[worst] ? i.severity : worst),
    'good',
  )

  /**
   * The headline severity is the *worst* indicator, not a blend.
   *
   * A weighted average lets one critical reading hide behind five healthy
   * ones — a transformer with a disconnected phase would show "68, attention"
   * while the thing that needs a truck is buried in a card. Any critical
   * indicator makes the asset critical; all-normal makes it normal; anything
   * in between is attention.
   */
  const measured = indicators.filter((i) => i.severity !== 'unknown')

  let healthSeverity: Severity = 'unknown'
  if (measured.length) {
    if (measured.some((i) => i.severity === 'critical')) healthSeverity = 'critical'
    else if (measured.every((i) => i.severity === 'good')) healthSeverity = 'good'
    else healthSeverity = 'warning'
  }

  return { indicators, healthIndex, healthSeverity, overall }
}
