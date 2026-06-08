<template>
  <div class="dashboard-sm">

    <!-- ═══ TOP HEADER BAR ═══ -->
    <div class="top-bar">
      <div class="top-bar__left">
        <img src="@/assets/images/pranalogototal.svg" alt="prana" class="top-bar__logo" />
        <div class="top-bar__divider"></div>
        <div class="top-bar__meta">
          <span class="top-bar__meta-label">Monitoramento IoT em Tempo Real</span>
          <span class="top-bar__meta-status">
            <span v-if="loading" class="status-dot loading"></span>
            <span v-else-if="error" class="status-dot error"></span>
            <span v-else class="status-dot ok"></span>
            <span v-if="loading" class="status-text">Carregando...</span>
            <span v-else-if="error" class="status-text text-danger">{{ error }}</span>
            <span v-else class="status-text">Atualizado às {{ lastUpdated }} · {{ getSnapshotCount() }} snapshots</span>
          </span>
        </div>
      </div>
      <div class="top-bar__right">
        <button class="export-btn" @click="router.push('/dashboard')" title="Voltar ao início">
          ← Início
        </button>
        <RefreshCountdown :duration-seconds="300" :seconds-left="secondsLeft" :size="44" />
        <button class="export-btn" @click="exportLog()" :title="`Export ${getSnapshotCount()} snapshots`">
          <span class="export-icon">↓</span> Export JSON
        </button>
      </div>
    </div>

    <!-- Rate limit alert -->
    <div v-if="rateLimited" class="rate-limit-alert">
      <span class="rate-limit-icon">⚠</span>
      <span class="rate-limit-text">
        Limite de queries alcançado — aguarde {{ rateLimitMins }} min ou contacte o administrador.
      </span>
    </div>

    <!-- ═══ CONTEXT BANNER ═══ -->
    <div class="context-banner">
      <button class="context-banner__toggle" @click="bannerOpen = !bannerOpen">
        <span class="context-banner__dot"></span>
        Sistema Ativo · Estado do Tocantins &nbsp;·&nbsp; Monitoramento Hídrico em Tempo Real
        <span class="context-banner__chevron" :class="{ 'context-banner__chevron--open': bannerOpen }">▾</span>
      </button>
      <div class="context-banner__grid" v-show="bannerOpen">

        <div class="context-banner__lead">
          <h2 class="context-banner__title">
            Monitoramento Hídrico em Tempo Real
          </h2>
          <p class="context-banner__desc">
            Plataforma de supervisão contínua dos sistemas de abastecimento de água dos municípios de
            <strong>Silvanópolis</strong> e <strong>Miranorte</strong>, no Estado do Tocantins.
            Dados coletados por sensores IoT instalados nos reservatórios e nas estações de bombeamento
            são transmitidos e processados em tempo real, permitindo uma visão precisa e atualizada
            do estado operacional de toda a infraestrutura hídrica municipal.
          </p>
        </div>

        <div class="context-banner__cards">
          <div class="context-banner__card">
            <div class="context-banner__card-icon">🏙️</div>
            <div class="context-banner__card-title">Cidade Inteligente 4.0</div>
            <div class="context-banner__card-text">
              Integrado ao conceito de Smart City 4.0, este sistema conecta infraestrutura física
              a uma camada digital de inteligência — sensores, telemetria e análise em tempo real —
              para tornar a gestão pública mais eficiente, transparente e responsiva.
              Todos os processos são supervisionados de forma contínua e permanente por algoritmos
              de inteligência artificial que monitoram padrões operacionais, identificam desvios
              e anomalias automaticamente, e emitem alertas imediatos para os gestores ou técnicos
              designados — garantindo que cada ocorrência seja tratada pela pessoa certa,
              no momento certo, antes de se transformar em um problema crítico para a população.
            </div>
          </div>
          <div class="context-banner__card">
            <div class="context-banner__card-icon">📊</div>
            <div class="context-banner__card-title">Decisão Baseada em Dados</div>
            <div class="context-banner__card-text">
              Gestores municipais e equipes técnicas acompanham níveis de reservatório, vazão
              das bombas e produção diária sem depender de vistorias presenciais — reduzindo
              custos operacionais e tempo de resposta a falhas ou quedas de pressão.
            </div>
          </div>
          <div class="context-banner__card">
            <div class="context-banner__card-icon">⚡</div>
            <div class="context-banner__card-title">Resposta Imediata a Incidentes</div>
            <div class="context-banner__card-text">
              Anomalias nos padrões de consumo ou falhas em bombas são detectadas automaticamente.
              A equipe é alertada em tempo real, podendo agir antes que o desabastecimento
              afete a população — garantindo continuidade no serviço essencial de água tratada.
            </div>
          </div>
          <div class="context-banner__card">
            <div class="context-banner__card-icon">🌱</div>
            <div class="context-banner__card-title">Sustentabilidade e Eficiência</div>
            <div class="context-banner__card-text">
              O controle preciso do bombeamento reduz o consumo de energia elétrica e o desperdício
              hídrico. Com dados históricos e projeções de tendência, a gestão pode planejar
              manutenções preventivas e investimentos com base em evidências concretas.
            </div>
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
            title="Porcentagem de Preenchimento do Nível de Água · RAP01 · Silvanópolis"
          />
        </div>
      </div>
      <!-- Level time series -->
      <div class="col-lg-6 col-md-4">
        <div class="chart-card">
          <LevelTimeSeries
            :data="silvanopolis.levelSeries"
            :thresholds="levelThresholds"
            title="Porcentagem de Preenchimento do Nível de Água · RAP01 · Silvanópolis"
          />
        </div>
      </div>
      <!-- Map -->
      <div class="col-lg-3 col-md-4">
        <div class="chart-card chart-card--map" style="min-height:260px">
          <div class="chart-title">
            <span class="chart-title__dot" style="background:#4da6ff"></span>
            Localização do Site
          </div>
          <SiteMap :markers="siteMarkers" style="height:calc(100% - 30px);border-radius:6px;overflow:hidden" />
        </div>
      </div>
      <!-- Flow PTPs -->
      <div class="col-12">
        <div class="chart-card">
          <FlowTimeSeries :data="silvanopolis.flowSeries" />
        </div>
      </div>
      <!-- Bar charts -->
      <div class="col-lg-6">
        <div class="chart-card">
          <ProductionBar
            :data="silvanopolis.production24h"
            x-field="hour"
            title="Produção em m³/h nas últimas 24h · PTPs · Silvanópolis"
          />
        </div>
      </div>
      <div class="col-lg-6">
        <div class="chart-card">
          <ProductionBar
            :data="silvanopolis.productionDaily"
            x-field="day"
            title="Produção dos últimos 5 dias em m³ · PTPs · Silvanópolis"
          />
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
            title="Porcentagem de Preenchimento do Nível de Água · RAP01 · Miranorte"
          />
        </div>
      </div>
      <!-- Level time series -->
      <div class="col-lg-9 col-md-8">
        <div class="chart-card">
          <LevelTimeSeries
            :data="miranorte.levelSeries"
            :thresholds="levelThresholds"
            title="Porcentagem de Preenchimento do Nível de Água · RAP01 · Miranorte"
          />
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dashboard-footer">
      <span>prana · AIIoT · Monitoramento em Tempo Real</span>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TankGauge from '@/components/charts/TankGauge.vue'
