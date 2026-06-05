/**
 * Client-side rate limiter — 360 queries per rolling 60-minute window.
 * State persisted in sessionStorage so it survives page refreshes
 * but resets when the browser/tab closes.
 */

const LIMIT       = 360
const WINDOW_MS   = 60 * 60 * 1000  // 1 hour in ms
const STORAGE_KEY = 'rl_state'

interface RLState {
  count:       number
  windowStart: number  // epoch ms
}

function loadState(): RLState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as RLState
  } catch { /* ignore */ }
  return { count: 0, windowStart: Date.now() }
}

function saveState(s: RLState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export interface RateLimitResult {
  allowed:      boolean
  remaining:    number   // queries left in current window
  resetInSecs:  number   // seconds until window resets
}

/**
 * Call before every Timestream query.
 * Returns { allowed: false } when the limit is reached.
 */
export function checkRateLimit(): RateLimitResult {
  let state = loadState()
  const now = Date.now()

  // Roll the window if expired
  if (now - state.windowStart >= WINDOW_MS) {
    state = { count: 0, windowStart: now }
  }

  const remaining   = Math.max(0, LIMIT - state.count)
  const resetInSecs = Math.ceil((state.windowStart + WINDOW_MS - now) / 1000)

  if (state.count >= LIMIT) {
    saveState(state)
    return { allowed: false, remaining: 0, resetInSecs }
  }

  state.count++
  saveState(state)
  return { allowed: true, remaining: remaining - 1, resetInSecs }
}

/** Read current state without incrementing — for UI display. */
export function getRateLimitStatus(): RateLimitResult {
  const state = loadState()
  const now   = Date.now()

  if (now - state.windowStart >= WINDOW_MS) {
    return { allowed: true, remaining: LIMIT, resetInSecs: 0 }
  }

  const remaining   = Math.max(0, LIMIT - state.count)
  const resetInSecs = Math.ceil((state.windowStart + WINDOW_MS - now) / 1000)
  return { allowed: remaining > 0, remaining, resetInSecs }
}
