<template>
  <div class="card">
    <div class="card-body">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h6 class="panel-title mb-0">{{ t('energisa.diag.title') }}</h6>

        <div v-if="diagnostics.healthIndex !== null" class="health">
          <div class="health__meter" :class="`sev-${diagnostics.healthSeverity}`">
            <svg viewBox="0 0 36 36" class="health__ring" aria-hidden="true">
              <circle cx="18" cy="18" r="15.9" class="health__track" />
              <circle
                cx="18" cy="18" r="15.9"
                class="health__value"
                :stroke-dasharray="`${diagnostics.healthIndex} 100`"
              />
            </svg>
            <span class="health__number">{{ Math.round(diagnostics.healthIndex) }}</span>
          </div>
          <div class="health__text">
            <div class="health__top">
              <span class="health__label">{{ t('energisa.diag.health_index') }}</span>
              <span class="pill" :class="`sev-${diagnostics.healthSeverity}`">
                {{ t(`energisa.diag.sev_${diagnostics.healthSeverity}`) }}
              </span>
            </div>
            <a class="how-link" role="button" tabindex="0"
               @click="showMethod = !showMethod" @keydown.enter="showMethod = !showMethod">
              {{ showMethod ? '⌃' : '⌄' }} {{ t('energisa.diag.method_toggle') }}
            </a>
          </div>
        </div>
      </div>

      <!-- Methodology: where the rating comes from -->
      <section v-if="showMethod" class="method">
        <div class="method__col">
          <h6 class="method__h">{{ t('energisa.diag.method_what') }}</h6>
          <p class="method__p">{{ t('energisa.diag.method_what_text') }}</p>

          <h6 class="method__h">{{ t('energisa.diag.method_rule') }}</h6>
          <ul class="rules">
            <li class="rule sev-critical">
              <span class="rule__dot"></span>{{ t('energisa.diag.method_rule_critical') }}
            </li>
            <li class="rule sev-good">
              <span class="rule__dot"></span>{{ t('energisa.diag.method_rule_good') }}
            </li>
            <li class="rule sev-warning">
              <span class="rule__dot"></span>{{ t('energisa.diag.method_rule_warning') }}
            </li>
          </ul>
        </div>

        <div class="method__col">
          <h6 class="method__h">{{ t('energisa.diag.method_inputs') }}</h6>
          <p class="method__p">{{ t('energisa.diag.method_inputs_text') }}</p>

          <h6 class="method__h">{{ t('energisa.diag.method_where') }}</h6>
          <p class="method__p">{{ t('energisa.diag.method_where_text') }}</p>

          <h6 class="method__h">{{ t('energisa.diag.method_number') }}</h6>
          <p class="method__p">{{ t('energisa.diag.method_number_text') }}</p>

          <table v-if="scored.length" class="calc">
            <tbody>
              <tr v-for="row in scored" :key="row.key">
                <th :class="`sev-${row.severity}`">{{ t(`energisa.diag.${row.key}_name`) }}</th>
                <td>{{ row.score }}</td>
                <td class="calc__op">×</td>
                <td>{{ row.weight }}</td>
                <td class="calc__op">=</td>
                <td class="calc__prod">{{ row.product }}</td>
              </tr>
              <tr class="calc__total">
                <th>{{ t('energisa.diag.method_number_total') }}</th>
                <td colspan="4">{{ totalProducts }} ÷ {{ totalWeight }}</td>
                <td class="calc__prod">{{ Math.round(diagnostics.healthIndex ?? 0) }}</td>
              </tr>
            </tbody>
          </table>

          <p class="method__p method__p--sep">{{ t('energisa.diag.method_number_vs_label') }}</p>

          <ul class="method__sources">
            <li v-for="ref in REFERENCES" :key="ref.tag">
              <a :href="ref.url" target="_blank" rel="noopener noreferrer">
                <b>{{ ref.tag }}</b> — {{ ref.name }}
                <Icon icon="tabler:external-link" width="10" height="10" />
              </a>
            </li>
          </ul>

          <p class="method__caveat">{{ t('energisa.diag.method_caveat') }}</p>
        </div>
      </section>

      <p v-if="!measurable.length" class="text-muted mb-0 empty">{{ t('energisa.diag.no_data') }}</p>

      <div v-else class="grid">
        <article v-for="ind in measurable" :key="ind.key" class="ind" :class="`sev-${ind.severity}`">
          <header class="ind__head">
            <span class="ind__name">{{ t(`energisa.diag.${ind.key}_name`) }}</span>
            <span class="pill" :class="`sev-${ind.severity}`">
              {{ t(`energisa.diag.sev_${ind.severity}`) }}
            </span>
          </header>

          <div class="ind__value">
            {{ format(ind) }}<span class="ind__unit">{{ ind.unit }}</span>
          </div>

          <p class="ind__desc">{{ t(`energisa.diag.${ind.key}_desc`, ind.params) }}</p>
          <p class="ind__assess">{{ assessment(ind) }}</p>

          <p v-if="action(ind)" class="ind__action">
            <Icon icon="tabler:tool" width="13" height="13" />
            <span>{{ action(ind) }}</span>
          </p>

          <!-- Working: the arithmetic with the real numbers in it -->
          <details class="ind__work">
            <summary>{{ t('energisa.diag.how') }}</summary>

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
                :class="['band', `sev-${b.severity}`, { 'band--active': inBand(ind, b) }]"
              >
                <span class="band__dot"></span>
                <span class="band__range">{{ bandLabel(b, ind.unit) }}</span>
                <span class="band__name">{{ t(`energisa.diag.band_${b.severity}`) }}</span>
                <span v-if="inBand(ind, b)" class="band__here">← {{ t('energisa.diag.current_reading') }}</span>
              </li>
            </ul>
          </details>

          <div v-if="refsFor(ind.key).length" class="ind__refs">
            <a
              v-for="ref in refsFor(ind.key)"
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
        </article>
      </div>

      <footer v-if="measurable.length" class="basis">
        <p class="basis__text">{{ t('energisa.diag.basis') }}</p>
        <div class="basis__label">{{ t('energisa.diag.sources') }}</div>
        <ul class="basis__list">
          <li v-for="ref in REFERENCES" :key="ref.tag">
            <a :href="ref.url" target="_blank" rel="noopener noreferrer">
              {{ ref.name }}
              <Icon icon="tabler:external-link" width="10" height="10" />
            </a>
          </li>
        </ul>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Condition analysis for one transformer.
 *
 * Every indicator carries three layers of copy: what the number *is*, what it
 * *means* at this value, and what to *do* about it. The action line only
 * appears when there is something to act on — a panel of green cards each
 * suggesting maintenance would train operators to ignore it.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { analyse, type Band, type Indicator } from '@/utils/energy/diagnostics'
