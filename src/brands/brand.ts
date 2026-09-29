// Brand configuration — controlled by VITE_BRAND in .env
// Supported values: 'simemap' | 'prana'

export type BrandId = 'simemap' | 'prana'

const brandId = (import.meta.env.VITE_BRAND as BrandId) || 'simemap'

interface BrandConfig {
  id: BrandId
  name: string
  tagline: string
  storagePrefix: string
  /** logo used in expanded sidebar */
  logoFull: string
  /** icon used in collapsed sidebar */
  logoMini: string
  /** white/light version for dark backgrounds */
  logoWhite: string
  favicon: string
}

const brands: Record<BrandId, BrandConfig> = {
  simemap: {
    id: 'simemap',
    name: 'SIMEMAP',
    tagline: 'Sistema de Monitoramento e Automação de Processos',
    storagePrefix: 'simemap_',
    logoFull:  new URL('./simemap/logos/simemap-logo.svg',       import.meta.url).href,
    logoMini:  new URL('./simemap/logos/logo-sm.png',            import.meta.url).href,
    logoWhite: new URL('./simemap/logos/simemap-logo-white.svg', import.meta.url).href,
    favicon:   new URL('./simemap/logos/favicon.ico',            import.meta.url).href,
  },
  prana: {
    id: 'prana',
    name: 'Prana',
    tagline: 'Predictive Maintenance & Supply Chain',
    storagePrefix: 'prana_',
    logoFull:  new URL('./prana/logos/pranafinal.svg',     import.meta.url).href,
    logoMini:  new URL('./prana/logos/logo-sm.png',        import.meta.url).href,
    logoWhite: new URL('./prana/logos/pranafinal.svg',     import.meta.url).href,
    favicon:   new URL('./prana/logos/favicon.ico',        import.meta.url).href,
  },
}

export const brand: BrandConfig = brands[brandId] ?? brands.simemap
