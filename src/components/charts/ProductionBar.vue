<template>
  <div class="bar-wrapper">
    <!-- Header: title + legend -->
    <div class="chart-header">
      <div class="chart-main-title">{{ title ?? 'Produção · PTPs · Silvanópolis' }}</div>
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

    <!-- Dynamic alerts section -->
    <div v-if="computedAlerts.length" class="chart-notes">
      <div v-for="(alert, i) in computedAlerts" :key="i" :class="['chart-alert', `chart-alert--${alert.level}`]">
        <span :class="['alert-icon', 'alert-blink']">⚠</span>
        <span class="alert-text">{{ alert.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as d3 from 'd3'

interface AlertItem { level: 'missing' | 'zero'; message: string }

const props = defineProps<{
  data: Record<string, any>[]
  xField: string
  height?: number
  title?: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const tooltipRef   = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver

const COLORS: Record<string, string> = {
  PTP_01: '#73bf69', PTP_02: '#8ab8ff', PTP_03: '#f2cc0c',
  PTP_04: '#ff9830', PTP_07: '#e02f44',
}
const colorOf = (name: string) => COLORS[name] ?? '#aaa'

const ptpKeys = computed(() =>
  props.data.length ? Object.keys(props.data[0]).filter(k => k !== props.xField && k !== 'time') : []
)

// Real-time analysis: missing (null/undefined) vs zero per PTP per hour
const computedAlerts = computed<AlertItem[]>(() => {
  if (props.xField !== 'hour' || !props.data.length) return []
  const alerts: AlertItem[] = []
  const keys = ptpKeys.value

  keys.forEach(ptp => {
    const missingHours: number[] = []
    const zeroHours: number[] = []

    props.data.forEach(row => {
      const v = row[ptp]
      const h = +row[props.xField]
      const isMissing = v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
      const isZeroOrInvalid = !isMissing && (isNaN(+v) || +v === 0)
      if (isMissing) missingHours.push(h)
      else if (isZeroOrInvalid) zeroHours.push(h)
    })

    if (missingHours.length) {
      const hrs = missingHours.sort((a, b) => a - b).join(', ')
      alerts.push({
        level: 'missing',
        message: `${ptp} — dados ausentes (sem leitura) nas horas: ${hrs}h. Verificar conectividade do sensor.`
      })
    }
    if (zeroHours.length) {
      const hrs = zeroHours.sort((a, b) => a - b).join(', ')
      alerts.push({
        level: 'zero',
        message: `${ptp} — leitura zero nas horas: ${hrs}h. Bomba desligada ou sensor em zero.`
      })
    }
  })

  return alerts
})

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

  // Separate missing (null/undefined) from zero per hour
  const missingHours = new Set<number>()
  const zeroHours = new Set<number>()
  if (props.xField === 'hour') {
    sortedData.forEach(row => {
      const h = +row[props.xField]
      keys.forEach(k => {
        const v = row[k]
        const isMissing = v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
        const isZeroOrInvalid = !isMissing && (isNaN(+v) || +v === 0)
        if (isMissing) missingHours.add(h)
        else if (isZeroOrInvalid) zeroHours.add(h)
      })
    })
  }

  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x0))
    .call(gr => gr.select('.domain').attr('stroke', '#444'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#444'))
    .call(gr => gr.selectAll<SVGTextElement, string>('text')
      .attr('font-size', '10px')
      .attr('font-weight', d => {
        const h = +d
        if (props.xField === 'hour' && h === currentHour) return '700'
        if (missingHours.has(h) || zeroHours.has(h)) return '700'
        return 'normal'
      })
      .attr('fill', d => {
        const h = +d
        if (props.xField === 'hour' && h === currentHour) return '#fade2a'
        if (missingHours.has(h)) return '#e84040'   // red = missing
        if (zeroHours.has(h)) return '#f58b06'       // orange = zero
        return '#888'
      })
      .attr('class', d => {
        const h = +d
        if (h === currentHour) return null
        if (missingHours.has(h)) return 'tick-missing'
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
    .text(props.xField === 'hour' ? 'Hora do dia' : 'Dia')
}

onMounted(() => {
  draw()
  resizeObserver = new ResizeObserver(draw)
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})
onUnmounted(() => resizeObserver?.disconnect())
watch(() => props.data, draw, { deep: true })
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
.chart-alert--missing {
  background: rgba(232, 64, 64, 0.08);
  border: 1px solid rgba(232, 64, 64, 0.25);
}
.chart-alert--zero {
  background: rgba(245, 139, 6, 0.08);
  border: 1px solid rgba(245, 139, 6, 0.25);
}
.alert-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}
.chart-alert--missing .alert-icon { color: #e84040; }
.chart-alert--zero    .alert-icon { color: #f58b06; }
.alert-blink { animation: tick-blink 1.1s ease-in-out infinite; }
.alert-text {
  font-size: 0.76rem;
  line-height: 1.45;
}
.chart-alert--missing .alert-text { color: #c08080; }
.chart-alert--zero    .alert-text { color: #b8842a; }

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
