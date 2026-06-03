import { ref, readonly } from 'vue'
import { TimestreamQueryClient, QueryCommand } from '@aws-sdk/client-timestream-query'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { useAuthStore } from '@/stores/auth'

// ── AWS Config ──────────────────────────────────────────────────────────────
const REGION = 'us-east-2'
const IDENTITY_POOL_ID = 'us-east-2:b6dd06c9-347f-4287-a77b-838592d05fb7'
const USER_POOL_ID = '<USER_POOL_ID>'
const DB = 'HidroForte'

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
const SILVANOPOLIS_CUTOFF = '2026-05-05T12:15:00Z'
const PRODUCTION_CUTOFF   = '2026-05-02T18:35:00Z'

const silvanopolisLevelExpr = `
  CASE
    WHEN time < from_iso8601_timestamp('${SILVANOPOLIS_CUTOFF}')
      THEN (cast(water_level as double) - 600)*100/(2650-600)
    ELSE
      (cast(water_level as double) - 796)*100*(5/4.2)/(3760-796)
  END`

const miranorteLevelExpr = `(cast(water_level as double) - 796)*100*(5/4.2)/(3760-796)`

function productionExpr(alias: string, pre: string, post: string) {
  return `CASE
    WHEN time < from_iso8601_timestamp('${PRODUCTION_CUTOFF}')
      THEN ${pre}
    ELSE ${post}
  END AS ${alias}`
}

// PTP calibration formulas
const PTP_FORMULAS: Record<string, { pre: string; post: string }> = {
  smca4vh: { pre: '(measure_value::double)*2/1000',           post: 'measure_value::double/(12.0*1000)' },       // PTP_01
  smc9pg7: { pre: '(measure_value::double)*2*12/(108*1000)',   post: 'measure_value::double/(108.0*1000)' },      // PTP_02
  smc25ku: { pre: 'measure_value::double/1000',                post: 'measure_value::double/(2*12.0*1000)' },     // PTP_03
  smc0qvb: { pre: 'measure_value::double/1000',                post: 'measure_value::double/(2*12.0*1000)' },     // PTP_04
  smccsl0: { pre: '(measure_value::double)*2/1000',            post: 'measure_value::double/(12.0*1000)' },       // PTP_07
}

