// Brand configuration — controlled by VITE_BRAND in .env (build-time)
// Supported values: 'simemap' | 'prana'
//
// Everything brand-specific (names, logos, favicon, theme key, storage keys) comes from here.
// SCSS colours follow the same switch via the `$brand` variable injected in vite.config.ts,
// and index.html title/favicon via the brandHtml() plugin there.

import simemapLogo from './simemap/logos/simemap-logo.svg'
import simemapLogoWhite from './simemap/logos/simemap-logo-white.svg'
import simemapGlobeWhite from './simemap/logos/simemap-globe-white.svg'
import pranaLogoTotal from './prana/logos/pranalogototal.svg'
import pranaLogo300 from './prana/logos/pranafinal_300px.svg'

export type BrandId = 'simemap' | 'prana'

export interface BrandConfig {
  id: BrandId
  /** short name: footers, breadcrumbs, alt text */
  name: string
  /** product name in the topbar mega menu */
  productName: string
  /** browser tab title suffix */
  appTitle: string
  appDescription: string
  tagline: string
  /** prefix of every localStorage key (locale, geo, sessions, alerts, activity) */
  storagePrefix: string
  /** pinia persisted layout key (simemap keeps the historical key) */
  layoutStorageKey: string
  /** value of html[data-menu-color] / html[data-topbar-color] — theme blocks in _theme-classic.scss */
  themeColor: BrandId
  /** favicon served from /public */
  favicon: string
  logos: {
    /** sidebar, expanded (dark sidebar background) */
    sidenav: string
    /** sidebar, collapsed */
    sidenavSm: string
    /** sidebar in light mode / topbar */
    dark: string
    /** auth hero panels + dashboard header (on dark / gradient backgrounds) */
    onDark: string
    /** auth hero logo height in px */
    onDarkHeight: number
  }
}

const brands: Record<BrandId, BrandConfig> = {
  simemap: {
    id: 'simemap',
    name: 'SIMEMAP',
    productName: 'SIMEMAP AIIoT',
    appTitle: 'SIMEMAP - Admin Dashboard',
    appDescription: 'SIMEMAP admin dashboard.',
    tagline: 'Sistema de Monitoramento e Automação de Processos',
    storagePrefix: 'simemap_',
    layoutStorageKey: 'layout-v2',
    themeColor: 'simemap',
    favicon: '/sm-dashboard-client/favicon.svg',
    logos: {
      sidenav: simemapLogoWhite,
      sidenavSm: simemapGlobeWhite,
      dark: simemapLogo,
      onDark: simemapLogoWhite,
      onDarkHeight: 120,
    },
  },
  prana: {
    id: 'prana',
    name: 'prana',
    productName: 'prana AIIoT',
    appTitle: 'prana - Admin Dashboard',
    appDescription: 'prana admin dashboard.',
    tagline: 'Predictive Maintenance & Supply Chain',
    storagePrefix: 'prana_',
    layoutStorageKey: 'prana_layout-v2',
    themeColor: 'prana',
    favicon: '/sm-dashboard-client/prana-favicon.svg',
    logos: {
      sidenav: pranaLogoTotal,
      sidenavSm: pranaLogoTotal,
      dark: pranaLogoTotal,
      onDark: pranaLogo300,
      onDarkHeight: 200,
    },
  },
}

const brandId = (import.meta.env.VITE_BRAND as BrandId) || 'simemap'

export const brand: BrandConfig = brands[brandId] ?? brands.simemap
