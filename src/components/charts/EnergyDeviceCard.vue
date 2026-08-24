<template>
  <div class="card h-100 device-card" role="button" tabindex="0" @click="$emit('open')" @keydown.enter="$emit('open')">
    <div class="card-body">
      <!-- Icon + status -->
      <div class="d-flex align-items-start justify-content-between mb-3">
        <span class="device-chip" aria-hidden="true">
          <Icon icon="tabler:cpu" width="22" height="22" />
        </span>

        <div class="d-flex align-items-center gap-2">
          <Icon
            :icon="device.online ? 'tabler:wifi' : 'tabler:wifi-off'"
            :class="device.online ? 'text-success' : 'text-danger'"
            width="20"
            height="20"
          />
          <Icon
            :icon="device.favourite ? 'tabler:star-filled' : 'tabler:star'"
            class="text-primary"
            width="20"
            height="20"
          />
        </div>
      </div>

      <!-- Identity -->
      <h6 class="mb-1 fw-semibold text-truncate" :title="device.name">{{ device.name }}</h6>
      <div class="text-muted mb-3" style="font-size: 12px">{{ device.location ?? '—' }}</div>

      <hr class="my-2" />

      <!-- Metrics -->
      <div class="row g-2 metric-grid">
        <div class="col-6">
          <div class="metric-label">{{ t('energisa.total_power') }}</div>
          <div class="metric-value">{{ power }}</div>
        </div>
        <div class="col-6 border-start ps-3">
          <div class="metric-label">{{ t('energisa.consumption_today') }}</div>
          <div class="metric-value">{{ consumption }}</div>
        </div>

        <template v-if="showLoadRow">
          <div class="col-6">
            <div class="metric-label">{{ t('energisa.load_factor') }}</div>
            <div class="metric-value" :class="loadFactorClass">{{ loadFactor }}</div>
          </div>
          <div class="col-6 border-start ps-3">
            <div class="metric-label">{{ t('energisa.temperature') }}</div>
            <div class="metric-value">{{ temperature }}</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { DeviceSummary, EnergisaDevice } from '@/services/energisa/types'

const { t } = useI18n()

const props = defineProps<{ device: EnergisaDevice; summary: DeviceSummary }>()
defineEmits<{ open: [] }>()

/**
 * Production's number format (beautifyFalseNumber + formatThousandUnits):
 * falsy/NaN renders as "-", anything above 1000 is divided by 1000, and the
 * result is fixed to two decimals.
 */
function beautify(value: number | null): string {
  if (!value || !Number.isFinite(value)) return '-'
  return (value / (value > 1000 ? 1000 : 1)).toFixed(2)
}

/**
 * The "k" prefix keys off *power* for both tiles — including the consumption
 * one. That is a quirk of the production card (the unit is rendered as
 * `{potency > 1000 ? ' k' : ' '}Wh`), reproduced here so the two dashboards
 * read identically side by side.
 */
const kPrefix = computed(() => ((props.summary.totalPower ?? 0) > 1000 ? ' k' : ' '))

const power = computed(() => `${beautify(props.summary.totalPower)}${kPrefix.value}W`)
const consumption = computed(() => `${beautify(props.summary.consumptionToday)}${kPrefix.value}Wh`)
const loadFactor = computed(() => `${beautify(props.summary.loadFactor)} %`)
const temperature = computed(() => `${beautify(props.summary.temperature)} °C`)

/** Only TRAFO things report load factor and temperature. */
const showLoadRow = computed(() => props.device.thingType === 'TRAFO')

/** Same thresholds the rest of the dashboard uses for level bands. */
const loadFactorClass = computed(() => {
  const value = props.summary.loadFactor
  if (value === null) return ''
  if (value >= 80) return 'text-danger'
  if (value >= 50) return 'text-warning'
  return ''
})
</script>

<style scoped>
.device-card {
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.device-card:hover,
.device-card:focus-visible {
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
  transform: translateY(-1px);
}

.device-chip {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--bs-primary-bg-subtle, rgb(28 132 198 / 0.12));
  color: var(--bs-primary, #1c84c6);
  font-size: 20px;
}

.metric-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bs-secondary-color);
  line-height: 1.3;
}

.metric-value {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
