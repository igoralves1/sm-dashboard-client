<template>
  <div class="dashboard-sm" :class="isDark ? 'theme-dark' : 'theme-light'">

    <!-- ═══ TOP HEADER BAR ═══ -->
    <div class="top-bar">
      <div class="top-bar__left">
        <img src="@/assets/images/simemap-logo-white.svg" alt="SIMEMAP" class="top-bar__logo" />
        <div class="top-bar__divider"></div>
        <div class="top-bar__meta">
          <span class="top-bar__meta-label">{{ t('monitoring.iot_realtime') }}</span>
          <span class="top-bar__meta-status">
            <span v-if="loading" class="status-dot loading"></span>
            <span v-else-if="error" class="status-dot error"></span>
            <span v-else class="status-dot ok"></span>
            <span v-if="loading" class="status-text">{{ t('monitoring.loading') }}</span>
            <span v-else-if="error" class="status-text text-danger">{{ error }}</span>
            <span v-else class="status-text">{{ t('monitoring.updated_at') }} {{ lastUpdated }} · {{ getSnapshotCount() }} {{ t('monitoring.snapshots') }}</span>
          </span>
        </div>
      </div>
      <div class="top-bar__right">
        <button class="theme-toggle" @click="isDark = !isDark" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
          <span v-if="isDark">☀️</span>
          <span v-else>🌙</span>
        </button>
        <button class="export-btn" @click="router.push('/dashboard')" :title="t('monitoring.back')">
          {{ t('monitoring.back') }}
        </button>
        <RefreshCountdown :duration-seconds="300" :seconds-left="secondsLeft" :size="44" />
        <button class="export-btn" @click="exportLog()" :title="`${t('monitoring.export')} · ${getSnapshotCount()} ${t('monitoring.snapshots')}`">
          <span class="export-icon">↓</span> {{ t('monitoring.export') }}
        </button>
      </div>
    </div>

    <!-- Rate limit alert -->
    <div v-if="rateLimited" class="rate-limit-alert">
      <span class="rate-limit-icon">⚠</span>
      <span class="rate-limit-text">
        {{ t('monitoring.rate_limit', { mins: rateLimitMins }) }}
      </span>
    </div>

    <!-- ═══ CONTEXT BANNER ═══ -->
    <div class="context-banner">
      <button class="context-banner__toggle" @click="bannerOpen = !bannerOpen">
        <span class="context-banner__dot"></span>
        {{ t('monitoring.system_active') }} &nbsp;·&nbsp; {{ t('monitoring.title') }}
        <span class="context-banner__chevron" :class="{ 'context-banner__chevron--open': bannerOpen }">▾</span>
      </button>
      <div class="context-banner__grid" v-show="bannerOpen">

        <div class="context-banner__lead">
          <h2 class="context-banner__title">{{ t('monitoring.title') }}</h2>
          <p class="context-banner__desc">{{ t('monitoring.subtitle') }}</p>
        </div>

        <div class="context-banner__cards">
          <div class="context-banner__card">
            <div class="context-banner__card-icon">🏙️</div>
            <div class="context-banner__card-title">{{ t('monitoring.smart_city_title') }}</div>
            <div class="context-banner__card-text">{{ t('monitoring.smart_city_text') }}</div>
          </div>
          <div class="context-banner__card">
            <div class="context-banner__card-icon">📊</div>
            <div class="context-banner__card-title">{{ t('monitoring.data_decision_title') }}</div>
            <div class="context-banner__card-text">{{ t('monitoring.data_decision_text') }}</div>
          </div>
          <div class="context-banner__card">
            <div class="context-banner__card-icon">⚡</div>
            <div class="context-banner__card-title">{{ t('monitoring.incident_title') }}</div>
            <div class="context-banner__card-text">{{ t('monitoring.incident_text') }}</div>
          </div>
          <div class="context-banner__card">
            <div class="context-banner__card-icon">🌱</div>
            <div class="context-banner__card-title">{{ t('monitoring.sustainability_title') }}</div>
            <div class="context-banner__card-text">{{ t('monitoring.sustainability_text') }}</div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══ SILVANÓPOLIS ═══ -->
    <div class="section-header">
      <span class="section-header__icon">◈</span>
      <span class="section-header__title">Silvanópolis</span>
      <div class="section-header__line"></div>
    </div>

    <div class="row g-3 mb-4">
      <!-- Tank -->
      <div class="col-lg-3 col-md-4">
        <div class="chart-card chart-card--center py-3">
          <TankGauge
            :value="silvanopolis.level"
            :size="200"
            :title="t('monitoring.tank_title_sil')"
          />
        </div>
      </div>
      <!-- Level time series -->
      <div class="col-lg-6 col-md-4">
        <div class="chart-card">
          <LevelTimeSeries
            :data="silvanopolis.levelSeries"
            :thresholds="levelThresholds"
            :title="t('monitoring.level_title_sil')"
          />
          <!-- SPC panel -->
          <div class="spc-panel">
            <button class="spc-toggle" @click="statsOpenSilLevel = !statsOpenSilLevel">
              <span class="spc-toggle__icon">▶ {{ t('spc.model_used') }}</span>
              <span class="spc-chevron" :class="{ open: statsOpenSilLevel }">▾</span>
            </button>
            <div v-show="statsOpenSilLevel" class="spc-body">
              <ControlChart
                :data="silvanopolis.levelSeries"
                :stats="silvanopolis.levelStats"
                unit="%"
                title="Control Chart — Water Level · Silvanópolis"
                :height="180"
                :y-domain="[0, 110]"
              />
              <BoxPlot
                :stats="silvanopolis.levelStats"
                unit="%"
                :label="`${t('spc.box_plot')} · ${t('spc.water_level')} ${t('spc.distribution_24h')}`"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- Map -->
      <div class="col-lg-3 col-md-4">
        <div class="chart-card chart-card--map" style="min-height:260px">
          <div class="chart-title">
            <span class="chart-title__dot" style="background:#4da6ff"></span>
            {{ t('monitoring.site_location') }}
          </div>
          <SiteMap :markers="siteMarkers" style="height:calc(100% - 30px);border-radius:6px;overflow:hidden" />
        </div>
      </div>
      <!-- Flow PTPs -->
      <div class="col-12">
        <div class="chart-card">
          <FlowTimeSeries :data="silvanopolis.flowSeries" />
          <!-- SPC panel -->
          <div class="spc-panel">
            <button class="spc-toggle" @click="statsOpenSilFlow = !statsOpenSilFlow">
              <span class="spc-toggle__icon">▶ {{ t('spc.model_used') }}</span>
              <span class="spc-chevron" :class="{ open: statsOpenSilFlow }">▾</span>
            </button>
            <div v-show="statsOpenSilFlow" class="spc-body">
              <div class="spc-flow-grid">
                <template v-for="s in silvanopolis.flowSeries" :key="s.name">
                  <div class="spc-flow-col">
                    <ControlChart
                      :data="s.values"
                      :stats="silvanopolis.flowStats[s.name] ?? null"
                      unit=" m³/h"
                      :title="`Control Chart — ${s.name}`"
                      :height="160"
                    />
                    <BoxPlot
                      :stats="silvanopolis.flowStats[s.name] ?? null"
                      unit=" m³/h"
                      :label="`${s.name} ${t('spc.distribution_24h')}`"
                    />
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Bar charts -->
      <div class="col-lg-6">
        <div class="chart-card">
          <ProductionBar
            :data="silvanopolis.production24h"
            x-field="hour"
            :title="t('monitoring.production_24h_sil')"
          />
          <div class="spc-panel">
            <button class="spc-toggle" @click="statsOpenSilProd24h = !statsOpenSilProd24h">
              <span class="spc-toggle__icon">▶ {{ t('spc.model_used') }}</span>
              <span class="spc-chevron" :class="{ open: statsOpenSilProd24h }">▾</span>
            </button>
            <div v-show="statsOpenSilProd24h" class="spc-body">
              <div class="spc-flow-grid">
                <template v-for="(st, ptp) in silvanopolis.production24hStats" :key="ptp">
                  <div class="spc-flow-col">
                    <BoxPlot
                      :stats="st"
                      unit=" m³/h"
                      :label="`${ptp} · ${t('spc.production_24h')}`"
                    />
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="chart-card">
          <ProductionBar
            :data="silvanopolis.productionDaily"
            x-field="day"
            :title="t('monitoring.production_daily_sil')"
          />
          <div class="spc-panel">
            <button class="spc-toggle" @click="statsOpenSilProdDay = !statsOpenSilProdDay">
              <span class="spc-toggle__icon">▶ {{ t('spc.model_used') }}</span>
              <span class="spc-chevron" :class="{ open: statsOpenSilProdDay }">▾</span>
            </button>
            <div v-show="statsOpenSilProdDay" class="spc-body">
              <div class="spc-flow-grid">
                <template v-for="(st, ptp) in silvanopolis.productionDailyStats" :key="ptp">
                  <div class="spc-flow-col">
                    <BoxPlot
                      :stats="st"
                      unit=" m³"
                      :label="`${ptp} · ${t('spc.production_daily')}`"
                    />
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ MIRANORTE ═══ -->
    <div class="section-header">
      <span class="section-header__icon">◈</span>
      <span class="section-header__title">Miranorte</span>
      <div class="section-header__line"></div>
    </div>

    <div class="row g-3 mb-4">
      <!-- Tank -->
      <div class="col-lg-3 col-md-4">
        <div class="chart-card chart-card--center py-3">
          <TankGauge
            :value="miranorte.level"
            :size="200"
            :title="t('monitoring.tank_title_mir')"
          />
        </div>
      </div>
      <!-- Level time series -->
      <div class="col-lg-9 col-md-8">
        <div class="chart-card">
          <LevelTimeSeries
            :data="miranorte.levelSeries"
            :thresholds="levelThresholds"
            :title="t('monitoring.level_title_mir')"
          />
          <!-- SPC panel -->
          <div class="spc-panel">
            <button class="spc-toggle" @click="statsOpenMirLevel = !statsOpenMirLevel">
              <span class="spc-toggle__icon">▶ {{ t('spc.model_used') }}</span>
              <span class="spc-chevron" :class="{ open: statsOpenMirLevel }">▾</span>
            </button>
            <div v-show="statsOpenMirLevel" class="spc-body">
              <ControlChart
                :data="miranorte.levelSeries"
                :stats="miranorte.levelStats"
                unit="%"
                title="Control Chart — Water Level · Miranorte"
                :height="180"
                :y-domain="[0, 110]"
              />
              <BoxPlot
                :stats="miranorte.levelStats"
                unit="%"
                :label="`${t('spc.box_plot')} · ${t('spc.water_level')} ${t('spc.distribution_24h')}`"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dashboard-footer">
      <span>{{ t('monitoring.footer_text') }}</span>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import TankGauge from '@/components/charts/TankGauge.vue'
