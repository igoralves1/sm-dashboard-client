<template>
  <!-- One water-supply indicator: value → meaning → action → working → sources -->
  <article class="ind" :class="`sev-${ind.severity}`">
    <header class="ind__head">
      <span class="ind__name">
        {{ t(`hidroforte.diag.${ind.kind}_name`) }}
        <span v-if="showSubject" class="ind__subject">· {{ ind.subject }}</span>
      </span>
      <span class="pill" :class="`sev-${ind.severity}`">{{ t(`energisa.diag.sev_${ind.severity}`) }}</span>
    </header>

    <div class="ind__value">
      {{ format(ind) }}<span class="ind__unit">{{ ind.unit }}</span>
    </div>

    <p class="ind__desc">{{ t(`hidroforte.diag.${ind.kind}_desc`, ind.params) }}</p>
    <p class="ind__assess">{{ assessment }}</p>

    <p v-if="action" class="ind__action">
      <Icon icon="tabler:tool" width="13" height="13" />
      <span>{{ action }}</span>
    </p>

    <!-- Working: the model, the arithmetic with the real numbers, and the scale -->
    <details class="ind__work">
      <summary>{{ t('energisa.diag.how') }}</summary>

      <p class="work__model">{{ t(`hidroforte.diag.${ind.kind}_model`) }}</p>

      <MathFormula v-if="ind.tex" :tex="ind.tex" :fallback="ind.formula" />
      <code v-else class="work__formula">{{ ind.formula }}</code>

      <div class="work__label">{{ t('energisa.diag.values_used') }}</div>
      <ul class="work__inputs">
        <li v-for="i in ind.inputs" :key="i.label">
          <span>{{ i.label }}</span><b>{{ i.value }}</b>
        </li>
      </ul>

      <div class="work__label">{{ t('energisa.diag.scale') }}</div>
      <ul class="work__bands">
        <li
          v-for="(b, n) in ind.bands"
          :key="n"
          :class="['band', `sev-${b.severity}`, { 'band--active': inBand(b) }]"
        >
          <span class="band__dot"></span>
          <span class="band__range">{{ bandLabel(b) }}</span>
          <span class="band__name">{{ t(`energisa.diag.band_${b.severity}`) }}</span>
          <span v-if="inBand(b)" class="band__here">← {{ t('energisa.diag.current_reading') }}</span>
        </li>
      </ul>

      <div class="work__label">{{ t('hidroforte.diag.why_thresholds') }}</div>
      <p class="work__model">{{ t(`hidroforte.diag.${ind.kind}_basis`) }}</p>
    </details>

    <!-- References at the end of the card -->
    <footer class="ind__refs">
      <span class="ind__refs-label">{{ t('hidroforte.diag.references') }}:</span>
      <a
        v-for="ref in refs"
        :key="ref.tag"
        :href="ref.url"
        target="_blank"
        rel="noopener noreferrer"
        class="ref-tag"
        :title="`${ref.name} — ${ref.note}`"
      >
        {{ ref.tag }}
        <Icon icon="tabler:external-link" width="10" height="10" />
      </a>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import MathFormula from './MathFormula.vue'
import type { Band } from '@/utils/energy/diagnostics'
import type { WaterIndicator } from '@/utils/water/diagnostics'
import { waterReferencesFor } from '@/utils/water/references'

const props = withDefaults(defineProps<{ ind: WaterIndicator; showSubject?: boolean }>(), { showSubject: true })

const { t, te } = useI18n()

const refs = computed(() => waterReferencesFor(props.ind.kind))

function format(ind: WaterIndicator): string {
  if (ind.value === null) return '—'
  if (ind.kind === 'trend' && ind.value >= 24) return '≥ 24'
  const d = ind.kind === 'anomalies' || ind.kind === 'telemetry' ? 0 : 1
  return ind.value.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d })
}

/** Severity-specific sentence, falling back to the next mildest that exists. */
function pick(suffix: string): string {
  const order = ['critical', 'warning', 'watch', 'good']
  const from = order.indexOf(props.ind.severity)
  for (const level of order.slice(from < 0 ? 0 : from)) {
    const key = `hidroforte.diag.${props.ind.kind}_${suffix ? suffix + '_' : ''}${level}`
    if (te(key)) return t(key, props.ind.params)
  }
  return ''
}

const assessment = computed(() => pick(''))
// No action line on a healthy card — it would train operators to ignore it.
const action = computed(() => (props.ind.severity === 'good' ? '' : pick('action')))

