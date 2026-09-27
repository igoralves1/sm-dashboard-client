<template>
  <div v-if="note" class="note" :class="`sev-${note.severity}`">
    <p class="note__assess">{{ t(`energisa.wave.${note.key}_${note.severity}`, note.params) }}</p>

    <details class="note__work">
      <summary>{{ t('energisa.diag.how') }}</summary>

      <p class="note__desc">{{ t(`energisa.wave.${note.key}_desc`) }}</p>

      <MathFormula :tex="note.tex" :fallback="note.formula" />

      <div class="note__label">{{ t('energisa.diag.values_used') }}</div>
      <ul class="note__readings">
        <li v-for="r in note.readings" :key="r.label">
          <span>{{ r.label }}</span><b>{{ r.value }}</b>
        </li>
      </ul>

      <div v-if="refs.length" class="note__refs">
        <a
          v-for="ref in refs"
          :key="ref.tag"
          :href="ref.url"
          target="_blank"
          rel="noopener noreferrer"
          class="ref-tag"
          :title="ref.name"
        >
          {{ ref.tag }}
          <Icon icon="tabler:external-link" width="10" height="10" />
        </a>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
/**
 * Reading and interpretation for one waveform panel.
 *
 * Mirrors the condition indicators: a one-line verdict always visible, with
 * the formula, the numbers behind it and the source document folded away
 * behind the same "how this was calculated" affordance used elsewhere.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import MathFormula from './MathFormula.vue'
import { REFERENCES } from '@/utils/energy/references'
import type { AnalysisNote } from '@/utils/energy/waveformAnalysis'

const { t } = useI18n()

const props = defineProps<{ note: AnalysisNote | null }>()

/** Which documents back this particular panel. */
const REF_MAP: Record<string, string[]> = {
  temporal: ['IEEE 1159'],
  phasor: ['IEEE 1159'],
  harmonics: ['PRODIST M8', 'IEEE 1159'],
}

const refs = computed(() => {
  const wanted = REF_MAP[props.note?.key ?? ''] ?? []
  return REFERENCES.filter((r) => wanted.includes(r.tag))
})
</script>

<style scoped>
.note {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--bs-border-color);
}

.note__assess {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--bs-body-color);
}

.note__work { margin-top: 0.4rem; }

.note__work summary {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--bs-secondary-color);
  cursor: pointer;
  list-style: none;
}

.note__work summary::-webkit-details-marker { display: none; }
.note__work summary::before { content: '⌄ '; }
.note__work[open] summary::before { content: '⌃ '; }
.note__work summary:hover { color: var(--bs-body-color); }

.note__desc {
  margin: 0.4rem 0;
  font-size: 11px;
  line-height: 1.55;
  color: var(--bs-secondary-color);
}

.note__label {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bs-secondary-color);
  margin: 0.55rem 0 0.2rem;
}

.note__readings { list-style: none; margin: 0; padding: 0; font-size: 10.5px; }

.note__readings li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.12rem 0;
  color: var(--bs-secondary-color);
  border-bottom: 1px dotted var(--bs-border-color);
}

.note__readings b { color: var(--bs-body-color); font-variant-numeric: tabular-nums; white-space: nowrap; }

.note__refs { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.5rem; }

.ref-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 9.5px;
  font-weight: 500;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--bs-border-color);
  color: var(--bs-secondary-color);
  text-decoration: none;
  white-space: nowrap;
}

.ref-tag:hover { color: var(--bs-primary); border-color: var(--bs-primary); }

.sev-good { color: var(--bs-success); }
.sev-watch { color: var(--bs-info, #0dcaf0); }
.sev-warning { color: var(--bs-warning); }
.sev-critical { color: var(--bs-danger); }
.sev-unknown { color: var(--bs-secondary-color); }
</style>
