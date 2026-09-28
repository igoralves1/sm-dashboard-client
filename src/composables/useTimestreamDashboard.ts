import { ref } from 'vue'
import { TimestreamQueryClient, QueryCommand } from '@aws-sdk/client-timestream-query'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { useAuthStore } from '@/stores/auth'
import { appendSnapshot } from './useDashboardLogger'
import { checkRateLimit } from './useRateLimiter'
import { computeStats, type SensorStats } from './useStatistics'
import { saveBoxPlotRecord } from './useBoxPlotStorage'

// ── AWS Config (values injected via environment variables) ───────────────────
const REGION           = import.meta.env.VITE_AWS_REGION              as string
const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID        as string
const USER_POOL_ID     = import.meta.env.VITE_USER_POOL_ID            as string
const DB               = import.meta.env.VITE_TIMESTREAM_DB           as string
const TABLE_RT         = import.meta.env.VITE_TIMESTREAM_TABLE_RT     as string
const TABLE_HOURLY     = import.meta.env.VITE_TIMESTREAM_TABLE_HOURLY as string
const TABLE_DAILY      = import.meta.env.VITE_TIMESTREAM_TABLE_DAILY  as string
const TABLE_SENSORS    = import.meta.env.VITE_TIMESTREAM_TABLE_SENSORS as string

// ── Sensor IDs (end_id values in Timestream) ─────────────────────────────────
const SENSOR_RAP_SIL = import.meta.env.VITE_SENSOR_RAP_SIL as string
const SENSOR_PTP_01  = import.meta.env.VITE_SENSOR_PTP_01  as string
const SENSOR_PTP_02  = import.meta.env.VITE_SENSOR_PTP_02  as string
const SENSOR_PTP_03  = import.meta.env.VITE_SENSOR_PTP_03  as string
const SENSOR_PTP_04  = import.meta.env.VITE_SENSOR_PTP_04  as string
const SENSOR_RAP_MIR = import.meta.env.VITE_SENSOR_RAP_MIR as string   // RAP 500 m³ Miranorte
const SENSOR_RAP200_MIR   = import.meta.env.VITE_SENSOR_RAP200_MIR   as string
const SENSOR_RAP150_PALTA = import.meta.env.VITE_SENSOR_RAP150_PALTA as string
const SENSOR_CAPT_MIR     = import.meta.env.VITE_SENSOR_CAPT_MIR     as string   // Captação Miranorte (TUF-2000 meter)
const SENSOR_PTP_01_MIR   = import.meta.env.VITE_SENSOR_PTP_01_MIR   as string   // PTP_01 Miranorte
const SENSOR_PTP_01_PALTA = import.meta.env.VITE_SENSOR_PTP_01_PALTA as string
const SENSOR_PTP_02_PALTA = import.meta.env.VITE_SENSOR_PTP_02_PALTA as string
const SENSOR_PTP_04_PALTA = import.meta.env.VITE_SENSOR_PTP_04_PALTA as string
const SENSOR_PTP_07  = import.meta.env.VITE_SENSOR_PTP_07  as string

let client: TimestreamQueryClient | null = null
let lastIdToken = ''

function getClient() {
  const auth = useAuthStore()
  const idToken = auth.idToken ?? ''

  // Rebuild client if token changed (new login / refresh)
  if (!client || idToken !== lastIdToken) {
    lastIdToken = idToken
    const logins = idToken
      ? { [`cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`]: idToken }
      : undefined

    client = new TimestreamQueryClient({
      region: REGION,
      credentials: fromCognitoIdentityPool({
        // @ts-ignore: duplicate CognitoIdentityClient types across AWS SDK nested-clients
        client: new CognitoIdentityClient({ region: REGION }),
        identityPoolId: IDENTITY_POOL_ID,
        logins,
      }),
    })
  }
  return client
}

