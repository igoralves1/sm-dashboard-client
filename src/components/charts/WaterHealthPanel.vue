<template>
  <div class="card">
    <div class="card-body">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h6 class="panel-title mb-0">{{ t('hidroforte.diag.title', { site }) }}</h6>

        <div v-if="diagnostics.healthIndex !== null" class="health">
          <div class="health__meter" :class="`sev-${diagnostics.healthSeverity}`">
            <svg viewBox="0 0 36 36" class="health__ring" aria-hidden="true">
              <circle cx="18" cy="18" r="15.9" class="health__track" />
              <circle cx="18" cy="18" r="15.9" class="health__value" :stroke-dasharray="`${diagnostics.healthIndex} 100`" />
            </svg>
            <span class="health__number">{{ Math.round(diagnostics.healthIndex) }}</span>
          </div>
          <div>
            <div class="health__top">
              <span class="health__label">{{ t('energisa.diag.health_index') }}</span>
              <span class="pill" :class="`sev-${diagnostics.healthSeverity}`">
                {{ t(`energisa.diag.sev_${diagnostics.healthSeverity}`) }}
              </span>
            </div>
            <a class="how-link" role="button" tabindex="0" @click="showMethod = !showMethod" @keydown.enter="showMethod = !showMethod">
              {{ showMethod ? '⌃' : '⌄' }} {{ t('energisa.diag.method_toggle') }}
            </a>
          </div>
        </div>
      </div>

      <!-- Methodology: where the rating comes from -->
      <section v-if="showMethod" class="method">
        <div class="method__col">
          <h6 class="method__h">{{ t('energisa.diag.method_what') }}</h6>
          <p class="method__p">{{ t('hidroforte.diag.method_what_text') }}</p>

          <h6 class="method__h">{{ t('energisa.diag.method_rule') }}</h6>
          <ul class="rules">
            <li class="rule sev-critical"><span class="rule__dot"></span>{{ t('hidroforte.diag.method_rule_critical') }}</li>
            <li class="rule sev-good"><span class="rule__dot"></span>{{ t('hidroforte.diag.method_rule_good') }}</li>
            <li class="rule sev-warning"><span class="rule__dot"></span>{{ t('hidroforte.diag.method_rule_warning') }}</li>
          </ul>

          <h6 class="method__h">{{ t('energisa.diag.method_inputs') }}</h6>
          <p class="method__p">{{ t('hidroforte.diag.method_inputs_text') }}</p>
        </div>

        <div class="method__col">
          <h6 class="method__h">{{ t('energisa.diag.method_number') }}</h6>
          <p class="method__p">{{ t('hidroforte.diag.method_number_text') }}</p>
          <MathFormula
            tex="H = \frac{\sum_i w_i\,s_i}{\sum_i w_i}, \qquad s_i = 100\cdot\frac{x_i - x_{crit}}{x_{best} - x_{crit}} \in [0,100]"
            fallback="H = Σ(wᵢ·sᵢ) / Σwᵢ ;  sᵢ = 100·(xᵢ − x_crit)/(x_best − x_crit)"
          />

          <table v-if="scored.length" class="calc">
            <tbody>
              <tr v-for="row in scored" :key="row.key">
                <th :class="`sev-${row.severity}`">{{ t(`hidroforte.diag.${row.kind}_name`) }} <span class="calc__sub">{{ row.subject }}</span></th>
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
          <p class="method__caveat">{{ t('hidroforte.diag.method_caveat') }}</p>
        </div>
      </section>

      <p v-if="!measurable.length" class="text-muted mb-0 empty">{{ t('hidroforte.diag.no_data') }}</p>

      <div v-else class="grid">
        <WaterIndicatorCard v-for="ind in measurable" :key="ind.key" :ind="ind" />
      </div>

      <footer v-if="measurable.length" class="basis">
        <p class="basis__text">{{ t('hidroforte.diag.basis') }}</p>
        <div class="basis__label">{{ t('energisa.diag.sources') }}</div>
        <ul class="basis__list">
          <li v-for="ref in WATER_REFERENCES" :key="ref.tag">
            <a :href="ref.url" target="_blank" rel="noopener noreferrer" :title="ref.note">
              <b>{{ ref.tag }}</b> — {{ ref.name }}
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
 * Condition analysis for one water-supply site — the water counterpart of
 * DiagnosticsPanel (Energisa). Same rules: the number is the weighted mean of
 * the indicator scores, the classification is the worst indicator.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import MathFormula from './MathFormula.vue'
import WaterIndicatorCard from './WaterIndicatorCard.vue'
import type { WaterDiagnostics } from '@/utils/water/diagnostics'
import { WATER_REFERENCES } from '@/utils/water/references'

