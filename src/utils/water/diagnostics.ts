/**
 * Condition assessment for a water-supply site (reservoirs + wells/pumps).
 *
 * Same shape as the Energisa transformer model (utils/energy/diagnostics.ts):
 * every indicator carries a severity, a 0–100 score, the arithmetic with the
 * real numbers substituted, the full band scale and its sources. The site's
 * health index is the weighted mean of the scores; the headline severity is the
 * WORST indicator, so one critical reading cannot hide behind healthy ones.
 *
 * ── On the thresholds ────────────────────────────────────────────────────
 *   • Reserve — reservoirs are classically sized to hold 1/3 of the max-day
 *     consumption, i.e. 8 h of supply (ABNT PNB 594/77; NBR 12217/94). The
 *     lower part of a tank is the emergency reserve (EPA/AWWA 2002), guarded
 *     by low-level and overflow alarms (Ten States 2022 §7.4.3).
 *       level < 25 %  → < 2 h of design autonomy       → critical
 *       25–50 %       → 2–4 h                          → warning
 *       50–80 %       → equalisation band              → watch
 *       80–95 %       → full operating reserve         → good
 *       ≥ 95 %        → overflow risk                  → watch
 *   • Turnover (water age) — Ohio EPA requires ≥ 20 % daily turnover (25 %
 *     recommended), Georgia EPD ≥ 30 % (EPA/AWWA 2002, Table 2); Ten States
 *     §7.1.6 turnover time ≤ 5 days (≡ 20 %/day). Water age matters because
 *     Portaria GM/MS 888/2021 Art. 32 requires ≥ 0.2 mg/L free chlorine in
 *     reservoirs and network.
 *   • Flow stability — HI 9.6.3 preferred operating region is 70–120 % of the
 *     best-efficiency flow. With Shewhart ±3σ (NIST), keeping 3·CV ≤ 30 % keeps
 *     99.7 % of readings above 70 % of the duty flow → CV ≤ 10 %.
 *   • Continuity — availability = uptime / observed time (ISO 14224); the
 *     regulator tracks supply intermittency (ANA NR 9/2024; SNIS IN071–IN074).
 *   • Anomalies — Tukey fences Q1 − 1.5·IQR / Q3 + 1.5·IQR (NIST 7.1.6), the
 *     same model already shown under the production charts.
 *   • Telemetry — Ten States §7.4.3 expects level telemetry with alarms; a
 *     sensor silent for longer than a few report intervals is blind operation.
 *
 * These are published starting points, not a specification of this network:
 * everything is overridable through `WaterThresholds`.
 */

import type { Band, Severity, Indicator } from '@/utils/energy/diagnostics'
import type { DataPoint, FlowSeries } from '@/composables/useTimestreamDashboard'
import { detectAnomalies } from '@/composables/useAnomalyDetection'

export type WaterKind = 'reserve' | 'trend' | 'turnover' | 'continuity' | 'stability' | 'anomalies' | 'telemetry'

export interface WaterIndicator extends Indicator {
  /** Indicator family — i18n root `hidroforte.diag.<kind>_*`, weight, references. */
  kind: WaterKind
  /** What it refers to (tank / site), shown next to the name. */
  subject: string
}

export interface WaterThresholds {
  /** Reservoir level, % of useful depth. */
  reserve: { critical: number; warning: number; good: number; overflow: number }
  /** Design autonomy of a full reservoir, hours (1/3 of max-day consumption = 8 h). */
  designAutonomyH: number
  /** Hours until the level reaches `reserve.critical` at the current draw-down rate. */
  trend: { critical: number; warning: number; watch: number }
  /** Daily level fluctuation, % of depth (≈ % of volume renewed per day). */
  turnover: { critical: number; warning: number; good: number }
  /** Share of meter-hours with production, %. */
  continuity: { good: number; watch: number; warning: number }
  /** Coefficient of variation of running flow, %. */
  stability: { watch: number; warning: number; critical: number }
  /** Anomalous hours (Tukey fences) in the last 24 h. */
  anomalies: { watch: number; warning: number; critical: number }
  /** Minutes since the oldest "latest reading" among the site's sensors. */
  telemetry: { watch: number; warning: number; critical: number }
}

