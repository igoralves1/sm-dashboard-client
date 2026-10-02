<template>
  <MainLayout>
    <BContainer fluid class="hidroforte">
      <!-- Breadcrumb -->
      <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <RouterLink to="/dashboard" class="crumb-home">
          <Icon icon="tabler:home" width="15" height="15" />
          <span>{{ t('energisa.breadcrumb_home') }}</span>
        </RouterLink>
        <span class="text-muted">/</span>
        <span class="text-muted">{{ t('nav.dashboards') }}</span>
        <span class="text-muted">/</span>
        <span class="fw-semibold">{{ t('hidroforte.title') }}</span>
        <span class="text-muted">/</span>
        <span class="text-muted">{{ site.name }}</span>
      </div>

      <!-- Site tabs + refresh status -->
      <div class="d-flex align-items-end justify-content-between flex-wrap gap-2 mb-3">
        <ul class="nav nav-tabs site-tabs">
          <li v-for="s in sites" :key="s.id" class="nav-item">
            <button class="nav-link" :class="{ active: s.id === site.id }" @click="selectSite(s.id)">
              {{ s.name }}
            </button>
          </li>
        </ul>
        <div class="d-flex align-items-center gap-3 refresh-status">
          <span v-if="lastUpdated" class="text-muted">
            <span class="status-dot" :class="error ? 'is-stale' : 'is-online'"></span>
            {{ t('hidroforte.updated_at', { time: lastUpdated }) }}
            · {{ t('hidroforte.next_refresh', { time: countdown }) }}
          </span>
          <button type="button" class="btn btn-sm btn-outline-secondary refresh-btn" :disabled="loading" @click="doRefresh">
            <Icon icon="tabler:refresh" width="14" height="14" :class="{ spin: loading }" />
            {{ t('hidroforte.refresh') }}
          </button>
        </div>
      </div>

      <div v-if="rateLimited" class="alert alert-warning">{{ t('monitoring.rate_limit', { mins: rateLimitMins }) }}</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

      <!-- ── Leituras em tempo real ──────────────────────────────────── -->
      <h6 class="section-title mb-2">{{ t('hidroforte.realtime') }}</h6>
      <div class="row g-2 mb-4">
        <div class="col-12 col-xxl-8">
          <div class="row g-2">
            <!-- Tank levels -->
            <div v-for="tank in site.tanks" :key="`kpi-${tank.key}`" class="col-6 col-lg-3">
              <div class="card h-100"><div class="card-body kpi-body">
                <div class="kpi-label"><span class="dot" :style="{ background: levelColor(tank.data.level) }"></span>{{ tank.short }}</div>
                <div class="kpi-value">{{ tank.data.levelSeries.length ? `${tank.data.level.toFixed(1)} %` : '—' }}</div>
                <div class="kpi-sub text-muted">{{ t('hidroforte.tank_level') }}</div>
              </div></div>
            </div>
            <!-- Latest flow per meter -->
            <div v-for="m in latestFlows" :key="`flow-${m.name}`" class="col-6 col-lg-3">
              <div class="card h-100"><div class="card-body kpi-body">
                <div class="kpi-label"><span class="dot" :style="{ background: m.color }"></span>{{ t('hidroforte.flow_of', { name: m.label }) }}</div>
                <div class="kpi-value">{{ m.point ? m.point.value.toFixed(1) : '—' }}<span class="kpi-unit">m³/h</span></div>
                <div class="kpi-sub text-muted">
                  <span class="status-dot" :class="m.fresh ? 'is-online' : 'is-stale'"></span>
                  <template v-if="m.point">
                    {{ m.fresh ? t('monitoring.last_reading') : t('monitoring.no_recent_data') }}
                    · {{ m.point.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                  </template>
                  <template v-else>{{ t('monitoring.no_recent_data') }}</template>
                </div>
              </div></div>
            </div>
            <!-- Production, last 24 h -->
            <div class="col-6 col-lg-3">
              <div class="card h-100"><div class="card-body kpi-body">
                <div class="kpi-label"><span class="dot bg-secondary"></span>{{ t('hidroforte.production_24h_total') }}</div>
                <div class="kpi-value">{{ production24hTotal !== null ? production24hTotal.toFixed(0) : '—' }}<span class="kpi-unit">m³</span></div>
                <div class="kpi-sub text-muted">{{ t('hidroforte.all_meters') }}</div>
              </div></div>
            </div>
          </div>
        </div>

        <!-- Location -->
        <div class="col-12 col-xxl-4">
          <div class="card h-100">
            <div class="card-body kpi-body d-flex flex-column">
              <div class="kpi-label"><span class="dot bg-info"></span>{{ t('hidroforte.location') }}</div>
              <div class="media-frame">
                <SiteMap :key="site.id" :markers="site.markers" style="height:100%;min-height:220px;border-radius:6px;overflow:hidden" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Análise de condição (índice de saúde) ──────────────────── -->
      <div class="mb-4">
        <WaterHealthPanel :diagnostics="diagnostics" :site="site.name" />
      </div>

      <!-- ── Níveis dos reservatórios ───────────────────────────────── -->
      <h6 class="section-title mb-2">{{ t('hidroforte.tank_levels') }}</h6>
      <div v-for="tank in site.tanks" :key="`tank-${tank.key}`" class="card mb-3">
        <div class="card-body">
          <div class="row g-3 align-items-start">
            <div class="col-12 col-lg-3 d-flex justify-content-center">
              <TankGauge :value="tank.data.level" :size="190" :title="tank.title" :theme="chartTheme" />
            </div>
            <div class="col-12 col-lg-9">
              <LevelTimeSeries :data="tank.data.levelSeries" :thresholds="LEVEL_THRESHOLDS" :title="tank.title" :theme="chartTheme" />
              <SpcPanel
                :series="[{ name: tank.short, values: tank.data.levelSeries, stats: tank.data.levelStats }]"
                unit="%"
                :label="t('spc.distribution_24h')"
                :theme="chartTheme"
              />
            </div>
          </div>
          <WaterNotes :indicators="indicatorsFor(['reserve', 'trend', 'turnover'], tank.short)" context="level" />
        </div>
      </div>

      <!-- ── Vazão ──────────────────────────────────────────────────── -->
      <h6 class="section-title mb-2 mt-4">{{ t('hidroforte.flow') }}</h6>
      <div class="card mb-3">
        <div class="card-body">
          <FlowTimeSeries
            :data="site.flow.flow"
            :title="site.flowTitle"
            :colors="site.flowColors"
            :thresholds="site.flowThresholds"
            :theme="chartTheme"
          />
          <SpcPanel :series="flowSpc(site.flow)" unit=" m³/h" :label="t('spc.distribution_24h')" :theme="chartTheme" />
          <WaterNotes :indicators="indicatorsFor(['stability', 'telemetry'])" context="flow" :extra-kinds="['anomalies']" />
        </div>
      </div>

      <!-- ── Produção ───────────────────────────────────────────────── -->
      <h6 class="section-title mb-2 mt-4">{{ t('hidroforte.production') }}</h6>
      <div class="card mb-3">
        <div class="card-body">
          <ul class="nav nav-tabs mb-3">
            <li v-for="p in PRODUCTION_TABS" :key="p" class="nav-item">
              <button class="nav-link" :class="{ active: productionTab === p }" @click="productionTab = p">
                {{ t(p === 'hourly' ? 'hidroforte.tab_24h' : 'hidroforte.tab_daily') }}
              </button>
            </li>
          </ul>
          <ProductionBar
            :key="`${site.id}-${productionTab}`"
            :data="productionRows"
            :x-field="productionTab === 'hourly' ? 'hour' : 'day'"
            :title="productionTab === 'hourly' ? site.production24hTitle : site.productionDailyTitle"
            :colors="site.productionColors"
            :theme="chartTheme"
          />
          <SpcPanel
            :key="`spc-${site.id}-${productionTab}`"
            :series="productionSpc(productionRows, productionStats)"
            unit=" m³"
            :label="t(productionTab === 'hourly' ? 'spc.production_24h' : 'spc.production_daily')"
            :theme="chartTheme"
          />
          <WaterNotes :indicators="indicatorsFor(['continuity', 'anomalies'])" context="production" />
        </div>
      </div>
    </BContainer>
  </MainLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import MainLayout from '@/layouts/MainLayout.vue'
import TankGauge from '@/components/charts/TankGauge.vue'
import LevelTimeSeries from '@/components/charts/LevelTimeSeries.vue'
import FlowTimeSeries from '@/components/charts/FlowTimeSeries.vue'
import ProductionBar from '@/components/charts/ProductionBar.vue'
import SpcPanel from '@/components/charts/SpcPanel.vue'
import SiteMap from '@/components/charts/SiteMap.vue'
import WaterHealthPanel from '@/components/charts/WaterHealthPanel.vue'
import WaterNotes from '@/components/charts/WaterNotes.vue'
import { analyseWaterSite, type WaterKind } from '@/utils/water/diagnostics'
import { useTimestreamDashboard, type SiteData, type TankData } from '@/composables/useTimestreamDashboard'
import { useLayout } from '@/stores/layout'
import { useSystemTheme } from '@/composables/useSystemTheme'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  LEVEL_THRESHOLDS, FLOW_THRESHOLDS_MIR, FLOW_THRESHOLDS_PALTA,
  FLOW_COLORS_MIR, PROD_COLORS_MIR, COLORS_PALTA,
  MARKERS_SIL, MARKERS_MIR, MARKERS_PALTA,
  flowSpc, productionSpc, latestPoint, levelColor,
} from '@/helpers/hidroforte'

usePageMeta('Hidroforte')

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const {
  silvanopolis, miranorte, miranorte200, miranorteSite, ponteAlta, ponteAltaSite,
  loading, error, rateLimited, rateLimitMins, lastUpdated, refresh,
} = useTimestreamDashboard()

// ── Charts follow the app theme (light / dark / system) ──
const { layout } = useLayout()
const systemTheme = useSystemTheme()
const chartTheme = computed<'dark' | 'light'>(() => {
  const theme = layout.theme === 'system' ? systemTheme.value : layout.theme
  return theme === 'dark' ? 'dark' : 'light'
})

// ── Sites ──
type SiteId = 'silvanopolis' | 'miranorte' | 'ponte-alta'

interface SiteView {
  id: SiteId
  name: string
  tanks: { key: string; short: string; title: string; data: TankData }[]
  flow: Pick<SiteData, 'flow' | 'flowStats'>
  flowTitle: string
  flowColors?: Record<string, string>
  flowThresholds?: { value: number; color: string }[]
  production24h: Record<string, any>[]
  production24hStats: SiteData['production24hStats']
  productionDaily: Record<string, any>[]
  productionDailyStats: SiteData['productionDailyStats']
  production24hTitle: string
  productionDailyTitle: string
  productionColors?: Record<string, string>
  markers: { lat: number; lng: number; label: string; color?: string }[]
}

const sites = computed<SiteView[]>(() => [
  {
    id: 'silvanopolis',
    name: 'Silvanópolis',
    tanks: [{ key: 'sil', short: 'RAP01', title: t('monitoring.level_title_sil'), data: silvanopolis.value }],
    flow: { flow: silvanopolis.value.flowSeries, flowStats: silvanopolis.value.flowStats },
    flowTitle: t('monitoring.flow_title'),
    production24h: silvanopolis.value.production24h,
    production24hStats: silvanopolis.value.production24hStats,
    productionDaily: silvanopolis.value.productionDaily,
    productionDailyStats: silvanopolis.value.productionDailyStats,
    production24hTitle: t('monitoring.production_24h_sil'),
    productionDailyTitle: t('monitoring.production_daily_sil'),
    markers: MARKERS_SIL,
  },
  {
    id: 'miranorte',
    name: 'Miranorte',
    tanks: [
      { key: 'mir500', short: 'RAP 500m³', title: t('monitoring.level_title_mir'), data: miranorte.value },
      { key: 'mir200', short: 'RAP 200m³', title: t('monitoring.level_title_mir200'), data: miranorte200.value },
    ],
    flow: miranorteSite.value,
    flowTitle: t('monitoring.flow_title_mir'),
    flowColors: FLOW_COLORS_MIR,
    flowThresholds: FLOW_THRESHOLDS_MIR,
    ...siteProduction(miranorteSite.value),
    production24hTitle: t('monitoring.production_24h_mir'),
    productionDailyTitle: t('monitoring.production_daily_mir'),
    productionColors: PROD_COLORS_MIR,
    markers: MARKERS_MIR,
  },
  {
    id: 'ponte-alta',
    name: 'Ponte Alta',
    tanks: [{ key: 'palta', short: 'RAP 150m³', title: t('monitoring.level_title_palta'), data: ponteAlta.value }],
    flow: ponteAltaSite.value,
    flowTitle: t('monitoring.flow_title_palta'),
    flowColors: COLORS_PALTA,
    flowThresholds: FLOW_THRESHOLDS_PALTA,
    ...siteProduction(ponteAltaSite.value),
    production24hTitle: t('monitoring.production_24h_palta'),
    productionDailyTitle: t('monitoring.production_daily_palta'),
    productionColors: COLORS_PALTA,
    markers: MARKERS_PALTA,
  },
])

function siteProduction(s: SiteData) {
  return {
    production24h: s.production24h,
    production24hStats: s.production24hStats,
    productionDaily: s.productionDaily,
    productionDailyStats: s.productionDailyStats,
  }
}

// Selected site lives in the URL (?site=…) so it can be linked and survives reloads
const site = computed(() => sites.value.find(s => s.id === route.query.site) ?? sites.value[0])
function selectSite(id: SiteId) {
  router.replace({ query: { ...route.query, site: id } })
}

// ── Real-time tiles ──
const FLOW_DEFAULT_COLORS: Record<string, string> = {
  PTP_01: '#fade2a', PTP_02: '#ff9830', PTP_03: '#5794f2', PTP_04: '#73bf69', PTP_07: '#f2495c',
}
const latestFlows = computed(() =>
  site.value.flow.flow.map(f => ({
    name: f.name,
    label: f.name === 'Captacao' ? t('monitoring.stat_captacao_eta') : f.name,
    color: site.value.flowColors?.[f.name] ?? FLOW_DEFAULT_COLORS[f.name] ?? '#aaa',
    ...latestPoint(f.values),
  }))
)

const production24hTotal = computed<number | null>(() => {
  const rows = site.value.production24h
  if (!rows.length) return null
  const keys = Object.keys(site.value.production24hStats)
  return rows.reduce((sum, r) => sum + keys.reduce((s, k) => s + (Number(r[k]) || 0), 0), 0)
})

// ── Condition analysis (health index) — same approach as the Energisa device page ──
// `now` ticks once a minute so telemetry age stays current between data refreshes.
const now = ref(Date.now())
const diagnostics = computed(() =>
  analyseWaterSite({
    tanks: site.value.tanks.map(tk => ({ name: tk.short, series: tk.data.levelSeries })),
    flows: site.value.flow.flow,
    production24h: site.value.production24h,
    productionKeys: Object.keys(site.value.production24hStats),
    now: now.value,
  }, site.value.name)
)
function indicatorsFor(kinds: WaterKind[], subject?: string) {
  return diagnostics.value.indicators.filter(i => kinds.includes(i.kind) && (!subject || i.subject === subject))
}

// ── Production tabs ──
const PRODUCTION_TABS = ['hourly', 'daily'] as const
const productionTab = ref<(typeof PRODUCTION_TABS)[number]>('hourly')
const productionRows = computed(() =>
  productionTab.value === 'hourly' ? site.value.production24h : site.value.productionDaily
)
const productionStats = computed(() =>
  productionTab.value === 'hourly' ? site.value.production24hStats : site.value.productionDailyStats
)

// ── Auto-refresh (same cadence as /dashboard-sm) ──
const REFRESH_SECS = 300
const secondsLeft = ref(REFRESH_SECS)
const countdown = computed(() =>
  `${Math.floor(secondsLeft.value / 60)}:${String(secondsLeft.value % 60).padStart(2, '0')}`
)

let refreshTimer: ReturnType<typeof setInterval>
let tickTimer: ReturnType<typeof setInterval>

async function doRefresh() {
  secondsLeft.value = REFRESH_SECS
  await refresh()
  now.value = Date.now()
}

onMounted(async () => {
  await doRefresh()
  refreshTimer = setInterval(doRefresh, REFRESH_SECS * 1000)
  tickTimer = setInterval(() => {
    if (secondsLeft.value > 0) secondsLeft.value--
    if (secondsLeft.value % 60 === 0) now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(tickTimer)
})
</script>

<style scoped>
/* Same page language as the Energisa device page (/dashboard-energisa/:id) */
.hidroforte {
  padding-top: 1rem;
  padding-bottom: 2rem;
}

.crumb-home {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--bs-secondary-color);
  text-decoration: none;
}
.crumb-home:hover { color: var(--bs-primary); }

.section-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.kpi-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--bs-secondary-color);
  margin-bottom: 4px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
  flex: none;
}
.bg-info { background: var(--bs-info, #0dcaf0); }
.bg-secondary { background: var(--bs-secondary-color); }

.kpi-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.kpi-unit {
  margin-left: 0.3rem;
  font-size: 13px;
  font-weight: 500;
  color: var(--bs-secondary-color);
}
.kpi-sub {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 2px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.media-frame {
  flex: 1 1 auto;
  min-height: 220px;
}

/* Status dot (DESIGN-SYSTEM: online green #4ade80, warning #f58b06) */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex: none;
  vertical-align: middle;
}
.status-dot.is-online {
  background: #4ade80;
  animation: statusPulse 2s infinite;
}
.status-dot.is-stale { background: #f58b06; }
@keyframes statusPulse {
  0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
  100% { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
}

.refresh-status { font-size: 12.5px; }
.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 999px;
  font-size: 12.5px;
  padding: 0.3rem 0.85rem;
}
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Tabs: flat underline, as on the Energisa page */
.nav-tabs {
  border-bottom: 1px solid var(--bs-border-color);
  gap: 0.25rem;
}
.nav-tabs .nav-link {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--bs-secondary-color);
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 0.5rem 0.85rem;
  background: none;
}
.nav-tabs .nav-link:hover { color: var(--bs-body-color); }
.nav-tabs .nav-link.active {
  color: var(--bs-primary);
  border-bottom-color: var(--bs-primary);
  background: none;
}
.site-tabs .nav-link { font-size: 14px; font-weight: 600; }
</style>
