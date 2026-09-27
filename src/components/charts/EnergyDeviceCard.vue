<template>
  <div class="card h-100 device-card" :class="`health-${severity}`" role="button" tabindex="0" @click="$emit('open')" @keydown.enter="$emit('open')">
    <div class="card-body">
      <!-- Identity sits beside the chip: the icon left a dead column otherwise -->
      <div class="head">
        <span class="device-chip" aria-hidden="true">
          <Icon icon="tabler:cpu" width="22" height="22" />
        </span>

        <div class="head__id">
          <h6 class="head__name" :title="device.name">{{ device.name }}</h6>
          <div class="head__place">{{ device.location ?? '—' }}</div>
          <div class="last-seen">
            <Icon icon="tabler:clock" width="11" height="11" />
            <span>{{ t('energisa.last_seen') }}: {{ lastSeen }}</span>
          </div>
        </div>

        <div class="head__status">
          <Icon
            :icon="device.online ? 'tabler:wifi' : 'tabler:wifi-off'"
            :class="device.online ? 'text-success' : 'text-danger'"
            width="18"
            height="18"
          />
          <Icon
            :icon="device.favourite ? 'tabler:star-filled' : 'tabler:star'"
            class="text-primary"
            width="18"
            height="18"
          />
        </div>
      </div>

      <!-- Condition summary -->
      <div v-if="diagnostics" class="health-row" :class="`sev-${severity}`">
        <div class="health-ring">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9" class="ring-track" />
            <circle cx="18" cy="18" r="15.9" class="ring-value"
                    :stroke-dasharray="`${diagnostics.healthIndex ?? 0} 100`" />
          </svg>
          <span class="health-ring__n">{{ Math.round(diagnostics.healthIndex ?? 0) }}</span>
        </div>

        <div class="health-info">
          <span class="health-badge">{{ t(`energisa.diag.sev_${severity}`) }}</span>
          <div v-if="flagged.length" class="health-flags" :title="flaggedFull">
            {{ flagged.join(' · ') }}
          </div>
          <div v-else class="health-flags health-flags--ok">
            {{ t('energisa.diag.all_normal') }}
          </div>
        </div>
      </div>

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
import type { Diagnostics } from '@/utils/energy/diagnostics'

const { t } = useI18n()

const props = defineProps<{
  device: EnergisaDevice
  summary: DeviceSummary
  /** Full condition assessment; null while the device is offline. */
  diagnostics?: Diagnostics | null
  lastSeen?: string
}>()

/** Stripe and badge follow the worst indicator. */
const severity = computed(() => props.diagnostics?.healthSeverity ?? 'unknown')

/**
 * Indicators at warning or critical, named — the reason the asset is flagged.
 * Showing "Atenção" alone tells an operator nothing about where to look.
 */
const flagged = computed(() =>
  (props.diagnostics?.indicators ?? [])
    .filter((i) => i.severity === 'warning' || i.severity === 'critical')
    .map((i) => t(`energisa.diag.${i.key}_name`)),
)

const flaggedFull = computed(() => flagged.value.join(', '))
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
/* A left stripe carries the condition, so health reads at a glance across the
   grid without hunting for a badge inside each card. */
.device-card {
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
  border-left: 4px solid var(--health, var(--bs-border-color));
}

.health-good { --health: var(--bs-success); }
.health-watch { --health: var(--bs-info, #0dcaf0); }
.health-warning { --health: var(--bs-warning); }
.health-critical { --health: var(--bs-danger); }
.health-unknown { --health: var(--bs-border-color); }

.head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.head__id { flex: 1; min-width: 0; }

.head__name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head__place {
  font-size: 11.5px;
  color: var(--bs-secondary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head__status { display: flex; align-items: center; gap: 0.4rem; flex: none; }

.health-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.5rem;
  margin-top: 0.15rem;
  border-radius: 5px;
  background: var(--bs-tertiary-bg, rgb(0 0 0 / 0.03));
}

.health-ring { position: relative; width: 34px; height: 34px; flex: none; }
.health-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }

.ring-track,
.ring-value { fill: none; stroke-width: 3.4; stroke-linecap: round; }

.ring-track { stroke: var(--bs-border-color); }
.ring-value { stroke: currentColor; transition: stroke-dasharray 0.4s ease; }

.health-ring__n {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--bs-body-color);
}

.health-info { min-width: 0; }

.health-badge {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: currentColor;
}

.health-flags {
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--bs-secondary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.health-flags--ok { color: var(--bs-success); }

.sev-good { color: var(--bs-success); }
.sev-watch { color: var(--bs-info, #0dcaf0); }
.sev-warning { color: var(--bs-warning); }
.sev-critical { color: var(--bs-danger); }
.sev-unknown { color: var(--bs-secondary-color); }

.last-seen {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 10.5px;
  color: var(--bs-secondary-color);
  margin-top: 2px;
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
