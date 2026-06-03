<template>
  <div ref="containerRef" class="chart-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'

interface DataPoint { time: Date; value: number }
interface Threshold { value: number; color: string; dash: string }

const props = defineProps<{
  data: DataPoint[]
  thresholds?: Threshold[]
  height?: number
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  d3.select(el).selectAll('*').remove()

  const margin = { top: 10, right: 20, bottom: 30, left: 40 }
  const width = el.clientWidth - margin.left - margin.right
  const height = (props.height ?? 200) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth)
    .attr('height', props.height ?? 200)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleTime()
    .domain(d3.extent(props.data, d => d.time) as [Date, Date])
    .range([0, width])

  const y = d3.scaleLinear().domain([0, 110]).range([height, 0])

  // Grid lines
  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,2'))

  // Threshold lines
  props.thresholds?.forEach(t => {
    svg.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', y(t.value)).attr('y2', y(t.value))
      .attr('stroke', t.color).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', t.dash)
      .attr('opacity', 0.7)
  })

  // Color line based on threshold
  const colorScale = (v: number) => {
    if (v < 25) return '#e84040'
    if (v < 50) return '#f58b06'
    if (v < 75) return '#f58b06'
    return '#73bf69'
  }

  // Draw segmented line by color
  for (let i = 1; i < props.data.length; i++) {
    const a = props.data[i - 1]
    const b = props.data[i]
    svg.append('line')
      .attr('x1', x(a.time)).attr('y1', y(a.value))
      .attr('x2', x(b.time)).attr('y2', y(b.value))
      .attr('stroke', colorScale(b.value))
      .attr('stroke-width', 2)
  }

  // Axes
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => d3.timeFormat('%H:%M')(d as Date)))
    .call(g => g.select('.domain').attr('stroke', '#444'))
    .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(g => g.selectAll('.tick line').attr('stroke', '#444'))

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}`))
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
</style>
