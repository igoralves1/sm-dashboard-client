<template>
  <MainLayout>
    <BContainer fluid class="energisa-device">
    <!-- Breadcrumb -->
    <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
      <RouterLink to="/dashboard" class="crumb-home">
        <Icon icon="tabler:home" width="15" height="15" />
        <span>{{ t('energisa.breadcrumb_home') }}</span>
      </RouterLink>
      <span class="text-muted">/</span>
      <RouterLink to="/dashboard-energisa" class="text-decoration-none fw-semibold">{{ t('energisa.title') }}</RouterLink>
      <span class="text-muted">/</span>
      <span class="text-muted">{{ device?.location ?? '—' }}</span>
      <span class="text-muted">/</span>
      <span class="fw-semibold">{{ device?.name ?? '…' }}</span>
    </div>

    <div v-if="!configured" class="alert alert-warning">
      {{ t('energisa.not_configured') }}
    </div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <template v-else>
      <!-- ── Leituras em tempo real ──────────────────────────────────── -->
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h6 class="section-title mb-0">{{ t('energisa.realtime_readings') }}</h6>
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn" :class="!grouped ? 'btn-primary' : 'btn-outline-secondary'" @click="grouped = false">{{ t('energisa.detailed') }}</button>
          <button type="button" class="btn" :class="grouped ? 'btn-primary' : 'btn-outline-secondary'" @click="grouped = true">{{ t('energisa.grouped') }}</button>
        </div>
      </div>

      <div class="row g-2 mb-4">
        <div class="col-12 col-xxl-8">
      <div class="row g-2 mb-2">
        <div class="col-6 col-lg-3">
          <div class="card h-100"><div class="card-body kpi-body">
            <div class="kpi-label"><span class="dot bg-success"></span>{{ t('energisa.total_power') }}</div>
            <div v-if="grouped" class="kpi-value">{{ fmtUnit(live.totalPower, 'W') }}</div>
            <div v-else class="kpi-channels">
              <div v-for="c in liveChannels" :key="c.channel" class="kpi-channel">
                <span class="kpi-channel__name">CH{{ c.channel }}:</span>
                <span class="kpi-channel__value">{{ fmtUnit(c.p, 'W') }}</span>
              </div>
            </div>
          </div></div>
        </div>

        <div class="col-6 col-lg-3">
          <div class="card h-100"><div class="card-body kpi-body">
            <div class="kpi-label"><span class="dot bg-warning"></span>{{ t('energisa.mean_voltage') }}</div>
            <div v-if="grouped" class="kpi-value">{{ fmtUnit(live.meanVoltage, 'V') }}</div>
            <div v-else class="kpi-channels">
              <div v-for="c in liveChannels" :key="c.channel" class="kpi-channel">
                <span class="kpi-channel__name">CH{{ c.channel }}:</span>
                <span class="kpi-channel__value">{{ fmtUnit(c.v, 'V') }}</span>
              </div>
            </div>
          </div></div>
        </div>

        <div class="col-6 col-lg-3">
          <div class="card h-100"><div class="card-body kpi-body">
            <div class="kpi-label"><span class="dot bg-primary"></span>{{ t('energisa.current') }}</div>
            <div v-if="!live.currents.length" class="kpi-value">—</div>
            <div v-else class="kpi-channels">
              <div v-for="c in live.currents" :key="c.channel" class="kpi-channel">
                <span class="kpi-channel__name">CH{{ c.channel }}:</span>
                <span class="kpi-channel__value">{{ beautify(c.value) }} A</span>
              </div>
            </div>
          </div></div>
        </div>

        <div class="col-6 col-lg-3">
          <div class="card h-100"><div class="card-body kpi-body">
            <div class="kpi-label"><span class="dot bg-secondary"></span>{{ t('energisa.consumption_day') }}</div>
            <div class="kpi-value">{{ beautify(live.energyToday) }} kWh</div>
          </div></div>
        </div>
      </div>

      <!-- Carregamento — TRAFO only -->
      <div v-if="loadingTiles" class="row g-2">
        <div class="col-6 col-lg-3">
          <div class="card h-100"><div class="card-body kpi-body">
            <div class="kpi-label"><span class="dot bg-purple"></span>{{ t('energisa.total_loading') }}</div>
            <div class="kpi-value">{{ beautify(loadingTiles.total) }} %</div>
          </div></div>
        </div>
        <div v-for="(value, idx) in loadingTiles.phases" :key="idx" class="col-6 col-lg-3">
          <div class="card h-100"><div class="card-body kpi-body">
            <div class="kpi-label"><span class="dot bg-purple"></span>{{ t('energisa.phase_loading', { n: idx + 1 }) }}</div>
            <div class="kpi-value">{{ beautify(value) }} %</div>
          </div></div>
        </div>
      </div>

        </div>

        <!-- Position, from the device's own telemetry -->
        <div class="col-6 col-xxl-2">
          <div class="card h-100">
            <div class="card-body kpi-body d-flex flex-column">
              <div class="kpi-label"><span class="dot bg-info"></span>{{ t('energisa.map_title') }}</div>
              <div class="media-frame">
                <DeviceLocationMap
                  :point="liveLocation"
                  :title="device?.name ?? ''"
                  :health="deviceHealth"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Field photo, matched to the device by name -->
        <div class="col-6 col-xxl-2">
          <div class="card h-100">
            <div class="card-body kpi-body d-flex flex-column">
              <div class="kpi-label"><span class="dot bg-secondary"></span>{{ t('energisa.photo_title') }}</div>
              <div class="media-frame">
                <DevicePhoto :name="device?.name" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Condition analysis ──────────────────────────────────────── -->
      <div class="mb-4">
        <DiagnosticsPanel
          :channels="liveChannels"
          :ratings="device?.ratings ?? null"
          :temperature="liveTemperature"
        />
      </div>

      <!-- ── Leituras por intervalo ──────────────────────────────────── -->
      <h6 class="section-title mb-2">{{ t('energisa.interval_readings') }}</h6>

      <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <DateRangePicker :start="rangeStart" :end="rangeEnd" @change="setRange" />
        <span class="text-muted point-count">
          <span v-if="loading">{{ t('energisa.loading') }}</span>
          <span v-else>{{ readings.length.toLocaleString('pt-BR') }} {{ t('energisa.points_returned') }}</span>
        </span>
      </div>

      <div class="row g-2 mb-3">
        <div v-for="ch in [1, 2, 3]" :key="ch" class="col-12 col-lg-4">
          <EnergyResumeCard
            v-model:expanded="detailsExpanded"
            :channel="ch"
            :energy-sum="channelEnergy[ch - 1]"
            :metrics="resumes.metrics[ch - 1]"
          />
        </div>
      </div>

      <!-- ── Charts ──────────────────────────────────────────────────── -->
      <div class="card mb-3">
        <div class="card-body">
          <!-- Tabs -->
          <ul class="nav nav-tabs mb-3">
            <li v-for="item in TABS" :key="item.value" class="nav-item">
              <button class="nav-link" :class="{ active: tab === item.value }" @click="tab = item.value">
                {{ t(item.label) }}
              </button>
            </li>
          </ul>

          <!-- Phase + metric toggles -->
          <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
            <div class="form-check form-check-inline mb-0">
              <input id="perPhase" v-model="perPhase" class="form-check-input" type="radio" :value="true" />
              <label class="form-check-label" for="perPhase">{{ t('energisa.per_phase') }}</label>
            </div>
            <div class="form-check form-check-inline mb-0">
              <input id="threePhase" v-model="perPhase" class="form-check-input" type="radio" :value="false" />
              <label class="form-check-label" for="threePhase">{{ t('energisa.three_phase') }}</label>
            </div>

            <div v-if="tab === 'power'" class="btn-group btn-group-sm flex-wrap">
              <button
                v-for="o in METRICS"
                :key="o.value"
                type="button"
                class="btn"
                :class="metric === o.value ? 'btn-primary' : 'btn-outline-secondary'"
                @click="metric = o.value"
              >
                {{ t(o.label) }}
              </button>
            </div>

            <span v-if="cursorLabel" class="ms-auto text-muted" style="font-size: 12px">{{ cursorLabel }}</span>
          </div>

          <div v-if="loading" class="text-center py-5 text-muted">{{ t('energisa.loading') }}</div>

          <div v-else class="chart-stack">
            <SyncTimeSeries
              v-model:cursor="cursor"
              :series="powerSeries"
              :title="chartTitle"
              :unit="metricUnit"
              :y-min="axisBounds.power.min"
              :y-max="axisBounds.power.max"
              :height="210"
            />
            <SyncTimeSeries
              v-model:cursor="cursor"
              :series="voltageSeries"
              :title="t('energisa.voltage')"
              unit=" V"
              :y-min="axisBounds.voltage.min"
              :y-max="axisBounds.voltage.max"
              :height="185"
            />
            <SyncTimeSeries
              v-model:cursor="cursor"
              :series="currentSeries"
              :title="t('energisa.current')"
              unit=" A"
              :y-min="axisBounds.current.min"
              :y-max="axisBounds.current.max"
              :height="185"
            />
            <SyncTimeSeries
              v-model:cursor="cursor"
              :series="temperatureSeries"
              :title="t('energisa.temperature')"
              unit=" °C"
              :y-min="axisBounds.temperature.min"
              :y-max="axisBounds.temperature.max"
              :height="175"
            />

            <div class="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2 chart-footer">
              <span class="text-muted" style="font-size: 12.5px">
                {{ t('energisa.selected_instant') }}: <strong>{{ selectedLabel }}</strong>
                <span v-if="loadingWave" class="ms-2">{{ t('energisa.loading_waveform') }}</span>
              </span>

              <label class="realtime-toggle">
                <input v-model="realtime" class="form-check-input m-0" type="checkbox" role="switch" />
                <span>{{ t('energisa.realtime_chart') }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Waveform analysis ───────────────────────────────────────── -->
      <div class="row g-3">
        <div class="col-12 col-xl-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <h6 class="section-title mb-0">{{ t('energisa.temporal_analysis') }}</h6>
                <span v-if="temporalNote" class="pill" :class="`sev-${temporalNote.severity}`">
                  {{ t(`energisa.diag.sev_${temporalNote.severity}`) }}
                </span>
              </div>
              <div class="panel-control"><ChannelPicker v-model="channelFilter" /></div>
              <WaveformChart
                :channels="waveSeries ?? []"
                :only="channelFilter"
                :ratings="device?.ratings ?? null"
                :height="230"
              />
              <AnalysisNote :note="temporalNote" />
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <h6 class="section-title mb-0">{{ t('energisa.phasor_diagram') }}</h6>
                <span v-if="phasorNote" class="pill" :class="`sev-${phasorNote.severity}`">
                  {{ t(`energisa.diag.sev_${phasorNote.severity}`) }}
                </span>
              </div>
              <div class="panel-control"><ChannelPicker v-model="channelFilter" /></div>
              <PhasorDiagram
                :channels="waveSeries ?? []"
                :only="channelFilter"
                :ratings="device?.ratings ?? null"
                :size="230"
              />
              <AnalysisNote :note="phasorNote" />
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <h6 class="section-title mb-0">{{ t('energisa.harmonic_analysis') }}</h6>
                <span v-if="harmonicNote" class="pill" :class="`sev-${harmonicNote.severity}`">
                  {{ t(`energisa.diag.sev_${harmonicNote.severity}`) }}
                </span>
              </div>
              <div class="panel-control"><HarmonicModePicker v-model="harmonicMode" /></div>
              <HarmonicBars :channels="waveSeries ?? []" :mode="harmonicMode" :height="230" />
              <AnalysisNote :note="harmonicNote" />
            </div>
          </div>
        </div>
      </div>
      </template>
    </BContainer>
  </MainLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import MainLayout from '@/layouts/MainLayout.vue'
import DiagnosticsPanel from '@/components/charts/DiagnosticsPanel.vue'
import DeviceLocationMap from '@/components/charts/DeviceLocationMap.vue'
import DevicePhoto from '@/components/charts/DevicePhoto.vue'
import AnalysisNote from '@/components/charts/AnalysisNote.vue'
import {
  analyseHarmonics,
  analysePhasor,
  analyseTemporal,
} from '@/utils/energy/waveformAnalysis'
import { analyse } from '@/utils/energy/diagnostics'
import { useI18n } from 'vue-i18n'
import SyncTimeSeries from '@/components/charts/SyncTimeSeries.vue'
import WaveformChart from '@/components/charts/WaveformChart.vue'
import PhasorDiagram from '@/components/charts/PhasorDiagram.vue'
import HarmonicBars from '@/components/charts/HarmonicBars.vue'
import ChannelPicker from '@/components/charts/ChannelPicker.vue'
import DateRangePicker from '@/components/charts/DateRangePicker.vue'
import EnergyResumeCard from '@/components/charts/EnergyResumeCard.vue'
import HarmonicModePicker from '@/components/charts/HarmonicModePicker.vue'
import type { HarmonicMode } from '@/components/charts/HarmonicBars.vue'
import { useEnergisaDevice, type ChartTab, type PowerMetric } from '@/composables/useEnergisaDevice'

const { t } = useI18n()
const route = useRoute()
const deviceId = String(route.params.deviceId)

const {
  device, readings, waveSeries, live, loadingTiles, channelEnergy,
  powerSeries, voltageSeries, currentSeries, energySeries,
  tab, metric, perPhase, grouped, liveChannels, temperatureSeries, axisBounds,
  rangeStart, rangeEnd, resumes, readingNear, selectedPoint, realtime, liveLocation,
  loading, loadingWave, error, configured, load, loadWaveform, setRange, metricLabel,
} = useEnergisaDevice(deviceId)

const TABS: { value: ChartTab; label: string }[] = [
  { value: 'power', label: 'energisa.tab_power' },
  { value: 'energy', label: 'energisa.tab_energy' },
  { value: 'accumulated', label: 'energisa.tab_accumulated' },
]

const METRICS: { value: PowerMetric; label: string }[] = [
  { value: 'S', label: 'energisa.metric_apparent' },
  { value: 'P', label: 'energisa.metric_active' },
  { value: 'Q', label: 'energisa.metric_reactive' },
  { value: 'FP', label: 'energisa.metric_pf' },
  { value: 'FC', label: 'energisa.metric_lf' },
]

/** Shared crosshair across all four stacked charts. */
const cursor = ref<number | null>(null)
/** null = all three phases; 1/2/3 = one phase, for the waveform panels. */
const channelFilter = ref<number | null>(null)
/** Harmonic panel selects a quantity (Todos/Vca/Ica), not a phase. */
const harmonicMode = ref<HarmonicMode>('all')
/** Shared by all three Consumo cards — they open and close as a set. */
const detailsExpanded = ref(false)
const chartTitle = computed(() =>
  tab.value === 'energy'
    ? t('energisa.consumption')
    : t(METRICS.find((m) => m.value === metric.value)?.label ?? 'energisa.metric_apparent'),
)

/** Unit shown beside each readout value on the top panel. */
const metricUnit = computed(() => {
  if (tab.value === 'energy') return ' kWh'
  return { S: ' VA', P: ' W', Q: ' var', FP: '', FC: ' %' }[metric.value] ?? ''
})

/** Most recent board temperature, for the thermal indicator. */
const liveTemperature = computed(() => {
  for (let i = temperatureSeries.value[0]?.points.length ?? 0; i-- > 0; ) {
    const v = temperatureSeries.value[0].points[i][1]
    if (Number.isFinite(v)) return v
  }
  return null
})

/** Worst-indicator severity, shared by the map marker and the analysis panel. */
/**
 * Waveform readings. All three run off the same capture and respect the
 * phase selector, so the numbers always describe what is on screen.
 */
const notedChannels = computed(() =>
  channelFilter.value
    ? (waveSeries.value ?? []).filter((c) => c.channel === channelFilter.value)
    : (waveSeries.value ?? []),
)

const temporalNote = computed(() => analyseTemporal(notedChannels.value))
const phasorNote = computed(() => analysePhasor(notedChannels.value))
const harmonicNote = computed(() => analyseHarmonics(waveSeries.value ?? []))

const deviceHealth = computed(
  () =>
    analyse({
      channels: liveChannels.value,
      ratings: device.value?.ratings ?? null,
      temperature: liveTemperature.value,
    }).healthSeverity,
)

const cursorLabel = computed(() =>
  cursor.value === null ? '' : new Date(cursor.value).toLocaleString('pt-BR'),
)

const selectedLabel = computed(() => {
  const point = selectedPoint.value
  return point ? new Date(point.timestamp).toLocaleString('pt-BR') : '—'
})

/** Production's beautifyFalseNumber. */
function beautify(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return '-'
  return (value / (value > 1000 ? 1000 : 1)).toFixed(2)
}

function fmtUnit(value: number | null | undefined, unit: string): string {
  if (!value || !Number.isFinite(value)) return `- ${unit}`
  return `${beautify(value)} ${value > 1000 ? 'k' : ''}${unit}`
}

/**
 * Hovering a chart selects that instant's waveform. Debounced, because the
 * crosshair fires on every mousemove and each change costs a request.
 */
let hoverTimer: ReturnType<typeof setTimeout> | null = null

watch(cursor, (ts) => {
  if (ts === null || realtime.value) return
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    const point = readingNear(ts)
    if (point && point.id !== selectedPoint.value?.id) loadWaveform(point)
  }, 350)
})