function inBand(b: Band): boolean {
  const v = props.ind.value
  if (v === null) return false
  return (b.from === null || v >= b.from) && (b.to === null || v < b.to)
}

function bandLabel(b: Band): string {
  const u = props.ind.unit ? ` ${props.ind.unit}` : ''
  if (b.from === null && b.to !== null) return `${t('energisa.diag.below')} ${b.to}${u}`
  if (b.to === null && b.from !== null) return `${t('energisa.diag.above')} ${b.from}${u}`
  return `${b.from} – ${b.to}${u}`
}
</script>

<style scoped>
/* Same visual language as DiagnosticsPanel (Energisa device page) */
.ind {
  border: 1px solid var(--bs-border-color);
  border-left: 3px solid currentColor;
  border-radius: 6px;
  padding: 0.7rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.ind__head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.ind__name { font-size: 12.5px; font-weight: 600; color: var(--bs-body-color); }
.ind__subject { font-weight: 500; color: var(--bs-secondary-color); }
.ind__value {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--bs-body-color);
  line-height: 1.1;
}
.ind__unit { font-size: 12px; font-weight: 400; color: var(--bs-secondary-color); margin-left: 2px; }
.ind__desc, .ind__assess, .ind__action { margin: 0; font-size: 11.5px; line-height: 1.5; }
.ind__desc { color: var(--bs-secondary-color); }
.ind__assess { color: var(--bs-body-color); }
.ind__action {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: currentColor;
  font-weight: 500;
  padding-top: 0.3rem;
  border-top: 1px dashed var(--bs-border-color);
}
.ind__action svg { flex: none; margin-top: 2px; }

.sev-good { color: var(--bs-success); }
.sev-watch { color: var(--bs-info, #0dcaf0); }
.sev-warning { color: var(--bs-warning); }
.sev-critical { color: var(--bs-danger); }
.sev-unknown { color: var(--bs-secondary-color); }

.pill {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  white-space: nowrap;
}

.ind__work { margin-top: 0.2rem; }
.ind__work summary {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--bs-secondary-color);
  cursor: pointer;
  list-style: none;
}
.ind__work summary::-webkit-details-marker { display: none; }
.ind__work summary::before { content: '⌄ '; }
.ind__work[open] summary::before { content: '⌃ '; }
.ind__work summary:hover { color: var(--bs-body-color); }
.ind__work[open] summary { margin-bottom: 0.4rem; }

.work__model {
  margin: 0 0 0.4rem;
  font-size: 11px;
  line-height: 1.55;
  color: var(--bs-body-color);
}
.work__formula {
  display: block;
  font-size: 10.5px;
  line-height: 1.6;
  padding: 0.4rem 0.55rem;
  border-radius: 4px;
  background: var(--bs-tertiary-bg, rgb(0 0 0 / 0.035));
  color: var(--bs-body-color);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.work__label {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bs-secondary-color);
  margin: 0.55rem 0 0.2rem;
}
.work__inputs, .work__bands { list-style: none; margin: 0; padding: 0; font-size: 10.5px; }
.work__inputs li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.12rem 0;
  color: var(--bs-secondary-color);
  border-bottom: 1px dotted var(--bs-border-color);
}
.work__inputs b { color: var(--bs-body-color); font-variant-numeric: tabular-nums; text-align: right; }

.band { display: flex; align-items: center; gap: 0.35rem; padding: 0.14rem 0.25rem; border-radius: 3px; }
.band.sev-good { color: var(--bs-success); }
.band.sev-watch { color: var(--bs-info, #0dcaf0); }
.band.sev-warning { color: var(--bs-warning); }
.band.sev-critical { color: var(--bs-danger); }
.band--active { background: var(--bs-tertiary-bg, rgb(0 0 0 / 0.05)); font-weight: 600; }
.band__dot { width: 7px; height: 7px; border-radius: 2px; background: currentColor; flex: none; }
.band__range { font-variant-numeric: tabular-nums; font-weight: 600; }
.band__name { text-transform: lowercase; }
.band__here { margin-left: auto; font-size: 9.5px; white-space: nowrap; }

.ind__refs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin-top: auto;
  padding-top: 0.4rem;
  border-top: 1px solid var(--bs-border-color);
}
.ind__refs-label {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bs-secondary-color);
}
.ref-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--bs-border-color);
  color: var(--bs-secondary-color);
  text-decoration: none;
  white-space: nowrap;
}
.ref-tag:hover { color: var(--bs-primary); border-color: var(--bs-primary); }
</style>