import { REFERENCES, referencesFor } from '@/utils/energy/references'
import MathFormula from './MathFormula.vue'
import type { ChannelReading, DeviceRatings } from '@/services/energisa/types'

const { t, te } = useI18n()

/** Methodology block, collapsed by default — it explains, it doesn't monitor. */
const showMethod = ref(false)

const props = defineProps<{
  channels: ChannelReading[]
  ratings: DeviceRatings | null
  temperature: number | null
}>()

const diagnostics = computed(() =>
  analyse({
    channels: props.channels,
    ratings: props.ratings,
    temperature: props.temperature,
  }),
)

/** Indicators with nothing to report are hidden rather than shown as blanks. */
const measurable = computed(() =>
  diagnostics.value.indicators.filter((i) => i.severity !== 'unknown' && i.value !== null),
)

function format(ind: Indicator): string {
  if (ind.value === null) return '—'
  // Power factor is dimensionless and conventionally shown to three places.
  if (ind.key === 'powerFactor') return ind.value.toFixed(3)
  return ind.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/** Severity-specific sentence, falling back to the next mildest that exists. */
function pick(ind: Indicator, suffix: string): string {
  const order = ['critical', 'warning', 'watch', 'good']
  const from = order.indexOf(ind.severity)
  for (const level of order.slice(from < 0 ? 0 : from)) {
    const key = `energisa.diag.${ind.key}_${suffix ? suffix + '_' : ''}${level}`
    if (te(key)) return t(key, ind.params)
  }
  return ''
}

/**
 * The health number, broken down.
 *
 * Weights mirror WEIGHTS in diagnostics.ts and are re-normalised over the
 * indicators that could actually be measured — which is why the divisor is
 * rarely 1.00.
 */
const WEIGHTS: Record<string, number> = {
  loading: 0.3,
  thermal: 0.3,
  unbalance: 0.15,
  voltage: 0.15,
  powerFactor: 0.05,
  harmonics: 0.05,
}

const scored = computed(() =>
  diagnostics.value.indicators
    .filter((i) => i.score !== null)
    .map((i) => {
      const weight = WEIGHTS[i.key] ?? 0
      return {
        key: i.key,
        severity: i.severity,
        score: Math.round(i.score as number),
        weight: weight.toFixed(2),
        product: Math.round((i.score as number) * weight),
      }
    }),
)

const totalProducts = computed(() =>
  Math.round(scored.value.reduce((sum, r) => sum + r.product, 0)),
)

const totalWeight = computed(() =>
  scored.value.reduce((sum, r) => sum + Number(r.weight), 0).toFixed(2),
)

const refsFor = referencesFor

/** Is the current reading inside this band? */
function inBand(ind: Indicator, b: Band): boolean {
  if (ind.value === null) return false
  const aboveFloor = b.from === null || ind.value >= b.from
  const belowCeiling = b.to === null || ind.value < b.to
  return aboveFloor && belowCeiling
}

/** "10 – 20 %", "above 110 °C", "below 202 V". */
function bandLabel(b: Band, unit: string): string {
  const u = unit ? ` ${unit}` : ''
  if (b.from === null && b.to !== null) return `${t('energisa.diag.below')} ${b.to}${u}`
  if (b.to === null && b.from !== null) return `${t('energisa.diag.above')} ${b.from}${u}`
  return `${b.from} – ${b.to}${u}`
}

const assessment = (ind: Indicator) => pick(ind, '')
const action = (ind: Indicator) =>
  ind.severity === 'good' ? '' : pick(ind, 'action')
</script>

<style scoped>
.panel-title { font-size: 14px; font-weight: 600; }

.empty { font-size: 13px; }

/* ---- health index ---- */
.health { display: flex; align-items: center; gap: 0.6rem; }

.health__meter { position: relative; width: 46px; height: 46px; }

.health__ring { width: 100%; height: 100%; transform: rotate(-90deg); }

.health__track,
.health__value {
  fill: none;
  stroke-width: 3.2;
  stroke-linecap: round;
}

.health__track { stroke: var(--bs-border-color); }
.health__value { stroke: currentColor; transition: stroke-dasharray 0.4s ease; }

.health__number {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.health__label { font-size: 11px; font-weight: 600; color: var(--bs-body-color); }

/* ---- indicator grid ---- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
}

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

.ind__value {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--bs-body-color);
  line-height: 1.1;
}

.ind__unit { font-size: 12px; font-weight: 400; color: var(--bs-secondary-color); margin-left: 2px; }

.ind__desc,
.ind__assess,
.ind__action { margin: 0; font-size: 11.5px; line-height: 1.5; }

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

/* ---- severity colours, from Bootstrap tokens so themes follow ---- */
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

/* Same quiet treatment as the per-card toggles, so the two read as one
   affordance rather than two competing controls. */
.how-link {
  display: inline-block;
  margin-top: 2px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--bs-secondary-color);
  cursor: pointer;
  user-select: none;
}

.how-link:hover { color: var(--bs-body-color); }

.health__top { display: flex; align-items: center; gap: 0.45rem; }

/* ---- threshold summary ---- */
.calc {
  width: 100%;
  border-collapse: collapse;
  margin: 0.35rem 0 0.6rem;
  font-variant-numeric: tabular-nums;
}

.calc th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  padding: 0.2rem 0.6rem 0.2rem 0;
  white-space: nowrap;
}

