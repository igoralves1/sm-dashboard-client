// Shared HidroForte site configuration — used by /dashboard-sm and /hidroforte
import type { DataPoint, SiteData } from '@/composables/useTimestreamDashboard'
import type { SensorStats } from '@/composables/useStatistics'

// ── Level chart threshold lines (matching Grafana) ──
export const LEVEL_THRESHOLDS = [
  { value: 25,  color: '#e84040', dash: '6,3' },
  { value: 50,  color: '#f4954e', dash: '6,3' },
  { value: 75,  color: '#f4954e', dash: '6,3' },
  { value: 100, color: '#73bf69', dash: '6,3' },
]

// ── Flow threshold steps (Grafana-style: colour from value upward) — red / yellow / green ──
export const FLOW_THRESHOLDS_MIR = [
  { value: 0,   color: '#e84040' },
  { value: 50,  color: '#fade2a' },
  { value: 100, color: '#73bf69' },
]
export const FLOW_THRESHOLDS_PALTA = [
  { value: 0,  color: '#e84040' },
  { value: 10, color: '#fade2a' },
  { value: 30, color: '#73bf69' },
]

// ── Series colours of the new sites (Silvanópolis uses the chart defaults) ──
export const FLOW_COLORS_MIR  = { Captacao: '#73bf69', PTP_01: '#f2495c' }
export const PROD_COLORS_MIR  = { Captacao: '#73bf69', PTP_01: '#f2cc0c' }
export const COLORS_PALTA     = { PTP_01: '#5794f2', PTP_02: '#f2cc0c', PTP_04: '#73bf69' }

// ── Map markers ──
// Silvanópolis: historical pin; Miranorte / Ponte Alta: positions reported by the devices
// (latitude/longitude in HidroForteSensorsData)
const MARKER_TANK = '#4da6ff'
const MARKER_PUMP = '#fade2a'

export const MARKERS_SIL = [
  { lat: -11.15430944152578, lng: -48.172973779141344, label: 'RAP01 Silvanópolis', color: MARKER_TANK },
]
export const MARKERS_MIR = [
  { lat: -9.54321, lng: -48.59452, label: 'RAP 500m³ Miranorte', color: MARKER_TANK },
  { lat: -9.54893, lng: -48.59648, label: 'RAP 200m³ Miranorte', color: MARKER_TANK },
  { lat: -9.52700, lng: -48.59578, label: 'Captação ETA Miranorte', color: MARKER_PUMP },
  { lat: -9.52687, lng: -48.59598, label: 'PTP_01 Miranorte', color: MARKER_PUMP },
]
export const MARKERS_PALTA = [
  { lat: -10.75449, lng: -47.53521, label: 'RAP 150m³ Ponte Alta', color: MARKER_TANK },
  { lat: -10.74517, lng: -47.53517, label: 'PTP_01 Ponte Alta', color: MARKER_PUMP },
  { lat: -10.75371, lng: -47.53620, label: 'PTP_02 Ponte Alta', color: MARKER_PUMP },
  { lat: -10.75363, lng: -47.53624, label: 'PTP_04 Ponte Alta', color: MARKER_PUMP },
]

// ── SPC panel inputs: one entry per series with its values over time + stats ──
export type SpcSeries = { name: string; values: DataPoint[]; stats: SensorStats | null }

export const flowSpc = (site: Pick<SiteData, 'flow' | 'flowStats'>): SpcSeries[] =>
  site.flow.map(f => ({ name: f.name, values: f.values, stats: site.flowStats[f.name] ?? null }))

export const productionSpc = (
  rows: Record<string, any>[],
  stats: Record<string, SensorStats | null>,
): SpcSeries[] =>
  Object.keys(stats).map(name => ({
    name,
    stats: stats[name],
    values: rows
      .map(r => ({ time: new Date(r.time), value: Number(r[name]) }))
      .filter(d => isFinite(d.value) && !isNaN(d.time.getTime())),
  }))

// ── Latest reading of a series; older than STAT_STALE_MS counts as stale (sensors report ~every minute) ──
export const STAT_STALE_MS = 10 * 60 * 1000

export function latestPoint(values: DataPoint[]): { point: DataPoint | null; fresh: boolean } {
  const point = values.length ? values[values.length - 1] : null
  return { point, fresh: !!point && Date.now() - point.time.getTime() < STAT_STALE_MS }
}

// ── Tank level colour band (same thresholds as TankGauge: < 50 red, 50–80 orange, > 80 green) ──
export function levelColor(v: number): string {
  if (v < 50) return '#e84040'
  if (v < 80) return '#f58b06'
  return '#37872d'
}
