import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { BootstrapVueNextResolver } from 'bootstrap-vue-next'

// https://vite.dev/config/
export default defineConfig({
    base: '/sm-dashboard-client/',
    plugins: [
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
})