export const WATER_THRESHOLDS: WaterThresholds = {
  reserve: { critical: 25, warning: 50, good: 80, overflow: 95 },
  designAutonomyH: 8,
  trend: { critical: 2, warning: 6, watch: 12 },
  turnover: { critical: 10, warning: 20, good: 30 },
  continuity: { good: 90, watch: 75, warning: 50 },
  stability: { watch: 5, warning: 10, critical: 20 },
  anomalies: { watch: 1, warning: 3, critical: 6 },
  telemetry: { watch: 10, warning: 30, critical: 60 },
}

/** Health-index weights per indicator family; split equally between tanks. */
export const WATER_WEIGHTS: Record<WaterKind, number> = {
  reserve: 0.3,
  trend: 0.15,
  turnover: 0.1,
  continuity: 0.2,
  stability: 0.1,
  anomalies: 0.05,
  telemetry: 0.1,
}

export interface WaterSiteInput {
  tanks: { name: string; series: DataPoint[] }[]
  flows: FlowSeries[]
  /** Hourly production rows ({ hour, time, <meter>: m³ }). */
  production24h: Record<string, any>[]
  productionKeys: string[]
  thresholds?: WaterThresholds
  /** Evaluation time (tests); defaults to now. */
  now?: number
}

export interface WaterDiagnostics {
  indicators: WaterIndicator[]
  healthIndex: number | null
  healthSeverity: Severity
  /** Weight actually applied to each indicator (after splitting per tank). */
  weights: Record<string, number>
}

// ── helpers ───────────────────────────────────────────────────────────────

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d
const fmt = (v: number, d = 1) => round(v, d).toLocaleString('pt-BR', { maximumFractionDigits: d })

function scoreBetween(value: number, best: number, worst: number): number {
  if (best === worst) return 100
  return Math.max(0, Math.min(100, ((value - worst) / (best - worst)) * 100))
}

/** Higher is worse. */
function gradeUp(v: number, watch: number, warning: number, critical: number): Severity {
  if (v >= critical) return 'critical'
  if (v >= warning) return 'warning'
  if (v >= watch) return 'watch'
  return 'good'
}

/** Lower is worse (cut-offs are the lower edge of each better band). */
function gradeDown(v: number, good: number, watch: number, warning: number): Severity {
  if (v >= good) return 'good'
  if (v >= watch) return 'watch'
  if (v >= warning) return 'warning'
  return 'critical'
}

const bandsUp = (watch: number, warning: number, critical: number): Band[] => [
  { severity: 'good', from: 0, to: watch },
  { severity: 'watch', from: watch, to: warning },
  { severity: 'warning', from: warning, to: critical },
  { severity: 'critical', from: critical, to: null },
]

const bandsDown = (good: number, watch: number, warning: number): Band[] => [
  { severity: 'critical', from: null, to: warning },
  { severity: 'warning', from: warning, to: watch },
  { severity: 'watch', from: watch, to: good },
  { severity: 'good', from: good, to: null },
]

function unknown(kind: WaterKind, subject: string, unit: string): WaterIndicator {
  return {
    kind, subject, key: `${kind}:${subject}`, severity: 'unknown', value: null, unit, score: null,
    formula: '', tex: '', inputs: [], bands: [], params: { subject },
  }
}

const hhmm = (t: Date) => t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// ── indicators ────────────────────────────────────────────────────────────

