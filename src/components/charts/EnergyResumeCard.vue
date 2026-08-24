<template>
  <div class="card h-100">
    <div class="card-body">
      <div class="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div class="resume-title">{{ t('energisa.consumption_ch', { n: channel }) }}</div>
          <div class="resume-value">{{ beautify(energySum) }} kWh</div>
        </div>

        <button
          type="button"
          class="resume-toggle"
          :aria-expanded="expanded"
          @click="$emit('update:expanded', !expanded)"
        >
          <span>{{ t('energisa.see_details') }}</span>
          <Icon :icon="expanded ? 'tabler:chevron-up' : 'tabler:chevron-down'" width="14" height="14" />
        </button>
      </div>

      <div v-if="expanded" class="resume-detail">
        <div v-for="row in rows" :key="row.label" class="resume-row">
          <div class="resume-row__label">{{ row.label }}</div>
          <div class="resume-stats">
            <div v-for="stat in row.stats" :key="stat.label" class="resume-stat">
              <div class="resume-stat__label">{{ stat.label }}</div>
              <div class="resume-stat__value">
                {{ stat.value }}<span class="resume-stat__unit">{{ row.unitPrefix }}{{ row.unit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Consumo CH card with the expandable V / I / P breakdown.
 *
 * Port of EnergyResumeCard.tsx. The scaling rule is per row, not per value:
 * if *any* of max/mean/min reaches 1000, all three are divided by 1000 and the
 * unit gains a "k" prefix — so the three numbers stay comparable at a glance
 * instead of one silently switching units.
 */
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { ChannelStats } from '@/services/energisa/types'

const { t } = useI18n()

const props = defineProps<{
  channel: number
  energySum: number
  metrics: ChannelStats | undefined
  /**
   * Owned by the parent, not the card: the three channel cards expand and
   * collapse together, so toggling one has to move the other two. Keeping the
   * state local would let them drift out of sync.
   */
  expanded: boolean
}>()

defineEmits<{ 'update:expanded': [boolean] }>()

/** Production's beautifyFalseNumber. */
function beautify(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return '-'
  return (value / (value > 1000 ? 1000 : 1)).toFixed(2)
}

function buildRow(label: string, unit: string, spread: { min: number; med: number; max: number } | undefined) {
  const values = [spread?.max, spread?.med, spread?.min]
  const isThousand = values.some((v) => Number.isFinite(v) && Math.abs(v as number) >= 1000)
  const scale = isThousand ? 1000 : 1

  return {
    label,
    unit,
    unitPrefix: isThousand ? 'k' : '',
    stats: [
      { label: t('energisa.max'), value: beautify((spread?.max ?? 0) / scale) },
      { label: t('energisa.avg'), value: beautify((spread?.med ?? 0) / scale) },
      { label: t('energisa.min'), value: beautify((spread?.min ?? 0) / scale) },
    ],
  }
}

const rows = computed(() => [
  buildRow(`V CH${props.channel}`, 'V', props.metrics?.vef),
  buildRow(`I CH${props.channel}`, 'A', props.metrics?.ief),
  buildRow(`P CH${props.channel}`, 'W', props.metrics?.pef),
])
</script>

<style scoped>
.resume-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--bs-secondary-color);
}

.resume-value {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.resume-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 11.5px;
  color: var(--bs-secondary-color);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}

.resume-toggle:hover { color: var(--bs-primary); }
.resume-toggle:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 2px; border-radius: 3px; }

.resume-detail {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.resume-row {
  border-top: 1px solid var(--bs-border-color);
  padding-top: 0.55rem;
}

.resume-row__label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 0.3rem;
}

.resume-stats { display: flex; gap: 0.5rem; }

.resume-stat { flex: 1; min-width: 0; }

.resume-stat__label {
  font-size: 11px;
  color: var(--bs-secondary-color);
}

.resume-stat__value {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.resume-stat__unit {
  font-size: 9.5px;
  font-weight: 400;
  color: var(--bs-secondary-color);
  margin-left: 2px;
}
</style>
