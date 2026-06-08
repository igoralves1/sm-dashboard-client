<template>
  <div class="bar-wrapper">
    <!-- Header: title + legend -->
    <div class="chart-header">
      <div class="chart-main-title">{{ title ?? t('monitoring.production_title_fallback') }}</div>
      <div class="chart-legend">
        <span v-for="key in ptpKeys" :key="key" class="legend-item">
          <span class="legend-dot" :style="{ background: colorOf(key) }"></span>
          <span class="legend-text">{{ key }}</span>
        </span>
      </div>
    </div>

    <div style="position:relative">
      <div ref="tooltipRef" class="chart-tooltip" style="display:none">
        <div class="tt-label"></div>
        <div v-for="key in ptpKeys" :key="key" class="tt-row">
          <span class="tt-dot" :style="{ background: colorOf(key) }"></span>
          <span class="tt-series">{{ key }}</span>
          <span class="tt-value" :data-key="key">—</span>
        </div>
      </div>
      <div ref="containerRef" class="chart-container"></div>
    </div>

    <!-- Anomaly diagnostics -->
    <div v-if="computedAlerts.length" class="chart-notes" ref="notesRef">
      <div
        v-for="(anomaly, i) in computedAlerts" :key="i"
        :class="['chart-alert', `chart-alert--${anomaly.severity}`]"
      >
        <span :class="['alert-icon', anomaly.severity === 'critical' ? 'alert-blink' : '']">⚠</span>
        <div class="alert-body">
          <span class="alert-ptp">{{ anomaly.ptp }}</span>
          <span class="alert-text">
            {{ anomaly.detail }}
            <span :class="['alert-prob', `alert-prob--${anomaly.severity}`]">
              {{ t('monitoring.prob_normal_op') }} {{ fmtP(anomaly.pValuePct / 100) }}
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Statistical model explanation (collapsible) -->
    <div v-if="computedAlerts.length" class="model-section">
      <button class="model-toggle" @click="showModel = !showModel">
        {{ showModel ? '▾' : '▸' }} {{ t('dashboard.stat_model') }}
      </button>
      <div v-if="showModel" ref="mathRef" class="model-body">
        <p class="model-intro">{{ t('monitoring.stat_intro_bar') }}</p>

        <p class="model-subtitle">{{ t('monitoring.stat_h1_bar') }}</p>
        <p class="model-text">{{ t('monitoring.stat_p1_bar') }}</p>
        \[ x \;\leq\; \tau, \qquad \tau = 0{,}05 \cdot \max(x_i) \]

        <p class="model-subtitle">{{ t('dashboard.stat_model_h2') }}</p>
        <p class="model-text">{{ t('dashboard.stat_model_p2') }}</p>
        \[
          L^{-} = Q_1 - 1{,}5 \cdot \text{IQR}, \qquad
          L^{+} = Q_3 + 1{,}5 \cdot \text{IQR}, \qquad
          \text{IQR} = Q_3 - Q_1
        \]
        <p class="model-text">{{ t('dashboard.stat_model_p2b') }}</p>
        \[ \frac{|x - \tilde{x}|}{\tilde{x}} \;>\; 0{,}30 \]

        <p class="model-subtitle">{{ t('dashboard.stat_model_h3') }}</p>
        <p class="model-text">{{ t('dashboard.stat_model_p3') }}</p>
        \[ z = \frac{x - \mu}{\sigma} \]
        <p class="model-text">{{ t('dashboard.stat_model_p4') }}</p>
        \[ p = 2\,\bigl(1 - \Phi(|z|)\bigr), \qquad \Phi(z) = \frac{1}{2}\!\left[1 + \operatorname{erf}\!\left(\frac{z}{\sqrt{2}}\right)\right] \]
        <p class="model-text" v-html="t('dashboard.stat_model_p5')"></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import { detectAnomalies, fmtP, type Anomaly } from '@/composables/useAnomalyDetection'
import { useAlertStore } from '@/composables/useAlertStore'

const { t, locale } = useI18n()
const { ingestAnomalies } = useAlertStore()