/** Level now, read as hours of design autonomy. */
function reserveIndicator(name: string, series: DataPoint[], th: WaterThresholds): WaterIndicator {
  if (!series.length) return unknown('reserve', name, '%')
  const { critical, warning, good, overflow } = th.reserve
  const L = series[series.length - 1].value
  const A = (L / 100) * th.designAutonomyH

  let severity: Severity
  if (L >= overflow) severity = 'watch'
  else severity = gradeDown(L, good, warning, critical)

  // 100 inside the operating band; linear to 0 at empty; mild penalty above overflow.
  const score = L > overflow
    ? Math.max(70, 100 - (L - overflow) * 6)
    : scoreBetween(Math.min(L, good), good, 0)

  return {
    kind: 'reserve', subject: name, key: `reserve:${name}`, severity, value: L, unit: '%', score,
    formula: `A = L/100 × T = ${fmt(L)}/100 × ${th.designAutonomyH} h = ${fmt(A)} h`,
    tex: `A = \\frac{L}{100}\\times T_{proj} = \\frac{${fmt(L)}}{100}\\times ${th.designAutonomyH}\\,h = ${fmt(A)}\\,h`,
    inputs: [
      { label: 'L — nível atual', value: `${fmt(L)} %` },
      { label: 'T_proj — autonomia de projeto (1/3 do dia de maior consumo)', value: `${th.designAutonomyH} h` },
      { label: 'A — autonomia teórica restante', value: `${fmt(A)} h` },
      { label: 'Leitura', value: hhmm(series[series.length - 1].time) },
    ],
    bands: [
      { severity: 'critical', from: null, to: critical },
      { severity: 'warning', from: critical, to: warning },
      { severity: 'watch', from: warning, to: good },
      { severity: 'good', from: good, to: overflow },
      { severity: 'watch', from: overflow, to: null },
    ],
    params: { subject: name, level: fmt(L), autonomy: fmt(A), design: th.designAutonomyH, critical, overflow },
  }
}

/** Least-squares slope of the last `hours` of the series, %/h. */
function slopePerHour(series: DataPoint[], hours: number, now: number): { slope: number; n: number } {
  const from = now - hours * 3600e3
  const pts = series.filter(p => p.time.getTime() >= from)
  if (pts.length < 6) return { slope: NaN, n: pts.length }
  const xs = pts.map(p => (p.time.getTime() - from) / 3600e3)
  const ys = pts.map(p => p.value)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0, den = 0
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2 })
  return { slope: den ? num / den : NaN, n: pts.length }
}

/** Time until the level hits the critical reserve at the current draw-down rate. */
function trendIndicator(name: string, series: DataPoint[], th: WaterThresholds, now: number): WaterIndicator {
  const WINDOW_H = 3
  const { slope, n } = slopePerHour(series, WINDOW_H, now)
  if (!series.length || !isFinite(slope)) return unknown('trend', name, 'h')

  const L = series[series.length - 1].value
  const Lc = th.reserve.critical
  const CAP = 24
  // Not falling (or falling < 0.1 %/h): no depletion horizon — treated as ≥ 24 h.
  const t = slope < -0.1 ? Math.max(0, (L - Lc) / -slope) : CAP
  const shown = Math.min(t, CAP)

  return {
    kind: 'trend', subject: name, key: `trend:${name}`,
    severity: gradeDown(shown, th.trend.watch, th.trend.warning, th.trend.critical),
    value: shown, unit: 'h', score: scoreBetween(shown, CAP, 0),
    formula: slope >= -0.1
      ? `dL/dt = ${fmt(slope, 2)} %/h ≥ −0,1 %/h → sem esvaziamento (t ≥ ${CAP} h)`
      : L <= Lc
        ? `L = ${fmt(L)} % ≤ Lc = ${Lc} % e dL/dt = ${fmt(slope, 2)} %/h → já dentro da reserva crítica (t = 0 h)`
        : `t = (L − Lc) / |dL/dt| = (${fmt(L)} − ${Lc}) / ${fmt(-slope, 2)} = ${fmt(t)} h`,
    tex: slope >= -0.1
      ? `\\frac{dL}{dt} = ${fmt(slope, 2)}\\,\\%/h \\;\\Rightarrow\\; t \\geq ${CAP}\\,h`
      : L <= Lc
        ? `L = ${fmt(L)} \\leq L_c = ${Lc},\\; \\frac{dL}{dt} = ${fmt(slope, 2)}\\,\\%/h \\;\\Rightarrow\\; t = 0\\,h`
        : `t = \\frac{L - L_c}{|dL/dt|} = \\frac{${fmt(L)} - ${Lc}}{${fmt(-slope, 2)}} = ${fmt(t)}\\,h`,
    inputs: [
      { label: 'L — nível atual', value: `${fmt(L)} %` },
      { label: 'Lc — reserva crítica', value: `${Lc} %` },
      { label: `dL/dt — regressão linear (mínimos quadrados), últimas ${WINDOW_H} h`, value: `${fmt(slope, 2)} %/h` },
      { label: 'Pontos usados', value: String(n) },
    ],
    bands: bandsDown(th.trend.watch, th.trend.warning, th.trend.critical),
    params: { subject: name, hours: fmt(shown), slope: fmt(slope, 2), critical: Lc },
  }
}