// ── Query helper ─────────────────────────────────────────────────────────────
async function query(sql: string): Promise<Record<string, string>[]> {
  const rl = checkRateLimit()
  if (!rl.allowed) {
    const mins = Math.ceil(rl.resetInSecs / 60)
    throw new Error(`RATE_LIMIT_EXCEEDED:${mins}`)
  }
  const cmd = new QueryCommand({ QueryString: sql })
  const res = await getClient().send(cmd)
  const cols = res.ColumnInfo?.map(c => c.Name ?? '') ?? []
  return (res.Rows ?? []).map(row => {
    const obj: Record<string, string> = {}
    row.Data?.forEach((d, i) => { obj[cols[i]] = d.ScalarValue ?? '' })
    return obj
  })
}

// ── Calibration formula helpers ───────────────────────────────────────────────
// Silvanópolis level moved from TABLE_RT (water_level) to TABLE_SENSORS (wtr_level) at this cutoff
const SENSORS_DATA_CUTOFF = '2026-08-10T00:00:00Z'

// ── Tank level sensors ────────────────────────────────────────────────────────
// Mirrors the Grafana dashboard variables w_level_* (all read wtr_level from TABLE_SENSORS).
// Grafana rounds them to 10% to pick the tank image; here we keep full precision.
export type TankKey = 'RAP_SIL' | 'RAP500_MIR' | 'RAP200_MIR' | 'RAP150_PALTA'

interface TankConfig {
  endId: string
  expr: string          // wtr_level → % on TABLE_SENSORS
  legacyExpr?: string   // water_level → % on TABLE_RT, before SENSORS_DATA_CUTOFF
  smoothRows: number    // moving average = current row + N preceding
}

const LEVEL_TANKS = (): Record<TankKey, TankConfig> => ({
  RAP_SIL: {
    endId: SENSOR_RAP_SIL,
    expr:       '(cast(wtr_level as double) - 796)*100*(5/4.4)/(3760-796)',
    legacyExpr: '(cast(water_level as double) - 796)*100*(5/4.8)/(3760-796)',
    smoothRows: 10,
  },
  RAP500_MIR: {
    endId: SENSOR_RAP_MIR,
    expr:       '(cast(wtr_level as double) - 796)*100*(5/4.8)/(3760-796)',
    legacyExpr: '(cast(water_level as double) - 796)*100*(5/4.8)/(3760-796)',
    smoothRows: 5,
  },
  RAP200_MIR: {
    endId: SENSOR_RAP200_MIR,
    expr:       '(cast(wtr_level as double) - 170)*100*(4.75/5)/(4095-0)',
    legacyExpr: '(cast(water_level as double) - 170)*100*(4.75/5)/(4095-0)',
    smoothRows: 10,
  },
  RAP150_PALTA: {
    endId: SENSOR_RAP150_PALTA,
    expr: '(cast(wtr_level as double) - 0)*(3.75/5)*100/(2048-0)',
    smoothRows: 2,
  },
})

// ── Site meters (Miranorte / Ponte Alta): flow from TABLE_SENSORS, production from hourly/daily ──
interface SiteMeter {
  name: string
  endId: string
  flow: string         // → m³/h
  flowCol: string      // column that must be non-null for a flow reading
  production: string   // L_acc → m³
}

const MIRANORTE_METERS = (): SiteMeter[] => [
  // Captação: TUF-2000 meter, already m³/h and m³
  { name: 'Captacao', endId: SENSOR_CAPT_MIR,   flow: 'cast(tuf2000_flow as double)',      flowCol: 'tuf2000_flow', production: 'L_acc' },
  { name: 'PTP_01',   endId: SENSOR_PTP_01_MIR, flow: 'cast(flux as double)*60/(12*1000)', flowCol: 'flux',         production: 'L_acc / (12.0*1000)' },
]

const ptpPonteAlta = (name: string, endId: string): SiteMeter =>
  ({ name, endId, flow: 'cast(flux as double)*60/(30*1000)', flowCol: 'flux', production: 'L_acc / (30.0*1000)' })

const PONTE_ALTA_METERS = (): SiteMeter[] => [
  ptpPonteAlta('PTP_01', SENSOR_PTP_01_PALTA),
  ptpPonteAlta('PTP_02', SENSOR_PTP_02_PALTA),
  ptpPonteAlta('PTP_04', SENSOR_PTP_04_PALTA),
]