import LevelTimeSeries from '@/components/charts/LevelTimeSeries.vue'
import FlowTimeSeries from '@/components/charts/FlowTimeSeries.vue'
import ProductionBar from '@/components/charts/ProductionBar.vue'
import RefreshCountdown from '@/components/charts/RefreshCountdown.vue'
import ControlChart from '@/components/charts/ControlChart.vue'
import BoxPlot from '@/components/charts/BoxPlot.vue'
import { useTimestreamDashboard } from '@/composables/useTimestreamDashboard'
import { exportLog, getSnapshotCount } from '@/composables/useDashboardLogger'
import { useAlertStore } from '@/composables/useAlertStore'
import SiteMap from '@/components/charts/SiteMap.vue'

const router = useRouter()
const { t }  = useI18n()
const { initFromS3, startPolling, stopPolling } = useAlertStore()

const siteMarkers = [
  { lat: -11.15430944152578, lng: -48.172973779141344, label: 'RAP01 Silvanópolis', color: '#4da6ff' },
]

const { silvanopolis, miranorte, loading, error, rateLimited, rateLimitMins, lastUpdated, refresh } = useTimestreamDashboard()

// ── Threshold lines (matching Grafana) ──
const levelThresholds = [
  { value: 25,  color: '#e84040', dash: '6,3' },
  { value: 50,  color: '#f4954e', dash: '6,3' },
  { value: 75,  color: '#f4954e', dash: '6,3' },
  { value: 100, color: '#73bf69', dash: '6,3' },
]

