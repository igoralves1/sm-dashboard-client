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
const SENSOR_RAP_MIR = import.meta.env.VITE_SENSOR_RAP_MIR as string
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

const miranorteLevelExpr = `(cast(water_level as double) - 796)*100*(5/4.2)/(3760-796)`

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

async function fetchLevel(endId: string, expr: string): Promise<DataPoint[]> {
  const rows = await query(`
    SELECT ${expr} AS water_level, time
    FROM "${DB}"."${TABLE_RT}"
    WHERE time >= ago(24h)
    AND end_id = '${endId}'
    ORDER BY time ASC
  `)
  return rows.map(r => ({ time: new Date(r.time), value: parseFloat(r.water_level) }))
}

// Silvanópolis: union of old + new table, drop out-of-range readings, 11-point moving average
async function fetchSilvanopolisLevel(): Promise<DataPoint[]> {
  const rows = await query(`
    WITH raw AS (
      SELECT
        (cast(water_level as double) - 796)*100*(5/4.8)/(3760-796) AS water_level,
        time
      FROM "${DB}"."${TABLE_RT}"
      WHERE time >= ago(24h)
        AND time < from_iso8601_timestamp('${SENSORS_DATA_CUTOFF}')
        AND end_id = '${SENSOR_RAP_SIL}'

      UNION ALL

      SELECT
        (cast(wtr_level as double) - 796)*100*(5/4.4)/(3760-796) AS water_level,
        time
      FROM "${DB}"."${TABLE_SENSORS}"
      WHERE time >= ago(24h)
        AND time >= from_iso8601_timestamp('${SENSORS_DATA_CUTOFF}')
        AND end_id = '${SENSOR_RAP_SIL}'
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
        ROWS BETWEEN 10 PRECEDING AND CURRENT ROW
      ) AS water_level,
      time
    FROM clean
    ORDER BY time ASC
  `)
  return rows
    .map(r => ({ time: new Date(r.time), value: parseFloat(r.water_level) }))
    .filter(d => isFinite(d.value))
}

async function fetchCurrentLevel(endId: string, expr: string): Promise<number> {
  const rows = await query(`
    SELECT ${expr} AS water_level
    FROM "${DB}"."${TABLE_RT}"
    WHERE end_id = '${endId}'
    ORDER BY time DESC LIMIT 1
  `)
  return rows.length ? parseFloat(rows[0].water_level) : 0
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
        silSeries, mirLevel, mirSeries,
        flowResults, prod24h, prodDaily
      ] = await Promise.all([
        fetchSilvanopolisLevel(),
        fetchCurrentLevel(SENSOR_RAP_MIR, miranorteLevelExpr),
        fetchLevel(SENSOR_RAP_MIR, miranorteLevelExpr),
        Promise.all(Object.entries(PTP_NAMES()).map(([id, name]) => fetchFlow(id, name))),
        fetchProduction24h(),
        fetchProductionDaily(),
      ])

      // Gauge shows the latest smoothed point of the series
      const silLevel = silSeries.length ? silSeries[silSeries.length - 1].value : 0

      // ── Compute stats ────────────────────────────────────────────────────
      const silLevelStats = computeStats(silSeries.map(d => d.value))
      const mirLevelStats = computeStats(mirSeries.map(d => d.value))

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
      lastUpdated.value = new Date().toLocaleTimeString()
      appendSnapshot(silvanopolis.value, miranorte.value)

      // ── Persist boxplot stats to S3 (fire-and-forget) ───────────────────
      if (silLevelStats) saveBoxPlotRecord(SENSOR_RAP_SIL, 'RAP_Silvanopolis', silLevelStats).catch(() => {})
      if (mirLevelStats) saveBoxPlotRecord(SENSOR_RAP_MIR, 'RAP_Miranorte',    mirLevelStats).catch(() => {})
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
    loading,
    error,
    rateLimited,
    rateLimitMins,
    lastUpdated,
    refresh,
  }
}
