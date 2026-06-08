import { ref, computed } from 'vue'
import { useS3Activity } from './useS3Activity'
import type { Anomaly } from './useAnomalyDetection'

const STORAGE_KEY = 'prana_alerts_v1'
const MAX_ALERTS  = 200

export interface StoredAlert {
  id:        string
  timestamp: string   // ISO-8601
  source:    'dashboard-sm-24h' | 'dashboard-sm-5d'
  ptp:       string
  type:      string
  severity:  'critical' | 'warning' | 'info'
  detail:    string
  pValuePct: number
  hours:     number[]
}

function load(): StoredAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredAlert[]) : []
  } catch { return [] }
}

function save(alerts: StoredAlert[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)) } catch {}
}

// Module-level singleton so all callers share the same reactive state
const _alerts   = ref<StoredAlert[]>(load())
let   _s3Inited = false

export function useAlertStore() {
  const alerts = computed(() => _alerts.value)

  const alerts24h = computed(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return _alerts.value.filter(a => new Date(a.timestamp).getTime() >= cutoff)
  })

  // Load from S3 and merge — call once per page load from each page that uses alerts
  async function initFromS3(): Promise<void> {
    if (_s3Inited) return
    _s3Inited = true
    try {
      const { loadAllAlerts } = useS3Activity()
      const s3Alerts = await loadAllAlerts()
      if (!s3Alerts.length) return

      const s3Ids     = new Set(s3Alerts.map(a => a.id))
      const localOnly = _alerts.value.filter(a => !s3Ids.has(a.id))

      // Push any local-only alerts up to S3
      if (localOnly.length) {
        const { uploadAlert } = useS3Activity()
        localOnly.forEach(a => uploadAlert(a))
      }

      // S3 is source of truth
      const merged = [...s3Alerts, ...localOnly]
        .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, MAX_ALERTS)

      _alerts.value = merged
      save(merged)
    } catch { /* silent — local data still shown */ }
  }

  function ingestAnomalies(anomalies: Anomaly[], source: StoredAlert['source']) {
    if (!anomalies.length) return
    const now = new Date().toISOString()
    const incoming: StoredAlert[] = anomalies.map(a => ({
      id:        `${source}-${a.ptp}-${a.type}-${now}`,
      timestamp: now,
      source,
      ptp:       a.ptp,
      type:      a.type,
      severity:  a.severity,
      detail:    a.detail,
      pValuePct: a.pValuePct,
      hours:     a.hours,
    }))

    // Deduplicate: skip if same ptp+type+source already stored within last 5 min
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const recentKeys = new Set(
      _alerts.value
        .filter(a => new Date(a.timestamp).getTime() >= fiveMinAgo)
        .map(a => `${a.source}-${a.ptp}-${a.type}`)
    )
    const fresh = incoming.filter(a => !recentKeys.has(`${a.source}-${a.ptp}-${a.type}`))
    if (!fresh.length) return

    _alerts.value = [...fresh, ..._alerts.value].slice(0, MAX_ALERTS)
    save(_alerts.value)

    // Upload to S3 immediately (same Cognito session, no dynamic import delay)
    const { uploadAlert } = useS3Activity()
    fresh.forEach(a => uploadAlert(a))
  }

  function replaceAll(incoming: StoredAlert[]) {
    _alerts.value = incoming.slice(0, MAX_ALERTS)
    save(_alerts.value)
  }

  function clear() {
    _alerts.value = []
    save([])
    _s3Inited = false
  }

  function exportJson(): string {
    return JSON.stringify(_alerts.value, null, 2)
  }

  return { alerts, alerts24h, initFromS3, ingestAnomalies, replaceAll, clear, exportJson }
}