const isDark = ref(true)

const bannerOpen  = ref(false)   // collapsed by default
const statsOpenSilLevel   = ref(false)
const statsOpenSilFlow    = ref(false)
const statsOpenSilProd24h = ref(false)
const statsOpenSilProdDay = ref(false)
const statsOpenMirLevel   = ref(false)

// ── Auto-refresh every 1 min with countdown ──
const REFRESH_SECS = 300
const secondsLeft = ref(REFRESH_SECS)

let refreshTimer: ReturnType<typeof setInterval>
let tickTimer: ReturnType<typeof setInterval>

async function doRefresh() {
  secondsLeft.value = REFRESH_SECS
  await refresh()
}

onMounted(async () => {
  await initFromS3()
  startPolling()
  await doRefresh()
  refreshTimer = setInterval(doRefresh, REFRESH_SECS * 1000)
  tickTimer = setInterval(() => {
    if (secondsLeft.value > 0) secondsLeft.value--
  }, 1000)
})
onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(tickTimer)
  stopPolling()
})
</script>

<style scoped>
/* ── Context Banner ── */
.context-banner__toggle {
  width: 100%; display: flex; align-items: center; gap: 10px;
  background: none; border: none; cursor: pointer; padding: 0 0 4px;
  font-size: 12px; font-weight: 600; letter-spacing: .07em;
  text-transform: uppercase; color: #26b8a5;
  text-align: left;
}
.context-banner__toggle:hover { color: #4dd0be; }
.context-banner__chevron {
  margin-left: auto; font-size: 16px; transition: transform .25s;
  display: inline-block;
}
.context-banner__chevron--open { transform: rotate(180deg); }

.context-banner {
  margin: 0 1.75rem 8px;
  padding: 28px 32px;
  background: linear-gradient(135deg, #111620 0%, #0e1520 100%);
  border: 1px solid #2a3d52;
  border-radius: 12px;
}
.context-banner__grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 32px;
  align-items: start;
  margin-top: 20px;
}
@media (max-width: 900px) {
  .context-banner__grid { grid-template-columns: 1fr; }
}
.context-banner__eyebrow {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: #26b8a5; margin-bottom: 12px;
}
.context-banner__dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #26b8a5;
  box-shadow: 0 0 6px #26b8a5;
  animation: dotPulse 2s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes dotPulse {
  0%,100% { opacity: 1; } 50% { opacity: .4; }
}
.context-banner__title {
  font-size: 22px; font-weight: 700; color: #e8eaf0;
  margin: 0 0 14px; line-height: 1.25;
}
.context-banner__desc {
  font-size: 13.5px; line-height: 1.7; color: #8a93a8; margin: 0;
}
.context-banner__desc strong { color: #c8d0e0; }

.context-banner__cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 600px) {
  .context-banner__cards { grid-template-columns: 1fr; }
}
.context-banner__card {
  background: #141922;
  border: 1px solid #2a3d52;
  border-radius: 10px;
  padding: 16px 18px;
  transition: border-color .2s, transform .2s;
}
.context-banner__card:hover {
  border-color: #2a3f5f;
  transform: translateY(-2px);
}
.context-banner__card-icon {
  font-size: 22px; margin-bottom: 8px; line-height: 1;
}
.context-banner__card-title {
  font-size: 12.5px; font-weight: 700; color: #c8d4e8;
  margin-bottom: 6px; letter-spacing: .02em;
}
.context-banner__card-text {
  font-size: 12px; line-height: 1.65; color: #6a7590;
}

/* ── Base ── */
.dashboard-sm {
  padding: 0;
  background: #0e1015;
  min-height: 100vh;
  color: #d0d0d0;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

/* ── Top Bar ── */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.75rem;
  background: linear-gradient(160deg, #009ee0 0%, #303287 55%, #232566 100%);
  border-bottom: none;
  box-shadow: 0 2px 16px rgba(0,0,0,0.35);
  margin-bottom: 20px;
  position: sticky;
  top: 0;
  z-index: 100;
}
.top-bar__left {
  display: flex;
  align-items: center;
  gap: 1.1rem;
}
.top-bar__logo {
  height: 36px;
  width: auto;
  filter: drop-shadow(0 1px 4px rgba(0,0,0,0.3));
}
.top-bar__divider {
  width: 1px;
  height: 32px;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.4), transparent);
}
.top-bar__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.top-bar__meta-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(255,255,255,0.9);
}
.top-bar__meta-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.ok      { background: #73bf69; box-shadow: 0 0 5px #73bf69; }
.status-dot.error   { background: #e84040; box-shadow: 0 0 5px #e84040; }
.status-dot.loading { background: rgba(255,255,255,0.7); animation: rl-blink 1s ease-in-out infinite; }
.status-text {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.75);
}
.top-bar__right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* ── Export button ── */
.export-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.3);
  color: #ffffff;
  padding: 0.35rem 0.9rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  letter-spacing: 0.3px;
}
.export-btn:hover {
  background: rgba(255,255,255,0.22);
  border-color: rgba(255,255,255,0.5);
  color: #ffffff;
}
.export-icon { font-size: 0.9rem; }