// Production: hourly/daily tables store accumulated flux (L_acc); divide per PTP to get m³.
// Same divisors as FLOW_FORMULAS (PTP_02 = 27 since its 2026-07-29 recalibration).
const PRODUCTION_DIVISORS = () => ({
  [SENSOR_PTP_01]: '12.0*1000',
  [SENSOR_PTP_02]: '27.0*1000',
  [SENSOR_PTP_03]: '2*12.0*1000',
  [SENSOR_PTP_04]: '2*12.0*1000',
  [SENSOR_PTP_07]: '12.0*1000',
})

const PTP_NAMES = () => ({
  [SENSOR_PTP_01]: 'PTP_01',
  [SENSOR_PTP_02]: 'PTP_02',
  [SENSOR_PTP_03]: 'PTP_03',
  [SENSOR_PTP_04]: 'PTP_04',
  [SENSOR_PTP_07]: 'PTP_07',
})

// PTP_02 flow meter recalibrated at this cutoff (÷108 → ÷27)
const PTP_02_FLOW_CUTOFF = '2026-07-29T12:15:00Z'

const FLOW_FORMULAS = () => ({
  [SENSOR_PTP_01]: 'cast(flux as double)*60/(12*1000)',
  [SENSOR_PTP_02]: `CASE
    WHEN time < from_iso8601_timestamp('${PTP_02_FLOW_CUTOFF}')
      THEN cast(flux as double)*60/(108*1000)
    ELSE cast(flux as double)*60/(27*1000)
  END`,
  [SENSOR_PTP_03]: 'cast(flux as double)*60/(2*12*1000)',
  [SENSOR_PTP_04]: 'cast(flux as double)*60/(2*12*1000)',
  [SENSOR_PTP_07]: 'cast(flux as double)*60/(12*1000)',
})

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DataPoint { time: Date; value: number }
export interface FlowSeries { name: string; values: DataPoint[] }

export interface LocationData {
  level: number
  levelSeries: DataPoint[]
  flowSeries: FlowSeries[]
  production24h: Record<string, any>[]
  productionDaily: Record<string, any>[]
  levelStats:          SensorStats | null
  flowStats:           Record<string, SensorStats | null>   // keyed by PTP name
  production24hStats:  Record<string, SensorStats | null>   // keyed by PTP name
  productionDailyStats: Record<string, SensorStats | null>  // keyed by PTP name
}

export interface TankData {
  level: number
  levelSeries: DataPoint[]
  levelStats: SensorStats | null
}

/** Extract per-PTP stats from merged production rows */
function productionStats(rows: Record<string, any>[]): Record<string, SensorStats | null> {
  if (!rows.length) return {}
  const ptpKeys = Object.keys(rows[0]).filter(k => k.startsWith('PTP'))
  const result: Record<string, SensorStats | null> = {}
  ptpKeys.forEach(k => {
    const vals = rows.map(r => parseFloat(r[k] ?? '0')).filter(v => isFinite(v) && v > 0)
    result[k] = computeStats(vals)
  })
  return result
}

// ── Fetch functions ───────────────────────────────────────────────────────────

// Tank level: old table (if any) + new table, drop out-of-range readings, moving average
async function fetchTankLevel(key: TankKey): Promise<DataPoint[]> {
  const { endId, expr, legacyExpr, smoothRows } = LEVEL_TANKS()[key]
  const legacy = legacyExpr ? `
      SELECT ${legacyExpr} AS water_level, time
      FROM "${DB}"."${TABLE_RT}"
      WHERE time >= ago(24h)
        AND time < from_iso8601_timestamp('${SENSORS_DATA_CUTOFF}')
        AND end_id = '${endId}'

      UNION ALL
` : ''
  const rows = await query(`
    WITH raw AS (${legacy}
      SELECT ${expr} AS water_level, time
      FROM "${DB}"."${TABLE_SENSORS}"
      WHERE time >= ago(24h)
        AND time >= from_iso8601_timestamp('${SENSORS_DATA_CUTOFF}')
        AND end_id = '${endId}'
        AND wtr_level IS NOT NULL
    ),
    clean AS (
      SELECT
        CASE WHEN water_level BETWEEN -5 AND 150 THEN water_level ELSE NULL END AS water_level,
        time
      FROM raw
    )
    SELECT
      AVG(water_level) OVER (
        ORDER BY time
        ROWS BETWEEN ${smoothRows} PRECEDING AND CURRENT ROW
      ) AS water_level,
      time
    FROM clean
    ORDER BY time ASC
  `)
  return rows
    .map(r => ({ time: new Date(r.time), value: parseFloat(r.water_level) }))
    .filter(d => isFinite(d.value))
}