import LevelTimeSeries from '@/components/charts/LevelTimeSeries.vue'
import FlowTimeSeries from '@/components/charts/FlowTimeSeries.vue'
import ProductionBar from '@/components/charts/ProductionBar.vue'
import RefreshCountdown from '@/components/charts/RefreshCountdown.vue'
import { useTimestreamDashboard } from '@/composables/useTimestreamDashboard'
import { exportLog, getSnapshotCount } from '@/composables/useDashboardLogger'
import { useAlertStore } from '@/composables/useAlertStore'
import SiteMap from '@/components/charts/SiteMap.vue'

const router = useRouter()
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

const bannerOpen = ref(false)   // collapsed by default

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
  border: 1px solid #1e2a3a;
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
  border: 1px solid #1e2a3a;
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
  background: #13161c;
  border-bottom: 1px solid #1f2330;
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
  filter: drop-shadow(0 0 6px rgba(214,170,1,0.25));
}
.top-bar__divider {
  width: 1px;
  height: 32px;
  background: linear-gradient(to bottom, transparent, #2e3240, transparent);
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
  color: #d6aa01;
  opacity: 0.85;
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
.status-dot.ok      { background: #37872d; box-shadow: 0 0 5px #37872d; }
.status-dot.error   { background: #e84040; box-shadow: 0 0 5px #e84040; }
.status-dot.loading { background: #d6aa01; animation: rl-blink 1s ease-in-out infinite; }
.status-text {
  font-size: 0.75rem;
  color: #7a8099;
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
  background: transparent;
  border: 1px solid #2e3550;
  color: #8ab4f8;
  padding: 0.35rem 0.9rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  letter-spacing: 0.3px;
}
.export-btn:hover {
  background: #1a2040;
  border-color: #4a5580;
  color: #aecbfa;
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
  color: #d6aa01;
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
  border: 1px solid #1e2230;
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
  align-items: center;
  justify-content: center;
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
</style>