/* ── Content area ── */
.dashboard-content {
  padding: 1.5rem 1.75rem;
}

/* ── Section header ── */
.section-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 1.75rem 1.75rem 0.9rem;
}
.section-header__icon {
  font-size: 0.9rem;
  color: #102a83;
  line-height: 1;
}
.section-header__title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.8px;
  color: #c8ccd8;
  white-space: nowrap;
}
.section-header__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, #2a2e3e, transparent);
}

/* ── Row wrapper ── */
.row {
  padding: 0 1.75rem;
}

/* ── Chart cards ── */
.chart-card {
  background: #13161c;
  border: 1px solid #2a3040;
  border-radius: 10px;
  padding: 1.1rem;
  height: 100%;
  transition: border-color 0.2s;
}
.chart-card:hover {
  border-color: #2a3050;
}
.chart-card--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}
.chart-card--map {
  display: flex;
  flex-direction: column;
}

/* ── Chart title ── */
.chart-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: #9aa0b8;
  margin-bottom: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.3px;
}
.chart-title__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Rate limit alert ── */
.rate-limit-alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(232, 64, 64, 0.08);
  border: 1px solid rgba(232, 64, 64, 0.35);
  border-radius: 8px;
  padding: 0.7rem 1.75rem;
  margin: 0.75rem 1.75rem;
}
.rate-limit-icon {
  font-size: 1.1rem;
  color: #e84040;
  animation: rl-blink 1s ease-in-out infinite;
  flex-shrink: 0;
}
.rate-limit-text {
  font-size: 0.83rem;
  font-weight: 600;
  color: #e84040;
  letter-spacing: 0.2px;
}