async function fetchFlow(endId: string, ptpName: string): Promise<FlowSeries> {
  const formula = FLOW_FORMULAS()[endId] ?? 'cast(flux as double)*60/(12*1000)'
  // flux moved from TABLE_RT to TABLE_SENSORS at SENSORS_DATA_CUTOFF
  const rows = await query(`
    SELECT ${formula} AS value, time
    FROM "${DB}"."${TABLE_RT}"
    WHERE time >= ago(24h)
      AND time < from_iso8601_timestamp('${SENSORS_DATA_CUTOFF}')
      AND end_id = '${endId}'

    UNION ALL

    SELECT ${formula} AS value, time
    FROM "${DB}"."${TABLE_SENSORS}"
    WHERE time >= ago(24h)
      AND time >= from_iso8601_timestamp('${SENSORS_DATA_CUTOFF}')
      AND end_id = '${endId}'
      AND flux IS NOT NULL

    ORDER BY time ASC
  `)
  return {
    name: ptpName,
    values: rows
      .map(r => ({ time: new Date(r.time), value: parseFloat(r.value) }))
      .filter(d => isFinite(d.value))
  }
}

/** Merge per-PTP rows into one row per timestamp (a missing hour/day stays 0 for that PTP) */
function mergeProductionRows(
  results: { name: string; rows: Record<string, string>[] }[],
  label: (row: Record<string, string>) => Record<string, any>,
): Record<string, any>[] {
  const byTime = new Map<string, Record<string, any>>()
  results.forEach(r => r.rows.forEach(row => {
    if (!byTime.has(row.time)) byTime.set(row.time, label(row))
  }))
  return [...byTime.keys()].sort().map(t => {
    const merged = byTime.get(t)!
    results.forEach(r => {
      const row = r.rows.find(x => x.time === t)
      merged[r.name] = parseFloat(row?.[r.name] ?? '0')
    })
    return merged
  })
}

// Flow per meter (last 24h) from TABLE_SENSORS
async function fetchSiteFlow(meters: SiteMeter[]): Promise<FlowSeries[]> {
  return Promise.all(meters.map(async ({ name, endId, flow, flowCol }) => {
    const rows = await query(`
      SELECT ${flow} AS value, time
      FROM "${DB}"."${TABLE_SENSORS}"
      WHERE time >= ago(24h)
        AND end_id = '${endId}'
        AND ${flowCol} IS NOT NULL
      ORDER BY time ASC
    `)
    return {
      name,
      values: rows
        .map(r => ({ time: new Date(r.time), value: parseFloat(r.value) }))
        .filter(d => isFinite(d.value)),
    }
  }))
}

async function fetchProduction24h(): Promise<Record<string, any>[]> {
  const results = await Promise.all(Object.entries(PTP_NAMES()).map(async ([endId, name]) => {
    const rows = await query(`
      SELECT hour, time, L_acc / (${PRODUCTION_DIVISORS()[endId]}) AS ${name}
      FROM "${DB}"."${TABLE_HOURLY}"
      WHERE time >= ago(1d)
      AND end_id = '${endId}'
      ORDER BY time DESC LIMIT 24
    `)
    return { name, rows }
  }))
  return mergeProductionRows(results, row => ({ hour: row.hour }))
}