.calc td {
  font-size: 11px;
  text-align: right;
  padding: 0.2rem 0.25rem;
  color: var(--bs-secondary-color);
  border-bottom: 1px dotted var(--bs-border-color);
}

.calc__op { color: var(--bs-secondary-color); padding: 0 0.15rem; }
.calc__prod { color: var(--bs-body-color); font-weight: 600; }

.calc__total th,
.calc__total td {
  border-bottom: none;
  border-top: 1px solid var(--bs-border-color);
  padding-top: 0.35rem;
  color: var(--bs-body-color);
}

.method__p--sep {
  padding-top: 0.5rem;
  border-top: 1px dashed var(--bs-border-color);
  color: var(--bs-secondary-color);
}

.thresholds {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.4rem;
}

.thresholds th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--bs-body-color);
  padding: 0.25rem 0.6rem 0.25rem 0;
  white-space: nowrap;
  vertical-align: top;
}

.thresholds td {
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--bs-secondary-color);
  padding: 0.25rem 0;
  border-bottom: 1px dotted var(--bs-border-color);
}

.th-band { white-space: nowrap; }
.th-band.sev-good { color: var(--bs-success); }
.th-band.sev-watch { color: var(--bs-info, #0dcaf0); }
.th-band.sev-warning { color: var(--bs-warning); }
.th-band.sev-critical { color: var(--bs-danger); }

/* ---- methodology ---- */
.method {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  background: var(--bs-tertiary-bg, rgb(0 0 0 / 0.02));
}

.method__h {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bs-secondary-color);
  margin: 0 0 0.25rem;
}

.method__h + .method__p { margin-bottom: 0.85rem; }

.method__p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--bs-body-color);
}