const props = defineProps<{
  data: Record<string, any>[]
  xField: string
  height?: number
  title?: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const tooltipRef   = ref<HTMLDivElement | null>(null)
const notesRef     = ref<HTMLDivElement | null>(null)
const mathRef      = ref<HTMLDivElement | null>(null)
const showModel    = ref(false)
let resizeObserver: ResizeObserver

// Typeset MathJax whenever the model section opens
watch(showModel, async (open) => {
  if (!open) return
  await nextTick()
  if (mathRef.value && (window as any).MathJax?.typesetPromise) {
    ;(window as any).MathJax.typesetPromise([mathRef.value])
  }
})

const COLORS: Record<string, string> = {
  PTP_01: '#73bf69', PTP_02: '#8ab8ff', PTP_03: '#f2cc0c',
  PTP_04: '#ff9830', PTP_07: '#e02f44',
}
const colorOf = (name: string) => COLORS[name] ?? '#aaa'

const ptpKeys = computed(() =>
  props.data.length ? Object.keys(props.data[0]).filter(k => k !== props.xField && k !== 'time') : []
)

// Statistical anomaly detection — runs after every data update
const computedAlerts = computed<Anomaly[]>(() => {
  if (!props.data.length || !ptpKeys.value.length) return []
  return detectAnomalies(props.data, props.xField, ptpKeys.value)
})

// Persist detected anomalies to the shared alert store
watch(computedAlerts, (anomalies) => {
  const source = props.xField === 'hour' ? 'dashboard-sm-24h' : 'dashboard-sm-5d'
  ingestAnomalies(anomalies, source)
}, { immediate: true })

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  d3.select(el).select('svg').remove()

  const keys = ptpKeys.value
  // Keep natural query order — current hour arrives last and stays at the right
  const sortedData = props.data
  const margin = { top: 10, right: 10, bottom: 36, left: 62 }
  const W = el.clientWidth - margin.left - margin.right
  const H = (props.height ?? 200) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth).attr('height', props.height ?? 200)
    .style('overflow', 'visible')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x0 = d3.scaleBand()
    .domain(sortedData.map(d => d[props.xField]))
    .range([0, W]).padding(0.25)

  const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.05)

  const maxVal = d3.max(sortedData, d => d3.max(keys, k => +d[k]))! * 1.1
  const y = d3.scaleLinear().domain([0, maxVal]).range([H, 0])

  // Grid
  g.append('g').call(d3.axisLeft(y).tickSize(-W).tickFormat(() => ''))
    .call(gr => gr.select('.domain').remove())
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,2'))

  // Bars — with hover highlight
  const groups = g.selectAll('.group')
    .data(sortedData).enter().append('g')
    .attr('class', 'group')
    .attr('transform', d => `translate(${x0(d[props.xField])},0)`)

  groups.selectAll('rect')
    .data(d => keys.map(k => ({ key: k, value: +d[k], xLabel: d[props.xField] })))
    .enter().append('rect')
    .attr('x', d => x1(d.key)!)
    .attr('y', d => y(d.value))
    .attr('width', x1.bandwidth())
    .attr('height', d => H - y(d.value))
    .attr('fill', d => colorOf(d.key))
    .attr('opacity', 0.85)
    .attr('rx', 1)

  // Invisible full-height hover zones per group
  groups.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', x0.bandwidth()).attr('height', H)
    .attr('fill', 'transparent')
    .on('mouseover', function(event, d) {
      if (!tooltipRef.value) return
      const tt = tooltipRef.value
      tt.style.display = 'block'
      tt.querySelector('.tt-label')!.textContent = String(d[props.xField])
      keys.forEach(k => {
        const el2 = tt.querySelector(`[data-key="${k}"]`)
        if (el2) el2.textContent = (+d[k]).toFixed(2) + ' m³'
      })
      // Highlight group
      d3.select(this.parentElement).selectAll('rect:not(:last-child)').attr('opacity', 1)
    })
    .on('mousemove', function(event) {
      if (!tooltipRef.value) return
      const tt = tooltipRef.value
      const [mx] = d3.pointer(event, el)
      const ttW = tt.offsetWidth || 160
      tt.style.left = (mx + ttW + 12 > el.clientWidth ? mx - ttW - 8 : mx + 12) + 'px'
      tt.style.top = '10px'
    })
    .on('mouseleave', function() {
      d3.select(this.parentElement).selectAll('rect:not(:last-child)').attr('opacity', 0.85)
      if (tooltipRef.value) tooltipRef.value.style.display = 'none'
    })

  // Axes
  const currentHour = new Date().getHours()

  // Derive flagged hours from the anomaly engine for axis coloring
  const criticalHours = new Set<number>()
  const warningHours  = new Set<number>()
  computedAlerts.value.forEach(a => {
    a.hours.forEach(h => {
      if (a.severity === 'critical') criticalHours.add(h)
      else if (a.severity === 'warning') warningHours.add(h)
    })
  })

  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x0))
    .call(gr => gr.select('.domain').attr('stroke', '#444'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#444'))
    .call(gr => gr.selectAll<SVGTextElement, string>('text')
      .attr('font-size', '10px')
      .attr('font-weight', d => {
        const h = +d
        if (props.xField === 'hour' && h === currentHour) return '700'
        if (criticalHours.has(h) || warningHours.has(h)) return '700'
        return 'normal'
      })
      .attr('fill', d => {
        const h = +d
        if (props.xField === 'hour' && h === currentHour) return '#fade2a'
        if (criticalHours.has(h)) return '#e84040'
        if (warningHours.has(h)) return '#f58b06'
        return '#888'
      })
      .attr('class', d => {
        const h = +d
        if (h === currentHour) return null
        if (criticalHours.has(h)) return 'tick-missing'
        return null
      })
    )

  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(+d).toFixed(1)}`))
    .call(gr => gr.select('.domain').attr('stroke', '#444'))
    .call(gr => gr.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#444'))

  // Y-axis label
  svg.append('text')
    .attr('transform', `translate(13,${margin.top + H / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', '#666').attr('font-size', '10px')
    .text(props.xField === 'hour' ? 'm³/h' : 'm³')

  // X-axis label
  svg.append('text')
    .attr('x', margin.left + W / 2)
    .attr('y', margin.top + H + margin.bottom - 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#666').attr('font-size', '10px')
    .text(props.xField === 'hour' ? t('monitoring.hour_of_day') : t('monitoring.day_label'))
}

onMounted(() => {
  draw()
  resizeObserver = new ResizeObserver(draw)
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})
onUnmounted(() => resizeObserver?.disconnect())
watch(() => props.data, draw, { deep: true })
watch(locale, draw)
</script>

<style scoped>
.bar-wrapper { width: 100%; }
.chart-container { width: 100%; }

.chart-header {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #252525;
}

.chart-main-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #d0d0d0;
  letter-spacing: 0.3px;
}

.chart-legend { display: flex; flex-wrap: wrap; gap: 1rem; }

.legend-item { display: flex; align-items: center; gap: 5px; }

.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.legend-text { font-size: 0.72rem; color: #888; white-space: nowrap; }

.model-section {
  margin-top: 0.6rem;
  border-top: 1px solid #252525;
  padding-top: 0.5rem;
}
.model-toggle {
  background: none;
  border: none;
  color: #666;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  letter-spacing: 0.3px;
  transition: color 0.15s;
}
.model-toggle:hover { color: #aaa; }
.model-body {
  margin-top: 0.75rem;
  padding: 0.9rem 1rem;
  background: #13151a;
  border: 1px solid #252525;
  border-radius: 6px;
  color: #888;
}
.model-intro {
  font-size: 0.75rem;
  line-height: 1.6;
  margin-bottom: 0.8rem;
  color: #777;
}
.model-subtitle {
  font-size: 0.76rem;
  font-weight: 700;
  color: #aaa;
  margin: 0.9rem 0 0.3rem;
  letter-spacing: 0.3px;
}
.model-text {
  font-size: 0.74rem;
  line-height: 1.6;
  color: #777;
  margin: 0.2rem 0;
}

:global(.tick-missing) {
  animation: tick-blink 1.1s ease-in-out infinite;
}
@keyframes tick-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.15; }
}

.chart-notes {
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid #252525;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.chart-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border-radius: 5px;
  padding: 0.45rem 0.7rem;
}
.chart-alert--critical {
  background: rgba(232, 64, 64, 0.08);
  border: 1px solid rgba(232, 64, 64, 0.3);
}
.chart-alert--warning {
  background: rgba(245, 139, 6, 0.07);
  border: 1px solid rgba(245, 139, 6, 0.25);
}
.chart-alert--info {
  background: rgba(115, 191, 105, 0.06);
  border: 1px solid rgba(115, 191, 105, 0.2);
}
.alert-icon {
  font-size: 0.88rem;
  flex-shrink: 0;
  margin-top: 1px;
}
.chart-alert--critical .alert-icon { color: #e84040; }
.chart-alert--warning  .alert-icon { color: #f58b06; }
.chart-alert--info     .alert-icon { color: #73bf69; }
.alert-blink { animation: tick-blink 1.1s ease-in-out infinite; }
.alert-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.alert-ptp {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.4px;
}
.chart-alert--critical .alert-ptp { color: #e84040; }
.chart-alert--warning  .alert-ptp { color: #f58b06; }
.chart-alert--info     .alert-ptp { color: #73bf69; }
.alert-text {
  font-size: 0.74rem;
  line-height: 1.5;
  color: #aaa;
}
.alert-prob {
  display: inline-block;
  margin-left: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  vertical-align: middle;
}
.alert-prob--critical { background: rgba(232,64,64,0.18); color: #e84040; }
.alert-prob--warning  { background: rgba(245,139,6,0.18);  color: #f58b06; }
.alert-prob--info     { background: rgba(115,191,105,0.15); color: #73bf69; }

.chart-tooltip {
  position: absolute; pointer-events: none;
  background: #1f2430; border: 1px solid #3a3f55;
  border-radius: 6px; padding: 8px 12px; min-width: 160px;
  z-index: 10; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.tt-label { font-size: 0.78rem; color: #aaa; margin-bottom: 6px; font-weight: 600; }
.tt-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; margin-top: 3px; }
.tt-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.tt-series { color: #ccc; flex: 1; }
.tt-value { color: #fff; font-weight: 600; white-space: nowrap; }
</style>