// Production per meter (hourly: last 24 rows, daily: last 7 rows)
async function fetchSiteProduction(period: 'hourly' | 'daily', meters: SiteMeter[]): Promise<Record<string, any>[]> {
  const { table, label, window, limit } = period === 'hourly'
    ? { table: TABLE_HOURLY, label: 'hour', window: '1d', limit: 24 }
    : { table: TABLE_DAILY,  label: 'day',  window: '7d', limit: 7 }
  const results = await Promise.all(meters.map(async ({ name, endId, production }) => {
    const rows = await query(`
      SELECT ${label}, time, ${production} AS ${name}
      FROM "${DB}"."${table}"
      WHERE time >= ago(${window})
      AND end_id = '${endId}'
      ORDER BY time DESC LIMIT ${limit}
    `)
    return { name, rows }
  }))
  return mergeProductionRows(results, row => ({ [label]: row[label] }))
}

async function fetchProductionDaily(): Promise<Record<string, any>[]> {
  const results = await Promise.all(Object.entries(PTP_NAMES()).map(async ([endId, name]) => {
    const rows = await query(`
      SELECT day, time, L_acc / (${PRODUCTION_DIVISORS()[endId]}) AS ${name}
      FROM "${DB}"."${TABLE_DAILY}"
      WHERE time >= ago(6d)
      AND end_id = '${endId}'
      ORDER BY time DESC LIMIT 5
    `)
    return { name, rows }
  }))
  return mergeProductionRows(results, row => ({ day: row.day }))
}