/** Daily level fluctuation ≈ share of the volume renewed per day. */
function turnoverIndicator(name: string, series: DataPoint[], th: WaterThresholds, now: number): WaterIndicator {
  const day = series.filter(p => p.time.getTime() >= now - 24 * 3600e3)
  const spanH = day.length ? (day[day.length - 1].time.getTime() - day[0].time.getTime()) / 3600e3 : 0
  if (spanH < 12) return unknown('turnover', name, '%')

  const values = day.map(p => p.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const dL = max - min
  const days = dL > 0 ? 100 / dL : Infinity

  return {
    kind: 'turnover', subject: name, key: `turnover:${name}`,
    severity: gradeDown(dL, th.turnover.good, th.turnover.warning, th.turnover.critical),
    value: dL, unit: '%', score: scoreBetween(Math.min(dL, th.turnover.good), th.turnover.good, 0),
    formula: `ΔL = Lmax − Lmin = ${fmt(max)} − ${fmt(min)} = ${fmt(dL)} %/dia → Tren = 100/ΔL = ${isFinite(days) ? fmt(days) : '∞'} dias`,
    tex: `\\Delta L = L_{max} - L_{min} = ${fmt(max)} - ${fmt(min)} = ${fmt(dL)}\\,\\%/d, \\quad T_{ren} = \\frac{100}{\\Delta L} = ${isFinite(days) ? fmt(days) : '\\infty'}\\,d`,
    inputs: [
      { label: 'Lmax (24 h)', value: `${fmt(max)} %` },
      { label: 'Lmin (24 h)', value: `${fmt(min)} %` },
      { label: 'Janela coberta', value: `${fmt(spanH)} h` },
      { label: 'Tren — tempo de renovação estimado', value: isFinite(days) ? `${fmt(days)} dias` : '∞' },
    ],
    bands: bandsDown(th.turnover.good, th.turnover.warning, th.turnover.critical),
    params: { subject: name, pct: fmt(dL), days: isFinite(days) ? fmt(days) : '∞' },
  }
}

/** Share of meter-hours with production (pump running). */
function continuityIndicator(rows: Record<string, any>[], keys: string[], th: WaterThresholds, site: string): WaterIndicator {
  if (!rows.length || !keys.length) return unknown('continuity', site, '%')
  const OFF_RATIO = 0.05   // same "pump off" cut-off as the production anomaly model
  let up = 0, total = 0
  const perMeter: { label: string; value: string }[] = []
  keys.forEach(k => {
    const vals = rows.map(r => Number(r[k])).filter(v => isFinite(v))
    if (!vals.length) return
    const tau = Math.max(...vals) * OFF_RATIO
    const running = tau > 0 ? vals.filter(v => v > tau).length : 0
    up += running; total += vals.length
    perMeter.push({ label: k, value: `${running}/${vals.length} h` })
  })
  if (!total) return unknown('continuity', site, '%')
  const pct = (up / total) * 100

  return {
    kind: 'continuity', subject: site, key: `continuity:${site}`,
    severity: gradeDown(pct, th.continuity.good, th.continuity.watch, th.continuity.warning),
    value: pct, unit: '%', score: scoreBetween(pct, 100, th.continuity.warning - 25),
    formula: `D = Σ horas em operação / Σ horas observadas × 100 = ${up} / ${total} × 100 = ${fmt(pct)} %`,
    tex: `D = \\frac{\\sum t_{op}}{\\sum t_{obs}}\\times 100 = \\frac{${up}}{${total}}\\times 100 = ${fmt(pct)}\\,\\%`,
    inputs: [
      { label: 'Critério "em operação"', value: 'produção > 5 % do máximo horário do medidor' },
      ...perMeter,
    ],
    bands: bandsDown(th.continuity.good, th.continuity.watch, th.continuity.warning),
    params: { subject: site, pct: fmt(pct), up, total },
  }
}

/** Worst coefficient of variation of running flow among the site's meters. */
function stabilityIndicator(flows: FlowSeries[], th: WaterThresholds, site: string): WaterIndicator {
  const rows = flows.map(f => {
    const vals = f.values.map(p => p.value)
    const max = vals.length ? Math.max(...vals) : 0
    const run = vals.filter(v => v > max * 0.05)
    if (run.length < 10) return null
    const mu = run.reduce((a, b) => a + b, 0) / run.length
    const sigma = Math.sqrt(run.reduce((a, b) => a + (b - mu) ** 2, 0) / (run.length - 1))
    return { name: f.name, mu, sigma, cv: mu > 0 ? (sigma / mu) * 100 : NaN }
  }).filter((r): r is { name: string; mu: number; sigma: number; cv: number } => !!r && isFinite(r.cv))
  if (!rows.length) return unknown('stability', site, '%')

  const worst = rows.reduce((a, b) => (b.cv > a.cv ? b : a))
  return {
    kind: 'stability', subject: site, key: `stability:${site}`,
    severity: gradeUp(worst.cv, th.stability.watch, th.stability.warning, th.stability.critical),
    value: worst.cv, unit: '%', score: scoreBetween(worst.cv, 0, th.stability.critical),
    formula: `CV = σ/μ × 100 = ${fmt(worst.sigma, 2)}/${fmt(worst.mu, 2)} × 100 = ${fmt(worst.cv)} % (${worst.name}); limite POR: 3·CV ≤ 30 % → CV ≤ 10 %`,
    tex: `CV = \\frac{\\sigma}{\\mu}\\times 100 = \\frac{${fmt(worst.sigma, 2)}}{${fmt(worst.mu, 2)}}\\times 100 = ${fmt(worst.cv)}\\,\\%, \\quad 3\\,CV \\leq 30\\,\\% \\Rightarrow CV \\leq 10\\,\\%`,
    inputs: rows.map(r => ({ label: `${r.name} — μ ± σ (m³/h)`, value: `${fmt(r.mu, 2)} ± ${fmt(r.sigma, 2)} → CV ${fmt(r.cv)} %` })),
    bands: bandsUp(th.stability.watch, th.stability.warning, th.stability.critical),
    params: { subject: site, pct: fmt(worst.cv), meter: worst.name },
  }
}

/** Anomalous production hours (Tukey fences on running hours). */
function anomaliesIndicator(rows: Record<string, any>[], keys: string[], th: WaterThresholds, site: string): WaterIndicator {
  if (rows.length < 4 || !keys.length) return unknown('anomalies', site, 'h')
  const found = detectAnomalies(rows, 'hour', keys).filter(a => a.type !== 'pump_off')
  const n = found.reduce((s, a) => s + a.hours.length, 0)
  return {
    kind: 'anomalies', subject: site, key: `anomalies:${site}`,
    severity: gradeUp(n, th.anomalies.watch, th.anomalies.warning, th.anomalies.critical),
    value: n, unit: 'h', score: scoreBetween(n, 0, th.anomalies.critical + 2),
    formula: `x fora de [Q1 − 1,5·IQR ; Q3 + 1,5·IQR] e |x − x̃|/x̃ > 30 % → ${n} hora(s) anômala(s)`,
    tex: `x < Q_1 - 1{,}5\\,IQR \\;\\lor\\; x > Q_3 + 1{,}5\\,IQR, \\quad \\frac{|x-\\tilde{x}|}{\\tilde{x}} > 0{,}30 \\;\\Rightarrow\\; n = ${n}`,
    inputs: found.length
      ? found.map(a => ({ label: `${a.ptp} — ${a.type === 'outlier_low' ? 'queda' : 'pico'}`, value: `${a.hours.join(', ')} h` }))
      : [{ label: 'Horas avaliadas', value: `${rows.length} × ${keys.length} medidores` }],
    bands: bandsUp(th.anomalies.watch, th.anomalies.warning, th.anomalies.critical),
    params: { subject: site, n },
  }
}

/** Age of the stalest "latest reading" among the site's sensors. */
function telemetryIndicator(
  tanks: WaterSiteInput['tanks'], flows: FlowSeries[], th: WaterThresholds, site: string, now: number,
): WaterIndicator {
  const sensors = [
    ...tanks.map(t => ({ name: t.name, s: t.series })),
    ...flows.map(f => ({ name: f.name, s: f.values })),
  ]
  const ages = sensors.map(({ name, s }) => ({
    name, age: s.length ? (now - s[s.length - 1].time.getTime()) / 60e3 : Infinity,
  }))
  if (!ages.length) return unknown('telemetry', site, 'min')
  const worst = ages.reduce((a, b) => (b.age > a.age ? b : a))
  const shown = isFinite(worst.age) ? worst.age : 24 * 60

  return {
    kind: 'telemetry', subject: site, key: `telemetry:${site}`,
    severity: gradeUp(shown, th.telemetry.watch, th.telemetry.warning, th.telemetry.critical),
    value: shown, unit: 'min', score: scoreBetween(shown, 0, th.telemetry.critical * 2),
    formula: `idade = agora − última leitura (pior sensor: ${worst.name}) = ${fmt(shown, 0)} min`,
    tex: `\\Delta t = t_{agora} - t_{\\text{última}} = ${fmt(shown, 0)}\\,\\text{min}`,
    inputs: ages.map(a => ({ label: a.name, value: isFinite(a.age) ? `${fmt(a.age, 0)} min` : 'sem leitura em 24 h' })),
    bands: bandsUp(th.telemetry.watch, th.telemetry.warning, th.telemetry.critical),
    params: { subject: site, min: fmt(shown, 0), sensor: worst.name },
  }
}

// ── site assessment ───────────────────────────────────────────────────────

export function analyseWaterSite(input: WaterSiteInput, site: string): WaterDiagnostics {
  const th = input.thresholds ?? WATER_THRESHOLDS
  const now = input.now ?? Date.now()

  const indicators: WaterIndicator[] = [
    ...input.tanks.map(t => reserveIndicator(t.name, t.series, th)),
    ...input.tanks.map(t => trendIndicator(t.name, t.series, th, now)),
    ...input.tanks.map(t => turnoverIndicator(t.name, t.series, th, now)),
    continuityIndicator(input.production24h, input.productionKeys, th, site),
    stabilityIndicator(input.flows, th, site),
    anomaliesIndicator(input.production24h, input.productionKeys, th, site),
    telemetryIndicator(input.tanks, input.flows, th, site, now),
  ]

  // Per-tank families share their weight so a two-tank site is not over-weighted.
  const perKind = indicators.reduce<Record<string, number>>((m, i) => {
    if (i.score !== null) m[i.kind] = (m[i.kind] ?? 0) + 1
    return m
  }, {})
  const weights: Record<string, number> = {}
  indicators.forEach(i => {
    if (i.score !== null) weights[i.key] = WATER_WEIGHTS[i.kind] / perKind[i.kind]
  })

  // Re-normalise over what could actually be measured.
  const scored = indicators.filter(i => i.score !== null)
  const totalWeight = scored.reduce((s, i) => s + weights[i.key], 0)
  const healthIndex = totalWeight
    ? scored.reduce((s, i) => s + (i.score as number) * weights[i.key], 0) / totalWeight
    : null

  // Headline = worst indicator (see utils/energy/diagnostics.ts for the rationale).
  const measured = indicators.filter(i => i.severity !== 'unknown')
  let healthSeverity: Severity = 'unknown'
  if (measured.length) {
    if (measured.some(i => i.severity === 'critical')) healthSeverity = 'critical'
    else if (measured.every(i => i.severity === 'good')) healthSeverity = 'good'
    else healthSeverity = 'warning'
  }

  return { indicators, healthIndex, healthSeverity, weights }
}
