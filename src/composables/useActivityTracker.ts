import { ref, computed } from 'vue'

const STORAGE_KEY = 'prana_activity_v1'
const MAX_EVENTS  = 500

export type ActivityEventType = 'login' | 'logout' | 'page_view'

export interface ActivityEvent {
  id:        string
  timestamp: string
  type:      ActivityEventType
  user:      string          // email or 'anonymous'
  page?:     string          // route path for page_view
  title?:    string          // page title
  meta?:     Record<string, unknown>
}

function load(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActivityEvent[]) : []
  } catch {
    return []
  }
}

function persist(events: ActivityEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {}
}

const _events = ref<ActivityEvent[]>(load())

export function useActivityTracker() {
  const events = computed(() => _events.value)

  const events24h = computed(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return _events.value.filter(e => new Date(e.timestamp).getTime() >= cutoff)
  })

  const uniqueUsers24h = computed(() =>
    [...new Set(events24h.value.map(e => e.user).filter(u => u !== 'anonymous'))]
  )

  function track(type: ActivityEventType, user: string, extra?: Partial<Omit<ActivityEvent, 'id' | 'timestamp' | 'type' | 'user'>>) {
    const event: ActivityEvent = {
      id:        `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      type,
      user,
      ...extra,
    }
    _events.value = [event, ..._events.value].slice(0, MAX_EVENTS)
    persist(_events.value)
  }

  function trackLogin(user: string) {
    track('login', user, { meta: { userAgent: navigator.userAgent } })
  }

  function trackLogout(user: string) {
    track('logout', user)
  }

  function trackPageView(user: string, page: string, title: string) {
    // Skip consecutive duplicate page views for same user
    const last = _events.value.find(e => e.user === user && e.type === 'page_view')
    if (last?.page === page) return
    track('page_view', user, { page, title })
  }

  function clear() {
    _events.value = []
    persist([])
  }

  function exportJson(): string {
    return JSON.stringify(_events.value, null, 2)
  }

  return { events, events24h, uniqueUsers24h, trackLogin, trackLogout, trackPageView, clear, exportJson }
}