// ── Main composable ───────────────────────────────────────────────────────────
export function useTimestreamDashboard() {
  const silvanopolis = ref<LocationData>({
    level: 0, levelSeries: [], flowSeries: [], production24h: [], productionDaily: [],
    levelStats: null, flowStats: {}, production24hStats: {}, productionDailyStats: {}
  })
  const miranorte = ref<LocationData>({
    level: 0, levelSeries: [], flowSeries: [], production24h: [], productionDaily: [],
    levelStats: null, flowStats: {}, production24hStats: {}, productionDailyStats: {}
  })
  const miranorte200 = ref<TankData>({ level: 0, levelSeries: [], levelStats: null })
  const miranorteFlow = ref<FlowSeries[]>([])
  const miranorteProduction24h = ref<Record<string, any>[]>([])
  const miranorteProductionDaily = ref<Record<string, any>[]>([])
  const ponteAlta = ref<TankData>({ level: 0, levelSeries: [], levelStats: null })
  const ponteAltaFlow = ref<FlowSeries[]>([])
  const ponteAltaProduction24h = ref<Record<string, any>[]>([])
  const ponteAltaProductionDaily = ref<Record<string, any>[]>([])
  const loading = ref(false)
  const error         = ref<string | null>(null)
  const rateLimited   = ref(false)
  const rateLimitMins = ref(0)
  const lastUpdated = ref('')

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const [
        silSeries, mirSeries, mir200Series, mirFlow, mirProd24h, mirProdDaily, paltaSeries,
        paltaFlow, paltaProd24h, paltaProdDaily,
        flowResults, prod24h, prodDaily
      ] = await Promise.all([
        fetchTankLevel('RAP_SIL'),
        fetchTankLevel('RAP500_MIR'),
        fetchTankLevel('RAP200_MIR'),
        fetchSiteFlow(MIRANORTE_METERS()),
        fetchSiteProduction('hourly', MIRANORTE_METERS()),
        fetchSiteProduction('daily',  MIRANORTE_METERS()),
        fetchTankLevel('RAP150_PALTA'),
        fetchSiteFlow(PONTE_ALTA_METERS()),
        fetchSiteProduction('hourly', PONTE_ALTA_METERS()),
        fetchSiteProduction('daily',  PONTE_ALTA_METERS()),
        Promise.all(Object.entries(PTP_NAMES()).map(([id, name]) => fetchFlow(id, name))),
        fetchProduction24h(),
        fetchProductionDaily(),
      ])

      // Gauges show the latest smoothed point of each series
      const latest = (series: DataPoint[]) => series.length ? series[series.length - 1].value : 0
      const silLevel = latest(silSeries)
      const mirLevel = latest(mirSeries)
      const mir200Level = latest(mir200Series)
      const paltaLevel = latest(paltaSeries)

      // ── Compute stats ────────────────────────────────────────────────────
      const silLevelStats = computeStats(silSeries.map(d => d.value))
      const mirLevelStats = computeStats(mirSeries.map(d => d.value))
      const mir200LevelStats = computeStats(mir200Series.map(d => d.value))
      const paltaLevelStats = computeStats(paltaSeries.map(d => d.value))

      const flowStatsMap: Record<string, SensorStats | null> = {}
      flowResults.forEach(s => {
        flowStatsMap[s.name] = computeStats(s.values.map(d => d.value))
      })

      const prod24hStats   = productionStats(prod24h)
      const prodDailyStats = productionStats(prodDaily)

      silvanopolis.value = {
        level: silLevel,
        levelSeries: silSeries,
        flowSeries: flowResults,
        production24h: prod24h,
        productionDaily: prodDaily,
        levelStats: silLevelStats,
        flowStats: flowStatsMap,
        production24hStats:   prod24hStats,
        productionDailyStats: prodDailyStats,
      }
      miranorte.value = {
        level: mirLevel,
        levelSeries: mirSeries,
        flowSeries: flowResults,
        production24h: prod24h,
        productionDaily: prodDaily,
        levelStats: mirLevelStats,
        flowStats: flowStatsMap,
        production24hStats:   prod24hStats,
        productionDailyStats: prodDailyStats,
      }
      miranorte200.value = { level: mir200Level, levelSeries: mir200Series, levelStats: mir200LevelStats }
      miranorteFlow.value = mirFlow
      miranorteProduction24h.value = mirProd24h
      miranorteProductionDaily.value = mirProdDaily
      ponteAlta.value = { level: paltaLevel, levelSeries: paltaSeries, levelStats: paltaLevelStats }
      ponteAltaFlow.value = paltaFlow
      ponteAltaProduction24h.value = paltaProd24h
      ponteAltaProductionDaily.value = paltaProdDaily
      lastUpdated.value = new Date().toLocaleTimeString()
      appendSnapshot(silvanopolis.value, miranorte.value)

      // ── Persist boxplot stats to S3 (fire-and-forget) ───────────────────
      if (silLevelStats) saveBoxPlotRecord(SENSOR_RAP_SIL, 'RAP_Silvanopolis', silLevelStats).catch(() => {})
      if (mirLevelStats) saveBoxPlotRecord(SENSOR_RAP_MIR, 'RAP_Miranorte',    mirLevelStats).catch(() => {})
      if (mir200LevelStats) saveBoxPlotRecord(SENSOR_RAP200_MIR, 'RAP200_Miranorte', mir200LevelStats).catch(() => {})
      if (paltaLevelStats) saveBoxPlotRecord(SENSOR_RAP150_PALTA, 'RAP150_PonteAlta', paltaLevelStats).catch(() => {})
      flowResults.forEach(s => {
        const st = flowStatsMap[s.name]
        if (st) saveBoxPlotRecord(s.name, s.name, st).catch(() => {})
      })
    } catch (e: any) {
      const msg = e.message ?? ''
      if (msg.startsWith('RATE_LIMIT_EXCEEDED:')) {
        rateLimited.value   = true
        rateLimitMins.value = parseInt(msg.split(':')[1]) || 60
      } else {
        error.value = msg || 'Failed to load data'
        console.error('Timestream error:', e)
      }
    } finally {
      loading.value = false
    }
  }

  return {
    silvanopolis,
    miranorte,
    miranorte200,
    miranorteFlow,
    miranorteProduction24h,
    miranorteProductionDaily,
    ponteAlta,
    ponteAltaFlow,
    ponteAltaProduction24h,
    ponteAltaProductionDaily,
    loading,
    error,
    rateLimited,
    rateLimitMins,
    lastUpdated,
    refresh,
  }
}
