import type { LocationData } from './useTimestreamDashboard'

const STORAGE_KEY = 'hidroforte_data_log'
const MAX_SNAPSHOTS = 500

export interface Snapshot {
  capturedAt: string
  silvanopolis: LocationData
  miranorte: LocationData
}

export interface DataLog {
  snapshots: Snapshot[]
}

function load(): DataLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DataLog
  } catch {}
  return { snapshots: [] }
}

// localStorage holds ~5 MB per origin and is shared with locale, layout and alerts.
// Each snapshot carries the full 24 h series (~1 MB), so the log keeps only the newest
// snapshots that fit this budget — never the whole quota.
const MAX_BYTES = 2_000_000

/**
 * Persist the log without ever throwing: logging must not break a dashboard refresh.
 * Drops the oldest snapshots until it fits the budget and the browser quota.
 */
function save(log: DataLog) {
  let json = JSON.stringify(log)
  while (json.length > MAX_BYTES && log.snapshots.length > 1) {
    log.snapshots.shift()
    json = JSON.stringify(log)
  }
  while (true) {
    try {
      localStorage.setItem(STORAGE_KEY, json)
      return
    } catch {
      if (!log.snapshots.length) break
      log.snapshots.shift()   // quota exceeded (other keys use space too) — drop oldest and retry
      json = JSON.stringify(log)
    }
  }
  // Not even an empty log fits: free the space rather than keep a stale, oversized entry.
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
  console.warn('[dashboard-logger] snapshot not saved: localStorage is full')
}

export function appendSnapshot(silvanopolis: LocationData, miranorte: LocationData) {
  const log = load()
  log.snapshots.push({
    capturedAt: new Date().toISOString(),
    silvanopolis: JSON.parse(JSON.stringify(silvanopolis)), // deep clone
    miranorte: JSON.parse(JSON.stringify(miranorte)),
  })
  if (log.snapshots.length > MAX_SNAPSHOTS) {
    log.snapshots = log.snapshots.slice(-MAX_SNAPSHOTS)
  }
  save(log)
}

export function exportLog() {
  const log = load()
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hidroforte_data_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function clearLog() {
  localStorage.removeItem(STORAGE_KEY)
}

export function getSnapshotCount(): number {
  return load().snapshots.length
}