/* ── Footer ── */
.dashboard-footer {
  margin: 2rem 1.75rem 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #1a1d26;
  font-size: 0.7rem;
  color: #3a3f55;
  text-align: center;
  letter-spacing: 1px;
  text-transform: uppercase;
}

@keyframes rl-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.15; }
}

/* ── SPC / Statistical model panel ── */
.spc-panel {
  margin-top: 10px;
  border-top: 1px solid #1a1d26;
  padding-top: 6px;
}

.spc-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 2px;
  width: 100%;
  text-align: left;
}

.spc-toggle__icon {
  font-size: 0.72rem;
  font-weight: 600;
  color: #3a4a6a;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.spc-toggle:hover .spc-toggle__icon { color: #5a7aaa; }

.spc-chevron {
  margin-left: auto;
  font-size: 14px;
  color: #3a4a6a;
  transition: transform 0.2s;
  display: inline-block;
}
.spc-chevron.open { transform: rotate(180deg); }

.spc-body {
  padding: 10px 4px 6px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spc-flow-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.spc-flow-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #0d1018;
  border: 1px solid #1a1d26;
  border-radius: 6px;
}

/* ── Theme toggle button ── */
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.18s, border-color 0.18s;
  flex-shrink: 0;
}
.theme-toggle:hover {
  background: rgba(255,255,255,0.22);
  border-color: rgba(255,255,255,0.5);
}

/* ══════════════════════════════════════════
   LIGHT THEME
   ══════════════════════════════════════════ */
.theme-light {
  background: #f0f4f9;
  color: #1a2035;
}

/* topbar stays the same gradient in both modes */

.theme-light .context-banner {
  background: #ffffff;
  border-color: #d0daea;
}
.theme-light .context-banner__toggle { color: #009ee0; }
.theme-light .context-banner__toggle:hover { color: #0082c0; }
.theme-light .context-banner__title { color: #102a83; }
.theme-light .context-banner__desc { color: #4a5572; }
.theme-light .context-banner__desc strong { color: #102a83; }
.theme-light .context-banner__card {
  background: #f5f8fc;
  border-color: #d0daea;
}
.theme-light .context-banner__card:hover { border-color: #009ee0; }
.theme-light .context-banner__card-title { color: #102a83; }
.theme-light .context-banner__card-text { color: #4a5572; }

.theme-light .section-header__icon { color: #009ee0; }
.theme-light .section-header__title { color: #102a83; }
.theme-light .section-header__line {
  background: linear-gradient(to right, #c0cce0, transparent);
}

.theme-light .chart-card {
  background: #ffffff;
  border-color: #d0daea;
  box-shadow: 0 1px 6px rgba(16,42,131,0.06);
}
.theme-light .chart-card:hover { border-color: #009ee0; }

.theme-light .chart-title { color: #4a5572; }

.theme-light .spc-panel { border-top-color: #d8e2ef; }
.theme-light .spc-toggle__icon { color: #7a8fb5; }
.theme-light .spc-toggle:hover .spc-toggle__icon { color: #009ee0; }
.theme-light .spc-chevron { color: #7a8fb5; }
.theme-light .spc-flow-col {
  background: #f5f8fc;
  border-color: #d0daea;
}

.theme-light .dashboard-footer {
  border-top-color: #d0daea;
  color: #9aadcc;
}

.theme-light .rate-limit-alert {
  background: rgba(232,64,64,0.05);
  border-color: rgba(232,64,64,0.25);
}
</style>
