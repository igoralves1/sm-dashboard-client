import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { BootstrapVueNextResolver } from 'bootstrap-vue-next'

// Brand-specific index.html bits (VITE_BRAND in .env) — the rest lives in src/brands/brand.ts
const BRAND_HTML: Record<string, { title: string; favicons: string }> = {
    simemap: {
        title: 'SIMEMAP — IoT Monitoring Dashboard',
        favicons: '<link rel="icon" type="image/svg+xml" href="/sm-dashboard-client/favicon.svg">\n    <link rel="icon" type="image/x-icon" href="/sm-dashboard-client/favicon.ico">',
    },
    prana: {
        title: 'prana AIIoT — Gestão de Condomínios',
        favicons: '<link rel="icon" type="image/svg+xml" href="/sm-dashboard-client/prana-favicon.svg">',
    },
}

function brandHtml(brand: string): Plugin {
    const b = BRAND_HTML[brand] ?? BRAND_HTML.simemap
    return {
        name: 'brand-html',
        transformIndexHtml: html => html
            .replace('<!--brand-favicons-->', b.favicons)
            .replace(/<title>.*<\/title>/, `<title>${b.title}</title>`),
    }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const brand = loadEnv(mode, process.cwd(), 'VITE_').VITE_BRAND || 'simemap'
  return {
    base: '/sm-dashboard-client/',
    plugins: [
        brandHtml(brand),
        vue(),
        vueDevTools(),
        Components({
            resolvers: [BootstrapVueNextResolver()],
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        },
    },
    define: {
        global: 'globalThis',
    },
    css: {
        preprocessorOptions: {
            // brand switch for SCSS ($primary/$secondary in _variables.scss)
            scss: { additionalData: `$brand: '${brand}';\n` },
        },
    },
    optimizeDeps: {
        include: [
            '@aws-sdk/client-timestream-query',
            '@aws-sdk/client-s3',
            '@aws-sdk/client-cognito-identity-provider',
            '@aws-sdk/credential-provider-cognito-identity',
            '@aws-sdk/client-cognito-identity',
            'amazon-cognito-identity-js',
        ],
    },
  }
})