const props = defineProps<{ diagnostics: WaterDiagnostics; site: string }>()

const { t } = useI18n()
const showMethod = ref(false)

const measurable = computed(() =>
  props.diagnostics.indicators.filter(i => i.severity !== 'unknown' && i.value !== null),
)

const scored = computed(() =>
  props.diagnostics.indicators
    .filter(i => i.score !== null)
    .map(i => {
      const w = props.diagnostics.weights[i.key] ?? 0
      return {
        key: i.key, kind: i.kind, subject: i.subject, severity: i.severity,
        score: Math.round(i.score as number),
        weight: w.toFixed(3),
        product: Math.round((i.score as number) * w * 10) / 10,
      }
    }),
)

const totalProducts = computed(() => Math.round(scored.value.reduce((s, r) => s + r.product, 0) * 10) / 10)
const totalWeight = computed(() => scored.value.reduce((s, r) => s + Number(r.weight), 0).toFixed(2))
</script>

<style scoped>
.panel-title { font-size: 14px; font-weight: 600; }
.empty { font-size: 13px; }

.health { display: flex; align-items: center; gap: 0.6rem; }
.health__meter { position: relative; width: 46px; height: 46px; }
.health__ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.health__track, .health__value { fill: none; stroke-width: 3.2; stroke-linecap: round; }
.health__track { stroke: var(--bs-border-color); }
.health__value { stroke: currentColor; transition: stroke-dasharray 0.4s ease; }
.health__number {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.health__label { font-size: 11px; font-weight: 600; color: var(--bs-body-color); }
.health__top { display: flex; align-items: center; gap: 0.45rem; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
}

.sev-good { color: var(--bs-success); }
.sev-watch { color: var(--bs-info, #0dcaf0); }
.sev-warning { color: var(--bs-warning); }
.sev-critical { color: var(--bs-danger); }
.sev-unknown { color: var(--bs-secondary-color); }

.pill {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 0.12rem 0.45rem; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap;
}
.how-link {
  display: inline-block; margin-top: 2px; font-size: 10.5px; font-weight: 500;
  color: var(--bs-secondary-color); cursor: pointer; user-select: none;
}
.how-link:hover { color: var(--bs-body-color); }

.calc { width: 100%; border-collapse: collapse; margin: 0.35rem 0 0.6rem; font-variant-numeric: tabular-nums; }
.calc th { text-align: left; font-size: 11px; font-weight: 600; padding: 0.2rem 0.6rem 0.2rem 0; white-space: nowrap; }
.calc__sub { font-weight: 400; color: var(--bs-secondary-color); }
.calc td {
  font-size: 11px; text-align: right; padding: 0.2rem 0.25rem;
  color: var(--bs-secondary-color); border-bottom: 1px dotted var(--bs-border-color);
}
.calc__op { color: var(--bs-secondary-color); padding: 0 0.15rem; }
.calc__prod { color: var(--bs-body-color); font-weight: 600; }
.calc__total th, .calc__total td {
  border-bottom: none; border-top: 1px solid var(--bs-border-color);
  padding-top: 0.35rem; color: var(--bs-body-color);
}

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
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--bs-secondary-color); margin: 0 0 0.25rem;
}
.method__h + .method__p { margin-bottom: 0.85rem; }
.method__p { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--bs-body-color); }
.method__p--sep { padding-top: 0.5rem; border-top: 1px dashed var(--bs-border-color); color: var(--bs-secondary-color); }
.method__caveat {
  margin: 0.7rem 0 0; padding-top: 0.5rem; border-top: 1px dashed var(--bs-border-color);
  font-size: 10.5px; line-height: 1.5; color: var(--bs-secondary-color);
}
.rules { list-style: none; margin: 0 0 0.85rem; padding: 0; }
.rule { display: flex; align-items: center; gap: 0.4rem; font-size: 11.5px; line-height: 1.9; color: var(--bs-body-color); }
.rule__dot { width: 8px; height: 8px; border-radius: 2px; background: currentColor; flex: none; }

.basis { margin-top: 0.85rem; padding-top: 0.6rem; border-top: 1px solid var(--bs-border-color); }
.basis__text { margin: 0 0 0.5rem; font-size: 10.5px; line-height: 1.5; color: var(--bs-secondary-color); }
.basis__label {
  font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--bs-secondary-color); margin-bottom: 0.2rem;
}
.basis__list { margin: 0; padding-left: 1rem; font-size: 10.5px; line-height: 1.7; color: var(--bs-secondary-color); }
.basis__list a { color: inherit; text-decoration: none; display: inline-flex; align-items: baseline; gap: 0.2rem; }
.basis__list a b { color: var(--bs-body-color); }
.basis__list a:hover { color: var(--bs-primary); text-decoration: underline; }
</style>
