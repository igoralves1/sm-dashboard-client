import { ref, computed } from 'vue'
import { useS3Activity } from './useS3Activity'
import type { Anomaly } from './useAnomalyDetection'

const STORAGE_KEY   = 'prana_alerts_v1'
const MAX_ALERTS    = 200
const POLL_INTERVAL = 15_000   // 15 seconds

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

// Module-level singleton — all callers share the same reactive state
const _alerts   = ref<StoredAlert[]>(load())
let   _s3Inited = false
let   _pollTimer: ReturnType<typeof setInterval> | null = null

function _merge(incoming: StoredAlert[]) {
  if (!incoming.length) return
  const existing = new Set(_alerts.value.map(a => a.id))
  const fresh    = incoming.filter(a => !existing.has(a.id))
  if (!fresh.length && incoming.length <= _alerts.value.length) return  // nothing new
  const merged = [...incoming, ..._alerts.value.filter(a => !incoming.find(x => x.id === a.id))]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_ALERTS)
  _alerts.value = merged
  save(merged)
}

export function useAlertStore() {
  const alerts = computed(() => _alerts.value)

  const alerts24h = computed(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return _alerts.value.filter(a => new Date(a.timestamp).getTime() >= cutoff)
  })

  // ── S3 init (runs once per session) ────────────────────────────────────────
  async function initFromS3(): Promise<void> {
    if (_s3Inited) return
    _s3Inited = true
    try {
      const { loadAllAlerts, uploadAlert } = useS3Activity()
      const s3Alerts = await loadAllAlerts()

      // Push any local-only alerts to S3
      const s3Ids     = new Set(s3Alerts.map(a => a.id))
      const localOnly = _alerts.value.filter(a => !s3Ids.has(a.id))
      localOnly.forEach(a => uploadAlert(a))

      _merge([...s3Alerts, ...localOnly])
    } catch { /* silent — local data still shown */ }
  }

  // ── Real-time poll (single GET of _latest.json every 15s) ──────────────────
  function startPolling() {
    if (_pollTimer) return   // already polling
    _pollTimer = setInterval(async () => {
      try {
        const { loadLatestAlerts } = useS3Activity()
        const latest = await loadLatestAlerts()
        _merge(latest)
      } catch { /* silent */ }
    }, POLL_INTERVAL)
  }

  function stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
  }

  // ── Ingest from sensors ─────────────────────────────────────────────────────
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

    // Deduplicate: skip if same ptp+type+source stored within last 5 min
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

    // Upload to S3 immediately — also updates _latest.json index
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
    stopPolling()
  }

  function exportJson(): string {
    return JSON.stringify(_alerts.value, null, 2)
  }

  return {
    alerts, alerts24h,
    initFromS3, startPolling, stopPolling,
    ingestAnomalies, replaceAll, clear, exportJson,
  }
}
