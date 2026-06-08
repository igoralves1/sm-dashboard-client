/**
 * Behavioral session tracker.
 * Tracks per-page: time spent, mouse position (every 10s), clicks.
 * Fetches IP + geolocation once per browser session.
 * Storage key: prana_sessions_v1 (localStorage, max 200 page sessions)
 */

const STORAGE_KEY  = 'prana_sessions_v1'
const GEO_CACHE    = 'prana_geo_v1'
const SAMPLE_MS    = 10_000   // mouse position sample interval
const MAX_SESSIONS = 200

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  type:    'mobile' | 'tablet' | 'desktop'
  browser: string
  os:      string
  ua:      string
}

export interface GpsCoords {
  lat:      number
  lng:      number
  accuracy: number   // metres
}

export interface GeoInfo {
  ip:      string
  city:    string
  region:  string
  country: string
  lat:     number
  lng:     number
}

export interface MouseSample {
  t:        number    // seconds since page entry
  x:        number    // px from left
  y:        number    // px from top
  pct_x:   number    // % of page width
  pct_y:   number    // % of page height
  element:  string    // tag#id.class[0]
}

export interface ClickEvent {
  t:       number
  x:       number
  y:       number
  element: string
  text:    string
}

export interface PageSession {
  id:          string
  user:        string
  page:        string
  title:       string
  enteredAt:   string
  exitedAt?:   string
  duration?:   number        // seconds
  geo?:        GeoInfo
  device?:     DeviceInfo
  gps?:        GpsCoords
  mouseTrails: MouseSample[]
  clicks:      ClickEvent[]
}

// ── Device detection ─────────────────────────────────────────────────────────

function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent
  const isMobile  = /Mobi|Android|iPhone|iPod/i.test(ua)
  const isTablet  = /iPad|Tablet|(Android(?!.*Mobi))/i.test(ua)
  const type: DeviceInfo['type'] = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'

  let browser = 'Unknown'
  if (/Edg\//i.test(ua))          browser = 'Edge'
  else if (/OPR\//i.test(ua))     browser = 'Opera'
  else if (/Chrome\//i.test(ua))  browser = 'Chrome'
  else if (/Safari\//i.test(ua))  browser = 'Safari'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'

  let os = 'Unknown'
  if (/Windows/i.test(ua))        os = 'Windows'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Android/i.test(ua))   os = 'Android'
  else if (/Mac OS X/i.test(ua))  os = 'macOS'
  else if (/Linux/i.test(ua))     os = 'Linux'

  return { type, browser, os, ua: ua.slice(0, 200) }
}

// ── GPS (mobile only, non-blocking) ──────────────────────────────────────────

function fetchGps(): Promise<GpsCoords | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined)
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
      }),
      () => resolve(undefined),
      { timeout: 8000, maximumAge: 60000 }
    )
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function elDescriptor(el: Element | null): string {
  if (!el) return 'unknown'
  const tag  = el.tagName.toLowerCase()
  const id   = el.id   ? `#${el.id}`   : ''
  const cls  = el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''
  const aria = el.getAttribute('aria-label') ? `[aria="${el.getAttribute('aria-label')}"]` : ''
  return `${tag}${id}${cls}${aria}`.slice(0, 80)
}

function elText(el: Element | null): string {
  if (!el) return ''
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function load(): PageSession[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function persist(sessions: PageSession[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) } catch {}
}

// ── Geo fetch (cached for the browser session) ───────────────────────────────

let geoPromise: Promise<GeoInfo | undefined> | null = null

function fetchGeo(): Promise<GeoInfo | undefined> {
  // Return cached result within the same browser session
  const cached = sessionStorage.getItem(GEO_CACHE)
  if (cached) return Promise.resolve(JSON.parse(cached) as GeoInfo)

  if (!geoPromise) {
    geoPromise = fetch('https://ipapi.co/json/', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const geo: GeoInfo = {
          ip:      d.ip      ?? 'unknown',
          city:    d.city    ?? '',
          region:  d.region  ?? '',
          country: d.country_name ?? '',
          lat:     d.latitude  ?? 0,
          lng:     d.longitude ?? 0,
        }
        sessionStorage.setItem(GEO_CACHE, JSON.stringify(geo))
        return geo
      })
      .catch(() => undefined)
  }
  return geoPromise
}

// ── Tracker state (module-level, one active session at a time) ───────────────

let current:     PageSession | null = null
let mouseX = 0
let mouseY = 0
let startTime = 0
let sampleTimer: ReturnType<typeof setInterval> | null = null
let abortController: AbortController | null = null

function sampleMouse() {
  if (!current) return
  const t     = Math.round((Date.now() - startTime) / 1000)
  const pct_x = Math.round((mouseX / window.innerWidth)  * 100)
  const pct_y = Math.round((mouseY / window.innerHeight) * 100)
  const el    = document.elementFromPoint(mouseX, mouseY)
  current.mouseTrails.push({ t, x: mouseX, y: mouseY, pct_x, pct_y, element: elDescriptor(el) })
}

// ── Public API ────────────────────────────────────────────────────────────────

export function useSessionTracker() {

  function startPage(user: string, page: string, title: string) {
    // Finalize any previous session before starting a new one
    if (current) _finalize()

    startTime = Date.now()
    current = {
      id:          `sess-${startTime}-${Math.random().toString(36).slice(2, 6)}`,
      user,
      page,
      title,
      enteredAt:   new Date(startTime).toISOString(),
      mouseTrails: [],
      clicks:      [],
    }

    // Detect device immediately (synchronous)
    current.device = detectDevice()

    // Attach IP geo asynchronously
    fetchGeo().then(geo => { if (current && geo) current.geo = geo })

    // Request GPS on mobile/tablet
    if (current.device.type !== 'desktop') {
      fetchGps().then(gps => { if (current && gps) current.gps = gps })
    }

    // Start listeners
    abortController = new AbortController()
    const { signal } = abortController

    window.addEventListener('mousemove', (e: MouseEvent) => {
      mouseX = e.clientX; mouseY = e.clientY
    }, { signal, passive: true })

    window.addEventListener('click', (e: MouseEvent) => {
      if (!current) return
      const el = e.target as Element | null
      current.clicks.push({
        t:       Math.round((Date.now() - startTime) / 1000),
        x:       e.clientX,
        y:       e.clientY,
        element: elDescriptor(el),
        text:    elText(el),
      })
    }, { signal })

    // Sample mouse every 10s
    sampleTimer = setInterval(sampleMouse, SAMPLE_MS)
  }

  function endPage() {
    _finalize()
  }

  function _finalize() {
    if (!current) return

    // Stop listeners
    abortController?.abort()
    abortController = null
    if (sampleTimer) { clearInterval(sampleTimer); sampleTimer = null }

    // Take one final mouse sample
    sampleMouse()

    const exitedAt = new Date().toISOString()
    const duration = Math.round((Date.now() - startTime) / 1000)
    current.exitedAt = exitedAt
    current.duration = duration

    const all = load()
    all.unshift(current)
    persist(all.slice(0, MAX_SESSIONS))

    // Push to S3 for cross-browser shared storage
    const saved = { ...current }
    import('./useS3Activity').then(({ useS3Activity }) => {
      useS3Activity().uploadSession(saved)
    })

    current = null
  }

  function getSessions(): PageSession[] {
    return load()
  }

  function exportJson(): string {
    return JSON.stringify(load(), null, 2)
  }

  function clear() {
    persist([])
  }

  return { startPage, endPage, getSessions, exportJson, clear }
}
