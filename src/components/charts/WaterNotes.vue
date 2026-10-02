<template>
  <!-- Notes & considerations at the end of a chart card: what the standards say about
       what this chart shows, the indicators derived from it, and the sources. -->
  <section class="notes">
    <button class="notes__toggle" @click="open = !open">
      <Icon icon="tabler:notes" width="14" height="14" />
      <span>{{ t('hidroforte.diag.notes_title') }}</span>
      <span v-if="worst !== 'unknown'" class="pill" :class="`sev-${worst}`">{{ t(`energisa.diag.sev_${worst}`) }}</span>
      <span class="notes__chevron" :class="{ open }">▾</span>
    </button>

    <div v-show="open" class="notes__body">
      <p class="notes__intro">{{ t(`hidroforte.diag.notes_${context}`) }}</p>

      <div v-if="measurable.length" class="notes__grid">
        <WaterIndicatorCard v-for="ind in measurable" :key="ind.key" :ind="ind" :show-subject="showSubject" />
      </div>
      <p v-else class="text-muted notes__empty">{{ t('hidroforte.diag.no_data') }}</p>

      <footer class="notes__refs">
        <div class="notes__refs-label">{{ t('hidroforte.diag.references') }}</div>
        <ol class="notes__refs-list">
          <li v-for="ref in refs" :key="ref.tag">
            <a :href="ref.url" target="_blank" rel="noopener noreferrer">
              <b>{{ ref.tag }}</b> — {{ ref.name }}
              <Icon icon="tabler:external-link" width="10" height="10" />
            </a>
            <div class="notes__refs-note">{{ ref.note }}</div>
          </li>
        </ol>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import WaterIndicatorCard from './WaterIndicatorCard.vue'
import type { Severity } from '@/utils/energy/diagnostics'
import type { WaterIndicator, WaterKind } from '@/utils/water/diagnostics'
import { WATER_REFERENCES } from '@/utils/water/references'

const props = withDefaults(defineProps<{
  /** Indicators relevant to this chart. */
  indicators: WaterIndicator[]
  /** Which chart: picks the intro text `hidroforte.diag.notes_<context>`. */
  context: 'level' | 'flow' | 'production'
  /** Extra reference families to list even without an indicator (e.g. SPC for charts). */
  extraKinds?: WaterKind[]
  showSubject?: boolean
}>(), { extraKinds: () => [], showSubject: false })

const { t } = useI18n()
const open = ref(false)

const measurable = computed(() => props.indicators.filter(i => i.severity !== 'unknown' && i.value !== null))

const RANK: Record<Severity, number> = { unknown: 0, good: 1, watch: 2, warning: 3, critical: 4 }
const worst = computed<Severity>(() =>
  measurable.value.reduce<Severity>((w, i) => (RANK[i.severity] > RANK[w] ? i.severity : w), 'unknown'),
)

const refs = computed(() => {
  const kinds = new Set<string>([...props.indicators.map(i => i.kind), ...props.extraKinds])
  return WATER_REFERENCES.filter(r => r.covers.some(k => kinds.has(k)))
})
</script>

<style scoped>
.notes {
  margin-top: 10px;
  border-top: 1px solid var(--bs-border-color);
  padding-top: 6px;
}
.notes__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  background: none;
  border: none;
  padding: 4px 2px;
  cursor: pointer;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}
.notes__toggle:hover { color: var(--bs-body-color); }
.notes__chevron { margin-left: auto; font-size: 14px; transition: transform 0.2s; }
.notes__chevron.open { transform: rotate(180deg); }

.notes__body { padding: 8px 2px 4px; }
.notes__intro { font-size: 12px; line-height: 1.6; color: var(--bs-body-color); margin: 0 0 0.75rem; }
.notes__empty { font-size: 12px; }
.notes__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
}

.notes__refs { margin-top: 0.85rem; padding-top: 0.6rem; border-top: 1px solid var(--bs-border-color); }
.notes__refs-label {
  font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--bs-secondary-color); margin-bottom: 0.25rem;
}
.notes__refs-list { margin: 0; padding-left: 1.1rem; font-size: 10.5px; line-height: 1.6; color: var(--bs-secondary-color); }
.notes__refs-list li { margin-bottom: 0.25rem; }
.notes__refs-list a { color: inherit; text-decoration: none; display: inline-flex; align-items: baseline; gap: 0.2rem; }
.notes__refs-list a b { color: var(--bs-body-color); }
.notes__refs-list a:hover { color: var(--bs-primary); text-decoration: underline; }
.notes__refs-note { font-size: 10px; color: var(--bs-secondary-color); opacity: 0.85; }

.sev-good { color: var(--bs-success); }
.sev-watch { color: var(--bs-info, #0dcaf0); }
.sev-warning { color: var(--bs-warning); }
.sev-critical { color: var(--bs-danger); }
.pill {
  font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 0.08rem 0.4rem; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap;
}
</style>
