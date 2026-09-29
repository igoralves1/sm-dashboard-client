import { brand } from '@/brands/brand'

type CurrencyType = '₹' | '$' | '€'

export const currency: CurrencyType = '$'

export const currentYear = new Date().getFullYear()

// Brand-dependent values (VITE_BRAND) — see src/brands/brand.ts
export const appFavicon = brand.favicon
export const appName = brand.name
export const appTitle = brand.appTitle
export const appDescription: string = brand.appDescription

export const author: string = brand.name
export const authorWebsite: string = ''
export const authorContact: string = ''

export const basePath: string = ''
