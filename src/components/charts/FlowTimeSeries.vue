<template>
  <div>
    <div ref="containerRef" class="chart-container"></div>
    <div class="legend">
      <span v-for="s in data" :key="s.name" class="legend-item">
        <span class="dot" :style="{ background: colorOf(s.name) }"></span>{{ s.name }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'

interface Series { name: string; values: { time: Date; value: number }[] }
const props = defineProps<{ data: Series[]; height?: number }>()
const containerRef = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver

const COLORS: Record<string, string> = {
  PTP_01: '#f2cc0c', PTP_02: '#ff9830', PTP_03: '#73bf69',
  PTP_04: '#8ab8ff', PTP_07: '#e02f44'
}
const colorOf = (name: string) => COLORS[name] ?? '#aaa'

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  d3.select(el).selectAll('*').remove()

  const margin = { top: 10, right: 20, bottom: 30, left: 45 }
  const width = el.clientWidth - margin.left - margin.right
  const height = (props.height ?? 180) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth).attr('height', props.height ?? 180)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const allTimes = props.data.flatMap(s => s.values.map(v => v.time))
  const allValues = props.data.flatMap(s => s.values.map(v => v.value))

  const x = d3.scaleTime().domain(d3.extent(allTimes) as [Date, Date]).range([0, width])
  const y = d3.scaleLinear().domain([0, d3.max(allValues)! * 1.1]).range([height, 0])

  // Grid
  svg.append('g').call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,2'))

  // Lines
  const line = d3.line<{ time: Date; value: number }>()
    .x(d => x(d.time)).y(d => y(d.value)).curve(d3.curveCatmullRom)

  props.data.forEach(series => {
    svg.append('path')
      .datum(series.values)
      .attr('fill', 'none')
      .attr('stroke', colorOf(series.name))
      .attr('stroke-width', 1.5)
      .attr('d', line)
  })

  // Axes
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => d3.timeFormat('%H:%M')(d as Date)))
    .call(g => g.select('.domain').attr('stroke', '#444'))
    .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(g => g.selectAll('.tick line').attr('stroke', '#444'))

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d} m³/h`))
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
.legend { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 0 0 45px; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #aaa; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
</style>
