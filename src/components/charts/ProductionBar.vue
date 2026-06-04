<template>
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
    <div class="legend">
      <span v-for="key in ptpKeys" :key="key" class="legend-item">
        <span class="dot" :style="{ background: colorOf(key) }"></span>{{ key }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as d3 from 'd3'

const props = defineProps<{
  data: Record<string, any>[]
  xField: string
  height?: number
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

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  d3.select(el).select('svg').remove()

  const keys = ptpKeys.value
  const margin = { top: 10, right: 10, bottom: 30, left: 40 }
  const W = el.clientWidth - margin.left - margin.right
  const H = (props.height ?? 200) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth).attr('height', props.height ?? 200)
    .style('overflow', 'visible')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x0 = d3.scaleBand()
    .domain(props.data.map(d => d[props.xField]))
    .range([0, W]).padding(0.25)

  const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.05)

  const maxVal = d3.max(props.data, d => d3.max(keys, k => +d[k]))! * 1.1
  const y = d3.scaleLinear().domain([0, maxVal]).range([H, 0])

  // Grid
  g.append('g').call(d3.axisLeft(y).tickSize(-W).tickFormat(() => ''))
    .call(gr => gr.select('.domain').remove())
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,2'))

  // Bars — with hover highlight
  const groups = g.selectAll('.group')
    .data(props.data).enter().append('g')
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
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x0))
    .call(gr => gr.select('.domain').attr('stroke', '#444'))
    .call(gr => gr.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#444'))

  g.append('g')
    .call(d3.axisLeft(y).ticks(5))
    .call(gr => gr.select('.domain').attr('stroke', '#444'))
    .call(gr => gr.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#444'))
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
.chart-container { width: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 0 0 40px; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #aaa; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

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
