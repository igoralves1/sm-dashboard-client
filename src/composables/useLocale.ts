/**
 * Language detection + persistence.
 * Priority: 1. localStorage override  2. IP geolocation  3. browser language  4. default EN
 */
import { ref, watch } from 'vue'

export type Locale = 'en' | 'pt' | 'es' | 'fr'

const STORAGE_KEY = 'prana_locale_v1'
const GEO_CACHE   = 'prana_geo_v1'   // shared with session tracker

const _locale = ref<Locale>(_loadSaved())

function _loadSaved(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'pt' || saved === 'es' || saved === 'fr') return saved as Locale
  return _detectFromBrowser()
}

function _detectFromBrowser(): Locale {
  const lang = navigator.language?.toLowerCase() ?? ''
  return lang.startsWith('pt') ? 'pt' : 'en'
}

/** Detect locale from IP geo (cached in sessionStorage by session tracker). */
export async function detectLocaleFromIP(): Promise<void> {
  // If user already made an explicit choice — respect it
  if (localStorage.getItem(STORAGE_KEY)) return

  // Try cached geo first
  const cached = sessionStorage.getItem(GEO_CACHE)
  if (cached) {
    try {
      const geo = JSON.parse(cached)
      _locale.value = geo.country_code === 'BR' ? 'pt' : 'en'
      return
    } catch { /* fall through */ }
  }

  // Fetch from ipapi.co
  try {
    const resp = await fetch('https://ipapi.co/json/', { cache: 'no-store' })
    const data = await resp.json()
    sessionStorage.setItem(GEO_CACHE, JSON.stringify(data))
    _locale.value = data.country_code === 'BR' ? 'pt' : 'en'
  } catch {
    // Keep browser-detected locale
  }
}

export function useLocale() {
  function setLocale(lang: Locale) {
    _locale.value = lang
    localStorage.setItem(STORAGE_KEY, lang)
  }

  return { locale: _locale, setLocale }
}
