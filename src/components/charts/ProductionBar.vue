<template>
  <div>
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
let resizeObserver: ResizeObserver

const COLORS: Record<string, string> = {
  PTP_01: '#73bf69', PTP_02: '#8ab8ff', PTP_03: '#f2cc0c',
  PTP_04: '#ff9830', PTP_07: '#e02f44'
}
const colorOf = (name: string) => COLORS[name] ?? '#aaa'

const ptpKeys = computed(() =>
  props.data.length ? Object.keys(props.data[0]).filter(k => k !== props.xField && k !== 'time') : []
)

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  d3.select(el).selectAll('*').remove()

  const keys = ptpKeys.value
  const margin = { top: 10, right: 10, bottom: 30, left: 40 }
  const width = el.clientWidth - margin.left - margin.right
  const height = (props.height ?? 200) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth).attr('height', props.height ?? 200)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x0 = d3.scaleBand()
    .domain(props.data.map(d => d[props.xField]))
    .range([0, width]).padding(0.25)

  const x1 = d3.scaleBand()
    .domain(keys).range([0, x0.bandwidth()]).padding(0.05)

  const maxVal = d3.max(props.data, d => d3.max(keys, k => +d[k]))! * 1.1
  const y = d3.scaleLinear().domain([0, maxVal]).range([height, 0])

  // Grid
  svg.append('g').call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,2'))

  // Bars
  const groups = svg.selectAll('.group')
    .data(props.data).enter().append('g')
    .attr('transform', d => `translate(${x0(d[props.xField])},0)`)

  groups.selectAll('rect')
    .data(d => keys.map(k => ({ key: k, value: +d[k] })))
    .enter().append('rect')
    .attr('x', d => x1(d.key)!)
    .attr('y', d => y(d.value))
    .attr('width', x1.bandwidth())
    .attr('height', d => height - y(d.value))
    .attr('fill', d => colorOf(d.key))
    .attr('opacity', 0.85)
    .attr('rx', 1)

  // Axes
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .call(g => g.select('.domain').attr('stroke', '#444'))
    .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(g => g.selectAll('.tick line').attr('stroke', '#444'))

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5))
    .call(g => g.select('.domain').attr('stroke', '#444'))
    .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(g => g.selectAll('.tick line').attr('stroke', '#444'))
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
</style>
