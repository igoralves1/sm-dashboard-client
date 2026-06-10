/**
 * 12-month rolling boxplot / SPC stats storage on S3.
 * Key pattern: boxplots/{sensorId}/stats.json
 *
 * JSON structure is designed for fast analytical reads:
 *  - current: latest 24h stats (recomputed on every refresh)
 *  - months:  map of YYYY-MM → monthly stats (appended monthly, max 12 entries)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { CognitoIdentityClient }    from '@aws-sdk/client-cognito-identity'
import { useAuthStore }              from '@/stores/auth'
import type { SensorStats }          from './useStatistics'

const BUCKET   = import.meta.env.VITE_S3_ACTIVITY_BUCKET as string
const REGION   = import.meta.env.VITE_AWS_REGION         as string
const POOL_ID  = import.meta.env.VITE_IDENTITY_POOL_ID   as string
const UP_ID    = import.meta.env.VITE_USER_POOL_ID       as string

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BoxPlotRecord {
  schemaVersion: '1'
  sensorId:      string
  sensorName:    string
  updatedAt:     string           // ISO-8601
  current:       SensorStats      // rolling 24h
  months:        Record<string, SensorStats>  // "YYYY-MM" → monthly stats
}

// ── S3 client ─────────────────────────────────────────────────────────────────
function makeClient(): S3Client {
  const auth    = useAuthStore()
  const idToken = auth.idToken ?? ''
  const logins  = idToken
    ? { [`cognito-idp.${REGION}.amazonaws.com/${UP_ID}`]: idToken }
    : undefined

  return new S3Client({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      // @ts-ignore
      client: new CognitoIdentityClient({ region: REGION }),
      identityPoolId: POOL_ID,
      logins,
    }),
  })
}

function key(sensorId: string) {
  return `boxplots/${sensorId}/stats.json`
}

// ── Read ──────────────────────────────────────────────────────────────────────
export async function loadBoxPlotRecord(sensorId: string): Promise<BoxPlotRecord | null> {
  try {
    const res: GetObjectCommandOutput = await makeClient().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key(sensorId) })
    )
    const body = await res.Body?.transformToString()
    if (!body) return null
    return JSON.parse(body) as BoxPlotRecord
  } catch {
    return null   // Not found → will be created on first save
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────
export async function saveBoxPlotRecord(
  sensorId:   string,
  sensorName: string,
  current:    SensorStats,
): Promise<void> {
  try {
    // Load existing to preserve monthly history
    const existing = await loadBoxPlotRecord(sensorId)
    const months   = existing?.months ?? {}

    // Append / update current month entry
    const ym = new Date().toISOString().slice(0, 7)   // "YYYY-MM"
    months[ym] = current

    // Keep only last 12 months
    const sortedKeys = Object.keys(months).sort().slice(-12)
    const trimmed: Record<string, SensorStats> = {}
    sortedKeys.forEach(k => { trimmed[k] = months[k] })

    const record: BoxPlotRecord = {
      schemaVersion: '1',
      sensorId,
      sensorName,
      updatedAt: new Date().toISOString(),
      current,
      months: trimmed,
    }

    await makeClient().send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key(sensorId),
      Body:        JSON.stringify(record, null, 2),
      ContentType: 'application/json',
    }))
  } catch (e) {
    console.warn(`[BoxPlotStorage] save failed for ${sensorId}:`, e)
  }
}
