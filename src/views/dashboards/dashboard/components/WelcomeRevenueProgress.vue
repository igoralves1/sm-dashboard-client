<template>
    <BCard no-body>
        <BCardBody class="p-0">
            <BRow class="g-0">
                <BCol xxl="3" xl="6" class="order-xl-1 order-xxl-0">
                    <div class="p-4 border-end border-dashed alert-history-panel">
                        <!-- Header -->
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <h4 class="card-title mb-0">{{ t('dashboard.alerts_title') }}</h4>
                            <span v-if="count24h > 0" class="badge-24h">
                                {{ count24h }}<span class="badge-24h-label">&nbsp;/24h</span>
                            </span>
                        </div>
                        <p class="text-muted fs-xs mb-3">
                            {{ t('dashboard.alerts_subtitle', { hours: 24 }) }}
                        </p>

                        <!-- Empty state -->
                        <div v-if="!recentAlerts.length" class="alert-empty">
                            <Icon icon="tabler:checks" width="28" class="alert-empty-icon" />
                            <span>{{ t('dashboard.no_alerts') }}</span>
                        </div>

                        <!-- Alert feed -->
                        <div v-else class="alert-feed">
                            <div
                                v-for="item in recentAlerts"
                                :key="item.id"
                                :class="['alert-row', `alert-row--${item.severity}`]"
                            >
                                <span :class="['alert-dot', `alert-dot--${item.severity}`]"></span>
                                <div class="alert-row-body">
                                    <div class="alert-row-top">
                                        <span class="alert-ptp-tag">{{ item.ptp }}</span>
                                        <span :class="['alert-sev', `alert-sev--${item.severity}`]">
                                            {{ severityLabel(item.severity) }}
                                        </span>
                                    </div>
                                    <p class="alert-detail">{{ item.detail }}</p>
                                    <span class="alert-time">{{ fmtTime(item.timestamp) }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Footer links -->
                        <div class="alert-footer">
                            <router-link to="/alerts" class="alert-footer-link">
                                <Icon icon="tabler:bell-ringing" width="14" />
                                {{ t('dashboard.all_alerts') }}
                            </router-link>
                            <button class="alert-footer-link alert-footer-link--report" @click="downloadReport">
                                <Icon icon="tabler:file-type-pdf" width="14" />
                                {{ t('dashboard.view_report') }}
                            </button>
                        </div>
                    </div>
                    <hr class="d-xxl-none border-light m-0" />
                </BCol>

                <BCol xxl="6" class="order-xl-3 order-xxl-1">
                    <div class="px-4 py-3 border-end border-dashed">
                        <b-row class="text-center mb-3">
                            <BCol>
                                <div class="bg-light bg-opacity-50 p-2">
                                    <h5 class="m-0">
                                        <span class="text-muted me-1">{{ t('dashboard.total_consumption') }}:</span>
                                        <CountUp class="d-inline-flex" :end-val="1847"
                                            :options="{ suffix: ' MWh', enableScrollSpy: true, scrollSpyOnce: true }" />
                                    </h5>
                                </div>
                            </BCol>
                            <BCol>
                                <div class="bg-light bg-opacity-50 p-2">
                                    <h5 class="m-0">
                                        <span class="text-muted me-1">{{ t('dashboard.active_sensors') }}:</span>
                                        <CountUp class="d-inline-flex" :end-val="2847"
                                            :options="{ separator: '.' }" />
                                    </h5>
                                </div>
                            </BCol>
                        </b-row>
                        <StackedAreaChart />
                    </div>
                </BCol>

                <BCol xxl="3" xl="6" class="order-xl-2 order-xxl-2">
                    <div class="p-3">
                        <h4 class="card-title mb-1">{{ t('dashboard.water_stations') }}</h4>
                        <p class="text-muted fs-xs">21 {{ t('dashboard.stations_monitored') }}</p>

                        <b-row class="mt-4">
                            <BCol>
                                <DonutChart />
                            </BCol>
                        </b-row>
                    </div>
                    <hr class="d-xxl-none border-light m-0" />
                </BCol>
            </BRow>
        </BCardBody>
    </BCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { BCard, BCol, BRow } from 'bootstrap-vue-next'
import CountUp from 'vue-countup-v3'
import { Icon } from '@iconify/vue'
import StackedAreaChart from './StackedAreaChart.vue'
import DonutChart from './DonutChart.vue'
import { useAlertStore } from '@/composables/useAlertStore'
import type { StoredAlert } from '@/composables/useAlertStore'
import pranaLogoRaw from '/pranalogototal.svg?raw'

const { alerts, alerts24h, initFromS3, startPolling, stopPolling } = useAlertStore()

onMounted(async () => {
  await initFromS3()   // load S3 data immediately on open
  startPolling()        // then poll every 15s for new alerts from any user/page
})
onUnmounted(() => { stopPolling() })

const recentAlerts = computed(() => alerts.value.slice(0, 8))
const count24h = computed(() => alerts24h.value.length)
const { t }    = useI18n()

function severityLabel(s: string) {
  if (s === 'critical') return t('dashboard.severity_critical')
  if (s === 'warning')  return t('dashboard.severity_warning')
  return t('dashboard.severity_info')
}

function severityColor(s: string) {
  if (s === 'critical') return '#e84040'
  if (s === 'warning')  return '#f58b06'
  return '#37872d'
}

function severityBg(s: string) {
  if (s === 'critical') return '#fff5f5'
  if (s === 'warning')  return '#fffaf0'
  return '#f0fff4'
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)  return 'agora'
  if (diffMin < 60) return `${diffMin}min atrás`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function sourceLabel(s: string) {
  if (s === 'dashboard-sm-24h') return 'Produção 24h · Silvanópolis'
  if (s === 'dashboard-sm-5d')  return 'Produção 5 dias · Silvanópolis'
  return s
}

function typeLabel(t: string) {
  if (t === 'pump_off')     return 'Bomba desligada'
  if (t === 'outlier_low')  return 'Queda anômala'
  if (t === 'outlier_high') return 'Pico anômalo'
  return t
}

function buildReportHtml(list: StoredAlert[]): string {
  const generatedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const rows = list.map((a, i) => `
    <div class="alarm-card sev-${a.severity}">
      <div class="alarm-header">
        <div class="alarm-num">#${String(i + 1).padStart(2, '0')}</div>
        <div class="alarm-title-group">
          <span class="alarm-ptp">${a.ptp}</span>
          <span class="alarm-type">${typeLabel(a.type)}</span>
          <span class="alarm-sev sev-badge-${a.severity}">${severityLabel(a.severity)}</span>
        </div>
        <div class="alarm-timestamp">${fmtDateFull(a.timestamp)}</div>
      </div>
      <div class="alarm-body">
        <div class="alarm-detail">${a.detail}</div>
        <div class="alarm-meta">
          <span><b>Fonte:</b> ${sourceLabel(a.source)}</span>
          <span><b>Horas afetadas:</b> ${a.hours.join('h, ')}h</span>
          <span><b>Prob. operação normal:</b> ${a.pValuePct < 0.01 ? '< 0.01%' : a.pValuePct.toFixed(2) + '%'}</span>
        </div>
      </div>
    </div>
  `).join('')

  const critCount = list.filter(a => a.severity === 'critical').length
  const warnCount = list.filter(a => a.severity === 'warning').length
  const infoCount = list.filter(a => a.severity === 'info').length

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório de Alarmes — prana</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    background: #fff;
    padding: 32px 40px;
  }

  /* Header */
  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #1a1a2e;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .report-logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .report-logo-svg { display: block; }
  .report-logo-svg svg { height: 40px; width: auto; display: block; }
  .report-logo-sub  { font-size: 9px; color: #6b7280; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px; }
  .report-meta { text-align: right; font-size: 9px; color: #6b7280; line-height: 1.6; }
  .report-meta strong { font-size: 10px; color: #1a1a2e; display: block; }

  /* Summary bar */
  .summary-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }
  .summary-card {
    flex: 1;
    border-radius: 10px;
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
  }
  .summary-card .sc-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
  .summary-card .sc-val   { font-size: 22px; font-weight: 800; margin-top: 2px; }
  .summary-card.total  { background: #f8fafc; }
  .summary-card.crit   { background: #fff5f5; border-color: #fca5a5; }
  .summary-card.crit .sc-val { color: #e84040; }
  .summary-card.warn   { background: #fffbeb; border-color: #fcd34d; }
  .summary-card.warn .sc-val { color: #f58b06; }
  .summary-card.info   { background: #f0fdf4; border-color: #86efac; }
  .summary-card.info .sc-val { color: #37872d; }

  /* Section title */
  .section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: #6b7280;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e5e7eb;
  }

  /* Alarm cards */
  .alarm-card {
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    border-left-width: 4px;
    margin-bottom: 10px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .alarm-card.sev-critical { border-left-color: #e84040; }
  .alarm-card.sev-warning  { border-left-color: #f58b06; }
  .alarm-card.sev-info     { border-left-color: #37872d; }

  .alarm-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
  }
  .alarm-num {
    font-size: 9px; font-weight: 700; color: #9ca3af;
    min-width: 24px;
  }
  .alarm-title-group { display: flex; align-items: center; gap: 6px; flex: 1; }
  .alarm-ptp  { font-weight: 800; font-size: 11px; }
  .alarm-type { font-size: 10px; color: #6b7280; }
  .alarm-sev  {
    font-size: 9px; font-weight: 700;
    padding: 1px 7px; border-radius: 20px;
  }
  .sev-badge-critical { background: rgba(232,64,64,0.12);  color: #e84040; }
  .sev-badge-warning  { background: rgba(245,139,6,0.12);  color: #f58b06; }
  .sev-badge-info     { background: rgba(55,135,45,0.12);  color: #37872d; }
  .alarm-timestamp { font-size: 9px; color: #9ca3af; white-space: nowrap; }

  .alarm-body { padding: 8px 12px; }
  .alarm-detail { font-size: 11px; margin-bottom: 6px; color: #374151; }
  .alarm-meta {
    display: flex; gap: 16px; flex-wrap: wrap;
    font-size: 9px; color: #6b7280;
  }
  .alarm-meta b { color: #374151; }

  /* Footer */
  .report-footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #9ca3af;
  }

  @media print {
    body { padding: 20px 28px; }
    .alarm-card { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="report-header">
    <div class="report-logo">
      <div>
        <div class="report-logo-svg">${pranaLogoRaw}</div>
        <div class="report-logo-sub">Monitoramento AIIoT em tempo real · Projeto HF</div>
      </div>
    </div>
    <div class="report-meta">
      <strong>Relatório de Alarmes e Anomalias</strong>
      Gerado em: ${generatedAt}<br/>
      Projeto HF · Silvanópolis &amp; Miranorte
    </div>
  </div>

  <div class="summary-bar">
    <div class="summary-card total">
      <div class="sc-label">Total de Alarmes</div>
      <div class="sc-val">${list.length}</div>
    </div>
    <div class="summary-card crit">
      <div class="sc-label">Críticos</div>
      <div class="sc-val">${critCount}</div>
    </div>
    <div class="summary-card warn">
      <div class="sc-label">Atenção</div>
      <div class="sc-val">${warnCount}</div>
    </div>
    <div class="summary-card info">
      <div class="sc-label">Informativos</div>
      <div class="sc-val">${infoCount}</div>
    </div>
  </div>

  <div class="section-title">Detalhamento dos Alarmes</div>
  ${list.length ? rows : '<p style="color:#9ca3af;text-align:center;padding:32px 0;">Nenhum alarme registrado.</p>'}

  <div class="report-footer">
    <span>prana · Monitoramento AIIoT em tempo real · Projeto HF</span>
    <span>Documento gerado automaticamente — ${generatedAt}</span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`
}

function downloadReport() {
  const list = alerts.value
  const html = buildReportHtml(list)
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (win) win.focus()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
</script>

<style scoped>
.alert-history-panel {
  display: flex;
  flex-direction: column;
  min-height: 260px;
}

/* 24h badge */
.badge-24h {
  display: inline-flex;
  align-items: center;
  background: rgba(232, 64, 64, 0.12);
  color: #e84040;
  border: 1px solid rgba(232, 64, 64, 0.3);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}
.badge-24h-label {
  font-weight: 400;
  opacity: 0.85;
}

/* Empty state */
.alert-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 0;
  color: var(--bs-secondary-color, #6c757d);
  font-size: 0.82rem;
}
.alert-empty-icon { opacity: 0.4; }

/* Feed */
.alert-feed {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
  flex: 1;
}

.alert-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border-left: 3px solid transparent;
  background: var(--bs-tertiary-bg, #f8f9fa);
  transition: background 0.15s;
}
.alert-row--critical { border-left-color: #e84040; background: rgba(232,64,64,0.06); }
.alert-row--warning  { border-left-color: #f58b06; background: rgba(245,139,6,0.06); }
.alert-row--info     { border-left-color: #73bf69; background: rgba(115,191,105,0.06); }

.alert-dot {
  flex-shrink: 0;
  width: 8px; height: 8px;
  border-radius: 50%;
  margin-top: 5px;
}
.alert-dot--critical { background: #e84040; box-shadow: 0 0 4px #e84040; }
.alert-dot--warning  { background: #f58b06; box-shadow: 0 0 4px #f58b06; }
.alert-dot--info     { background: #73bf69; box-shadow: 0 0 4px #73bf69; }

.alert-row-body { flex: 1; min-width: 0; }

.alert-row-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.alert-ptp-tag {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--bs-body-color);
}

.alert-sev {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}
.alert-sev--critical { background: rgba(232,64,64,0.15);  color: #e84040; }
.alert-sev--warning  { background: rgba(245,139,6,0.15);  color: #f58b06; }
.alert-sev--info     { background: rgba(115,191,105,0.15); color: #37872d; }

.alert-detail {
  font-size: 0.75rem;
  margin: 0 0 2px;
  color: var(--bs-secondary-color, #6c757d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-time {
  font-size: 0.68rem;
  color: var(--bs-secondary-color, #6c757d);
  opacity: 0.7;
}

/* Footer links */
.alert-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--bs-border-color, #dee2e6);
}

.alert-footer-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--bs-primary, #0d6efd);
  text-decoration: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: opacity 0.15s, gap 0.15s;
  width: fit-content;
}
.alert-footer-link:hover {
  opacity: 0.75;
  gap: 8px;
}
.alert-footer-link--report {
  color: #e84040;
}
</style>
