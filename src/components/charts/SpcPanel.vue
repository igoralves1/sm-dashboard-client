<template>
  <!-- Collapsible "statistical model used": control chart + box plot (with interpretation) per series -->
  <div class="spc-panel">
    <button class="spc-toggle" @click="open = !open">
      <span class="spc-toggle__icon">▶ {{ t('spc.model_used') }}</span>
      <span class="spc-chevron" :class="{ open }">▾</span>
    </button>
    <div v-show="open" class="spc-body">
      <div class="spc-flow-grid">
        <div v-for="s in series" :key="s.name" class="spc-flow-col">
          <ControlChart
            :theme="theme"
            :data="s.values"
            :stats="s.stats"
            :unit="unit"
            :title="`Control Chart — ${s.name}`"
            :height="160"
          />
          <BoxPlot
            :theme="theme"
            :stats="s.stats"
            :unit="unit"
            :label="`${s.name} · ${label}`"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ControlChart from './ControlChart.vue'
import BoxPlot from './BoxPlot.vue'
import type { DataPoint } from '@/composables/useTimestreamDashboard'
import type { SensorStats } from '@/composables/useStatistics'

defineProps<{
  series: { name: string; values: DataPoint[]; stats: SensorStats | null }[]
  unit: string
  label: string
  theme?: 'dark' | 'light'
}>()

const { t } = useI18n()
const open = ref(false)
</script>

<style scoped>
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

:global(.theme-light .spc-panel) { border-top: 1px solid #e4eaf4; }
:global(.theme-light .spc-toggle__icon) {
  color: #8498bf;
  font-size: 0.7rem;
  font-weight: 700;
}
:global(.theme-light .spc-toggle:hover .spc-toggle__icon) { color: #009ee0; }
:global(.theme-light .spc-chevron) { color: #8498bf; }
:global(.theme-light .spc-flow-col) {
  background: linear-gradient(135deg, #f6f9fd, #eef3fb);
  border: 1px solid #dce6f0;
  border-radius: 8px;
}
</style>
