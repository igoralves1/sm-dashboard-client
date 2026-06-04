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

function save(log: DataLog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch (e: any) {
    // localStorage quota exceeded — drop oldest half and retry
    if (e?.name === 'QuotaExceededError') {
      log.snapshots = log.snapshots.slice(Math.floor(log.snapshots.length / 2))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
    }
  }
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
