<template>
  <MainLayout>
  <div class="ai-training-page">

    <!-- Page Header -->
    <div class="row mb-3 align-items-center">
      <div class="col">
        <h4 class="page-title mb-1">
          <span :class="['live-dot me-2', metrics.status === 'training' || metrics.status === 'extracting' ? 'pulse' : '']"></span>
          SPC Fine-Tuning Monitor
        </h4>
        <p class="text-muted mb-0" style="font-size:12px;">
          Llama-3.2-3B · LoRA adapter · RTX 5080 (17 GB VRAM)
        </p>
      </div>
      <div class="col-auto d-flex align-items-center gap-2">
        <span :class="['badge', statusBadgeClass]">{{ metrics.status?.toUpperCase() || 'IDLE' }}</span>
        <span class="text-muted" style="font-size:11px;">{{ updatedAt }}</span>
        <a href="http://localhost:8765/api/metrics" target="_blank" class="btn btn-sm btn-outline-secondary">
          Raw JSON
        </a>
      </div>
    </div>

    <!-- Alert when server unreachable -->
    <div v-if="serverError" class="alert alert-warning d-flex align-items-center gap-2 mb-3" style="font-size:13px;">
      <i class="tabler-alert-triangle"></i>
      Cannot reach metrics server at <code class="ms-1">http://localhost:8765</code> — start it with
      <code class="ms-1">python metrics_server.py</code>
    </div>

    <!-- Progress -->
    <div class="card mb-3">
      <div class="card-body py-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="fw-semibold" style="font-size:13px;">{{ phaseLabel }}</span>
          <span class="fw-bold text-primary" style="font-size:16px;">{{ progressPct }}%</span>
        </div>
        <div class="progress mb-2" style="height:10px; border-radius:5px;">
          <div
            class="progress-bar"
            role="progressbar"
            :style="{ width: progressPct + '%', background: 'linear-gradient(90deg, #58a6ff, #bc8cff)', transition: 'width 1s ease' }"
          ></div>
        </div>
        <div class="d-flex gap-4 text-muted" style="font-size:12px;">
          <span>Step <strong class="text-body">{{ metrics.step ?? '—' }}</strong> / <strong class="text-body">{{ metrics.total_steps ?? '—' }}</strong></span>
          <span>Epoch <strong class="text-body">{{ epochDisplay }}</strong> / <strong class="text-body">{{ metrics.total_epochs ?? '—' }}</strong></span>
          <span>Dataset <strong class="text-body">{{ metrics.dataset_pairs ?? '—' }}</strong> pairs</span>
        </div>
      </div>
    </div>

    <!-- KPI Row -->
    <div class="row g-2 mb-3">
      <div class="col-6 col-sm-4 col-lg-2" v-for="kpi in kpiCards" :key="kpi.label">
        <div class="card h-100">
          <div class="card-body py-3 px-3">
            <div class="text-muted text-uppercase mb-1" style="font-size:10px; letter-spacing:.06em;">{{ kpi.label }}</div>
            <div class="fw-bold" style="font-size:22px; line-height:1; font-variant-numeric:tabular-nums;">
              {{ kpi.value }}<span v-if="kpi.unit" class="text-muted fw-normal ms-1" style="font-size:12px;">{{ kpi.unit }}</span>
            </div>
            <div v-if="kpi.sub" class="text-muted mt-1" style="font-size:10px;">{{ kpi.sub }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- GPU + Loss Chart Row -->
    <div class="row g-3 mb-3">

      <!-- GPU Bars -->
      <div class="col-12 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-title text-muted text-uppercase mb-3" style="font-size:11px; letter-spacing:.06em;">GPU — RTX 5080</h6>

            <div class="mb-3">
              <div class="d-flex justify-content-between mb-1">
                <span class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.06em;">VRAM Usage</span>
                <span class="fw-semibold" style="font-size:13px; font-variant-numeric:tabular-nums;">{{ vramLabel }}</span>
              </div>
              <div class="progress" style="height:8px; border-radius:4px; background:#1e2535;">
                <div class="progress-bar" :style="{ width: vramPct + '%', background: 'linear-gradient(90deg, #bc8cff, #e879f9)', transition:'width 1s ease' }"></div>
              </div>
            </div>

            <div class="mb-3">
              <div class="d-flex justify-content-between mb-1">
                <span class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.06em;">GPU Utilization</span>
                <span class="fw-semibold" style="font-size:13px; font-variant-numeric:tabular-nums;">{{ utilLabel }}</span>
              </div>
              <div class="progress" style="height:8px; border-radius:4px; background:#1e2535;">
                <div class="progress-bar" :style="{ width: utilPct + '%', background: 'linear-gradient(90deg, #3fb950, #4ade80)', transition:'width 1s ease' }"></div>
              </div>
            </div>

            <div>
              <div class="d-flex justify-content-between mb-1">
                <span class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.06em;">Temperature</span>
                <span class="fw-semibold" style="font-size:13px; font-variant-numeric:tabular-nums;">{{ tempLabel }}</span>
              </div>
              <div class="progress" style="height:8px; border-radius:4px; background:#1e2535;">
                <div class="progress-bar" :style="{ width: tempPct + '%', background: 'linear-gradient(90deg, #d29922, #ff7b72)', transition:'width 1s ease' }"></div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Loss Chart -->
      <div class="col-12 col-lg-8">
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-title text-muted text-uppercase mb-3" style="font-size:11px; letter-spacing:.06em;">Training Loss</h6>
            <VueApexCharts
              type="area"
              :height="200"
              :options="chartOptions"
              :series="chartSeries"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Steps Log -->
    <div class="card">
      <div class="card-body">
        <h6 class="card-title text-muted text-uppercase mb-3" style="font-size:11px; letter-spacing:.06em;">Recent Steps</h6>
        <div class="log-area">
          <div v-if="logBuffer.length === 0" class="text-muted" style="font-size:12px;">No steps yet — waiting for training to begin…</div>
          <div v-for="entry in [...logBuffer].reverse()" :key="entry.step" class="log-entry">
            <span class="log-ts">{{ entry.ts }}</span>
            <span class="log-msg">step {{ entry.step }}&nbsp;&nbsp;loss={{ entry.loss != null ? entry.loss.toFixed(4) : '—' }}&nbsp;&nbsp;lr={{ fmtLr(entry.lr) }}</span>
          </div>
        </div>
        <div class="text-muted mt-2" style="font-size:11px; text-align:center;">
          Polling every 5 seconds · metrics at <a href="http://localhost:8765/api/metrics" target="_blank">localhost:8765</a>
        </div>
      </div>
    </div>

  </div>
  </MainLayout>
</template>

<script setup lang="ts">
import MainLayout from '@/layouts/MainLayout.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'

// ── Types ──────────────────────────────────────────────────────────────────

interface GpuMetrics {
  vram_used_gb?: number
  vram_total_gb?: number
  vram_pct?: number
  temperature_c?: number
  utilization_pct?: number
}

interface HistoryPoint {
  step: number
  loss: number
}

interface Metrics {
  status?: string
  phase?: string
  epoch?: number
  total_epochs?: number
  step?: number
  total_steps?: number
  progress_pct?: number
  loss?: number
  learning_rate?: number
  grad_norm?: number
  samples_per_sec?: number
  elapsed_seconds?: number
  eta_seconds?: number
  gpu?: GpuMetrics
  history?: HistoryPoint[]
  dataset_pairs?: number
  updated_at?: string
  message?: string
}

interface LogEntry {
  ts: string
  step: number
  loss?: number
  lr?: number
}

// ── State ──────────────────────────────────────────────────────────────────

const METRICS_URL = 'http://localhost:8765/api/metrics'
const POLL_MS = 5000

const metrics = ref<Metrics>({})
const serverError = ref(false)
const logBuffer = ref<LogEntry[]>([])
let lastStep = -1
let pollTimer: ReturnType<typeof setTimeout> | null = null

// ── Computed ───────────────────────────────────────────────────────────────

const updatedAt = computed(() => {
  if (!metrics.value.updated_at) return '—'
  return 'Updated ' + new Date(metrics.value.updated_at).toLocaleTimeString()
})

const progressPct = computed(() => {
  return (metrics.value.progress_pct ?? 0).toFixed(1)
})

const epochDisplay = computed(() => {
  const e = metrics.value.epoch
  return e != null ? Number(e).toFixed(1) : '—'
})

const phaseLabel = computed(() => {
  const s = metrics.value.status
  if (s === 'extracting') return `Extracting PDFs — ${metrics.value.message || ''}`
  if (s === 'training') return `Training — Epoch ${metrics.value.epoch ?? '—'} / ${metrics.value.total_epochs ?? '—'}`
  if (s === 'complete') return 'Training complete ✓'
  return 'Waiting for training to start…'
})

const statusBadgeClass = computed(() => {
  const s = metrics.value.status
  if (s === 'training')   return 'badge-outline-success'
  if (s === 'extracting') return 'badge-outline-primary'
  if (s === 'complete')   return 'badge-outline-success'
  if (s === 'error')      return 'badge-outline-danger'
  return 'badge-outline-secondary'
})

const lossTrend = computed(() => {
  const h = metrics.value.history
  if (!h || h.length < 2) return ''
  const delta = h[h.length - 1].loss - h[0].loss
  return delta < 0
    ? `↓ ${Math.abs(delta).toFixed(4)} from start`
    : `↑ ${delta.toFixed(4)} from start`
})

const kpiCards = computed(() => [
  { label: 'Loss',        value: metrics.value.loss != null ? metrics.value.loss.toFixed(4) : '—', sub: lossTrend.value },
  { label: 'Learning Rate', value: fmtLr(metrics.value.learning_rate) },
  { label: 'Grad Norm',   value: metrics.value.grad_norm != null ? metrics.value.grad_norm.toFixed(3) : '—' },
  { label: 'Throughput',  value: metrics.value.samples_per_sec != null ? metrics.value.samples_per_sec.toFixed(1) : '—', unit: 'spl/s' },
  { label: 'Elapsed',     value: fmtSec(metrics.value.elapsed_seconds) },
  { label: 'ETA',         value: fmtSec(metrics.value.eta_seconds) },
])

// GPU computed
const vramPct  = computed(() => metrics.value.gpu?.vram_pct ?? 0)
const utilPct  = computed(() => metrics.value.gpu?.utilization_pct ?? 0)
const tempPct  = computed(() => {
  const t = metrics.value.gpu?.temperature_c
  return t != null ? Math.min(100, t) : 0
})
const vramLabel = computed(() => {
  const g = metrics.value.gpu
  if (!g?.vram_used_gb) return '—'
  return `${g.vram_used_gb.toFixed(1)} GB / ${g.vram_total_gb?.toFixed(1) ?? '—'} GB  (${(g.vram_pct ?? 0).toFixed(0)}%)`
})
const utilLabel = computed(() => {
  const p = metrics.value.gpu?.utilization_pct
  return p != null ? `${p}%` : 'n/a'
})
const tempLabel = computed(() => {
  const t = metrics.value.gpu?.temperature_c
  return t != null ? `${t} °C` : 'n/a'
})

// ── Chart ──────────────────────────────────────────────────────────────────

const chartSeries = ref([{ name: 'Loss', data: [] as { x: number; y: number }[] }])

const chartOptions = ref<ApexOptions>({
  chart: {
    type: 'area',
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    background: 'transparent',
  },
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.15,
      opacityTo: 0.01,
    },
  },
  colors: ['#58a6ff'],
  dataLabels: { enabled: false },
  xaxis: {
    type: 'numeric',
    title: { text: 'Step', style: { fontSize: '11px', color: '#8b949e' } },
    labels: { style: { colors: '#8b949e', fontSize: '11px' } },
    axisBorder: { show: false },
  },
  yaxis: {
    title: { text: 'Loss', style: { fontSize: '11px', color: '#8b949e' } },
    labels: { style: { colors: '#8b949e', fontSize: '11px' }, formatter: (v: number) => v.toFixed(4) },
  },
  grid: { borderColor: '#30363d', strokeDashArray: 4 },
  tooltip: {
    theme: 'dark',
    y: { formatter: (v: number) => v.toFixed(4) },
  },
  legend: { show: false },
})

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtSec(s?: number): string {
  if (s == null) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss.toString().padStart(2, '0')}s`
  return `${ss}s`
}

function fmtLr(v?: number): string {
  if (v == null) return '—'
  if (v < 0.0001) return v.toExponential(2)
  return v.toFixed(6)
}

// ── Polling ────────────────────────────────────────────────────────────────

async function poll() {
  try {
    const res = await fetch(METRICS_URL)
    if (!res.ok) throw new Error(`${res.status}`)
    const data: Metrics = await res.json()
    metrics.value = data
    serverError.value = false

    // Update chart
    if (data.history && data.history.length > 0) {
      chartSeries.value = [{
        name: 'Loss',
        data: data.history.map(h => ({ x: h.step, y: h.loss })),
      }]
    }

    // Update log
    if (data.step && data.step !== lastStep) {
      lastStep = data.step
      const entry: LogEntry = {
        ts: new Date().toLocaleTimeString(),
        step: data.step,
        loss: data.loss,
        lr: data.learning_rate,
      }
      logBuffer.value.push(entry)
      if (logBuffer.value.length > 40) logBuffer.value.shift()
    }
  } catch {
    serverError.value = true
  }

  pollTimer = setTimeout(poll, POLL_MS)
}

onMounted(() => { poll() })
onUnmounted(() => { if (pollTimer) clearTimeout(pollTimer) })
</script>

<style scoped>
.ai-training-page {
  padding: 0;
}

.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bs-secondary);
  vertical-align: middle;
}

.live-dot.pulse {
  background: #3fb950;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}

.log-area {
  font-family: monospace;
  font-size: 12px;
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-entry {
  display: flex;
  gap: 10px;
  color: var(--bs-body-color);
}

.log-ts {
  color: var(--bs-secondary-color);
  flex-shrink: 0;
}

.log-msg {
  color: var(--bs-body-color);
}
</style>