const PTP_NAMES: Record<string, string> = {
  smca4vh: 'PTP_01', smc9pg7: 'PTP_02', smc25ku: 'PTP_03',
  smc0qvb: 'PTP_04', smccsl0: 'PTP_07',
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DataPoint { time: Date; value: number }
export interface FlowSeries { name: string; values: DataPoint[] }

export interface LocationData {
  level: number
  levelSeries: DataPoint[]
  flowSeries: FlowSeries[]
  production24h: Record<string, any>[]
  productionDaily: Record<string, any>[]
}

// ── Fetch functions ───────────────────────────────────────────────────────────

async function fetchLevel(endId: string, expr: string): Promise<DataPoint[]> {
  const rows = await query(`
    SELECT ${expr} AS water_level, time
    FROM "${DB}"."<TABLE_RT>"
    WHERE time >= ago(24h)
    AND end_id = '${endId}'
    ORDER BY time ASC
  `)
  return rows.map(r => ({ time: new Date(r.time), value: parseFloat(r.water_level) }))
}

async function fetchCurrentLevel(endId: string, expr: string): Promise<number> {
  const rows = await query(`
    SELECT ${expr} AS water_level
    FROM "${DB}"."<TABLE_RT>"
    WHERE end_id = '${endId}'
    ORDER BY time DESC LIMIT 1
  `)
  return rows.length ? parseFloat(rows[0].water_level) : 0
}

async function fetchFlow(endId: string, ptpName: string): Promise<FlowSeries> {
  const rows = await query(`
    SELECT cast(flux as double)*60/(12*1000) AS value, time
    FROM "${DB}"."<TABLE_RT>"
    WHERE time >= ago(24h)
    AND end_id = '${endId}'
    ORDER BY time ASC
  `)
  return {
    name: ptpName,
    values: rows.map(r => ({ time: new Date(r.time), value: parseFloat(r.value) }))
  }
}

async function fetchProduction24h(): Promise<Record<string, any>[]> {
  const ptps = Object.entries(PTP_NAMES)
  const queries = ptps.map(async ([endId, name]) => {
    const { pre, post } = PTP_FORMULAS[endId]
    const rows = await query(`
      SELECT "hour", time,
        ${productionExpr(name, pre, post)}
      FROM "${DB}"."<TABLE_HOURLY>"
      WHERE "time" >= AGO(1d)
      AND end_id = '${endId}'
      AND measure_name = 'L_acc'
      ORDER BY time DESC LIMIT 24
    `)
    return { name, rows: rows.reverse() }
  })
  const results = await Promise.all(queries)
  // Merge by hour index
  const baseRows = results[0].rows
  return baseRows.map((row, i) => {
    const merged: Record<string, any> = { hour: row.hour ?? String(i) }
    results.forEach(r => { merged[r.name] = parseFloat(r.rows[i]?.[r.name] ?? '0') })
    return merged
  })
}

async function fetchProductionDaily(): Promise<Record<string, any>[]> {
  const ptps = Object.entries(PTP_NAMES)
  const queries = ptps.map(async ([endId, name]) => {
    const { pre, post } = PTP_FORMULAS[endId]
    const rows = await query(`
      SELECT day, time,
        ${productionExpr(name, pre, post)}
      FROM "${DB}"."<TABLE_DAILY>"
      WHERE "time" >= AGO(7d)
      AND end_id = '${endId}'
      AND measure_name = 'L_acc'
      ORDER BY time DESC LIMIT 7
    `)
    return { name, rows: rows.reverse() }
  })
  const results = await Promise.all(queries)
  const baseRows = results[0].rows
  return baseRows.map((row, i) => {
    const d = new Date(row.time)
    const merged: Record<string, any> = { day: d.getDate().toString() }
    results.forEach(r => { merged[r.name] = parseFloat(r.rows[i]?.[r.name] ?? '0') })
    return merged
  })
}

// ── Main composable ───────────────────────────────────────────────────────────
export function useTimestreamDashboard() {
  const silvanopolis = ref<LocationData>({
    level: 0, levelSeries: [], flowSeries: [], production24h: [], productionDaily: []
  })
  const miranorte = ref<LocationData>({
    level: 0, levelSeries: [], flowSeries: [], production24h: [], productionDaily: []
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref('')

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const [
        silLevel, silSeries, mirLevel, mirSeries,
        flowResults, prod24h, prodDaily
      ] = await Promise.all([
        fetchCurrentLevel('smc01ow', silvanopolisLevelExpr),
        fetchLevel('smc01ow', silvanopolisLevelExpr),
        fetchCurrentLevel('smcait1', miranorteLevelExpr),
        fetchLevel('smcait1', miranorteLevelExpr),
        Promise.all(Object.entries(PTP_NAMES).map(([id, name]) => fetchFlow(id, name))),
        fetchProduction24h(),
        fetchProductionDaily(),
      ])

      silvanopolis.value = {
        level: silLevel,
        levelSeries: silSeries,
        flowSeries: flowResults,
        production24h: prod24h,
        productionDaily: prodDaily,
      }
      miranorte.value = {
        level: mirLevel,
        levelSeries: mirSeries,
        flowSeries: flowResults, // TODO: separate Miranorte PTPs
        production24h: prod24h,
        productionDaily: prodDaily,
      }
      lastUpdated.value = new Date().toLocaleTimeString()
    } catch (e: any) {
      error.value = e.message ?? 'Failed to load data'
      console.error('Timestream error:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    silvanopolis: readonly(silvanopolis),
    miranorte: readonly(miranorte),
    loading: readonly(loading),
    error: readonly(error),
    lastUpdated: readonly(lastUpdated),
    refresh,
  }
}
