<template>
  <div class="dashboard-sm">
    <div class="page-header mb-4">
      <div class="d-flex justify-content-between align-items-center">
        <h3 class="page-title">HidroForte Dashboard</h3>
        <button class="export-btn" @click="exportLog()" :title="`Export ${getSnapshotCount()} snapshots`">
          ↓ Export JSON
        </button>
      </div>
      <small class="text-muted">
        <span v-if="loading">⏳ Loading...</span>
        <span v-else-if="error" class="text-danger">⚠ {{ error }}</span>
        <span v-else>Last updated: {{ lastUpdated }} · Auto-refresh every 5 min · {{ getSnapshotCount() }} snapshots logged</span>
      </small>
    </div>

    <!-- ═══ SILVANÓPOLIS ═══ -->
    <div class="section-label">▾ Silvanópolis</div>
    <div class="row g-3 mb-4">
      <!-- Tank -->
      <div class="col-lg-3 col-md-4">
        <div class="chart-card d-flex flex-column align-items-center justify-content-center py-3">
          <TankGauge :value="silvanopolis.level" :size="200" />
        </div>
      </div>
      <!-- Level time series -->
      <div class="col-lg-9 col-md-8">
        <div class="chart-card">
          <div class="chart-title">Nível RAP01 Silvanópolis</div>
          <LevelTimeSeries :data="silvanopolis.levelSeries" :thresholds="levelThresholds" />
        </div>
      </div>
      <!-- Flow PTPs -->
      <div class="col-12">
        <div class="chart-card">
          <div class="chart-title">Vazao PTPs Silvanópolis</div>
          <FlowTimeSeries :data="silvanopolis.flowSeries" />
        </div>
      </div>
      <!-- Bar charts -->
      <div class="col-lg-6">
        <div class="chart-card">
          <div class="chart-title">PTPs Silvanópolis - Produção m³/h - 24h</div>
          <ProductionBar :data="silvanopolis.production24h" x-field="hour" />
        </div>
      </div>
      <div class="col-lg-6">
        <div class="chart-card">
          <div class="chart-title">PTPs Silvanópolis - Produção m³ diária</div>
          <ProductionBar :data="silvanopolis.productionDaily" x-field="day" />
        </div>
      </div>
    </div>

    <!-- ═══ MIRANORTE ═══ -->
    <div class="section-label">▾ Miranorte</div>
    <div class="row g-3">
      <!-- Tank -->
      <div class="col-lg-3 col-md-4">
        <div class="chart-card d-flex flex-column align-items-center justify-content-center py-3">
          <TankGauge :value="miranorte.level" :size="200" />
        </div>
      </div>
      <!-- Level time series -->
      <div class="col-lg-9 col-md-8">
        <div class="chart-card">
          <div class="chart-title">Nível RAP01 Miranorte</div>
          <LevelTimeSeries :data="miranorte.levelSeries" :thresholds="levelThresholds" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import TankGauge from '@/components/charts/TankGauge.vue'
import LevelTimeSeries from '@/components/charts/LevelTimeSeries.vue'
import FlowTimeSeries from '@/components/charts/FlowTimeSeries.vue'
import ProductionBar from '@/components/charts/ProductionBar.vue'
import { useTimestreamDashboard } from '@/composables/useTimestreamDashboard'
import { exportLog, getSnapshotCount } from '@/composables/useDashboardLogger'

const { silvanopolis, miranorte, loading, error, lastUpdated, refresh } = useTimestreamDashboard()

// ── Threshold lines (matching Grafana) ──
const levelThresholds = [
  { value: 25, color: '#f4954e', dash: '6,3' },
  { value: 50, color: '#f4954e', dash: '6,3' },
  { value: 75, color: '#73bf69', dash: '6,3' },
  { value: 100, color: '#73bf69', dash: '6,3' },
]

// ── Auto-refresh every 5 min ──
let refreshTimer: ReturnType<typeof setInterval>
onMounted(async () => {
  await refresh()
  refreshTimer = setInterval(refresh, 5 * 60 * 1000)
})
onUnmounted(() => clearInterval(refreshTimer))
</script>

<style scoped>
.dashboard-sm {
  padding: 1.5rem;
  background: #111217;
  min-height: 100vh;
  color: #d0d0d0;
}
.page-header { border-bottom: 1px solid #2a2a2a; padding-bottom: 0.75rem; }
.page-title { color: #e0e0e0; font-size: 1.4rem; margin: 0; }
.section-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #222;
}
.chart-card {
  background: #181b20;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 1rem;
  height: 100%;
}
.chart-title {
  font-size: 0.82rem;
  color: #aaa;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
.export-btn {
  background: #1e2330;
  border: 1px solid #3a3f55;
  color: #8ab4f8;
  padding: 0.3rem 0.8rem;
  border-radius: 5px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s;
}
.export-btn:hover { background: #252c3f; }
</style>