.rules { list-style: none; margin: 0 0 0.5rem; padding: 0; }

.rule {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11.5px;
  line-height: 1.9;
  color: var(--bs-body-color);
}

.rule__dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: currentColor;
  flex: none;
}

.method__sources { list-style: none; margin: 0.5rem 0 0; padding: 0; }

.method__sources li { font-size: 10.5px; line-height: 1.6; }

.method__sources a {
  color: var(--bs-secondary-color);
  text-decoration: none;
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
}

.method__sources a b { color: var(--bs-body-color); }
.method__sources a:hover { color: var(--bs-primary); text-decoration: underline; }

.method__caveat {
  margin: 0.7rem 0 0;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--bs-border-color);
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--bs-secondary-color);
}

/* ---- working ---- */
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

.work__inputs b { color: var(--bs-body-color); font-variant-numeric: tabular-nums; }

.band {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.14rem 0.25rem;
  border-radius: 3px;
}

/* Two classes, so these beat the generic .band rule regardless of source
   order — a single .sev-* selector tied on specificity and lost. */
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
  gap: 0.3rem;
  margin-top: 0.15rem;
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

.basis {
  margin-top: 0.85rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--bs-border-color);
}

.basis__text {
  margin: 0 0 0.5rem;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--bs-secondary-color);
}

.basis__label {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bs-secondary-color);
  margin-bottom: 0.2rem;
}

.basis__list {
  margin: 0;
  padding-left: 1rem;
  font-size: 10.5px;
  line-height: 1.7;
  color: var(--bs-secondary-color);
}

.basis__list a {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.basis__list a:hover { color: var(--bs-primary); text-decoration: underline; }
</style>