/** Turning live-follow back on snaps to the most recent reading. */
watch(realtime, (on) => {
  if (!on) return
  const last = readings.value[readings.value.length - 1]
  if (last) loadWaveform(last)
})

onBeforeUnmount(() => {
  if (hoverTimer) clearTimeout(hoverTimer)
})

onMounted(load)
</script>

<style scoped>
/* The layout renders this view flush to the viewport edge, so the page owns
   its own gutters rather than relying on a wrapper. */
.energisa-device {
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

.bg-purple { background: #8b5cf6; }
.bg-info { background: var(--bs-info, #0dcaf0); }
.bg-secondary { background: var(--bs-secondary-color); }

/* Map and photo share one frame height so the two cards read as a pair. */
.media-frame {
  flex: 1 1 auto;
  min-height: 132px;
}

/* One labelled row per channel: "CH1: 18.89 A".
   The label leads and carries a colon, so a narrow card can never run the
   unit into the next label the way "18.89ACH1" did. */
.kpi-channels {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.kpi-channel {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  line-height: 1.5;
  white-space: nowrap;
}

.kpi-channel__name {
  font-size: 11px;
  font-weight: 600;
  color: var(--bs-secondary-color);
  /* Fixed width keeps the numbers aligned in a column under one another. */
  min-width: 2.9em;
}

.kpi-channel__value {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.kpi-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.kpi-sub {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

/* Tabs: flat underline rather than Bootstrap's boxed default, matching the
   production page. */
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

/* Metric buttons read as pills in production. */
.btn-group .btn {
  border-radius: 999px !important;
  font-size: 12.5px;
  padding: 0.3rem 0.85rem;
  margin-right: 0.3rem;
}

/* The selector sits on its own row beneath the header: the badge is a status
   readout and the selector a control, so stacking them keeps the two from
   competing for the same corner. */
.panel-control {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

/* Same pill as the condition indicators, so severity reads identically
   wherever it appears on the page. */
.pill {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  white-space: nowrap;
}

.pill.sev-good { color: var(--bs-success); }
.pill.sev-watch { color: var(--bs-info, #0dcaf0); }
.pill.sev-warning { color: var(--bs-warning); }
.pill.sev-critical { color: var(--bs-danger); }
.pill.sev-unknown { color: var(--bs-secondary-color); }

.point-count {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.chart-footer {
  border-top: 1px solid var(--bs-border-color);
  padding-top: 0.6rem;
}

.realtime-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 12.5px;
  color: var(--bs-secondary-color);
  cursor: pointer;
  margin: 0;
}

.chart-stack {
  padding-top: 0.5rem;
}

@media (max-width: 576px) {
  .kpi-value { font-size: 20px; }
}
</style>
