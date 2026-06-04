<template>
  <div class="flow-wrapper">
    <!-- Header: title + PTP legend -->
    <div class="chart-header">
      <div class="chart-main-title">Vazão em M³/h · PTPs · Silvanópolis</div>
      <div class="chart-legend">
        <span v-for="s in data" :key="s.name" class="legend-item">
          <span class="legend-dot" :style="{ background: colorOf(s.name) }"></span>
          <span class="legend-text">{{ s.name }}</span>
        </span>
      </div>
    </div>

    <div style="position:relative">
      <div ref="tooltipRef" class="chart-tooltip" style="display:none">
        <div class="tt-time"></div>
        <div v-for="s in data" :key="s.name" class="tt-row">
          <span class="tt-dot" :style="{ background: colorOf(s.name) }"></span>
          <span class="tt-label">{{ s.name }}</span>
          <span class="tt-value" :data-series="s.name">—</span>
        </div>
      </div>
      <div ref="containerRef" class="chart-container"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'

interface Series { name: string; values: { time: Date; value: number }[] }
const props = defineProps<{ data: Series[]; height?: number }>()
const containerRef = ref<HTMLDivElement | null>(null)
const tooltipRef   = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver

const COLORS: Record<string, string> = {
  PTP_01: '#fade2a', PTP_02: '#ff9830', PTP_03: '#5794f2',
  PTP_04: '#73bf69', PTP_07: '#f2495c',
}
const colorOf = (name: string) => COLORS[name] ?? '#aaa'

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  d3.select(el).select('svg').remove()

  const margin = { top: 10, right: 20, bottom: 30, left: 55 }
  const W = el.clientWidth - margin.left - margin.right
  const H = (props.height ?? 180) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth).attr('height', props.height ?? 180)
    .style('overflow', 'visible')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const allTimes  = props.data.flatMap(s => s.values.map(v => v.time))
  const allValues = props.data.flatMap(s => s.values.map(v => v.value))

  const x = d3.scaleTime().domain(d3.extent(allTimes) as [Date, Date]).range([0, W])
  const y = d3.scaleLinear().domain([0, (d3.max(allValues) ?? 1) * 1.1]).range([H, 0])

  // Grid
  g.append('g').call(d3.axisLeft(y).tickSize(-W).tickFormat(() => ''))
    .call(gr => gr.select('.domain').remove())
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,2'))

  // Lines
  const line = d3.line<{ time: Date; value: number }>()
    .x(d => x(d.time)).y(d => y(d.value)).curve(d3.curveCatmullRom)

  props.data.forEach(series => {
    g.append('path').datum(series.values)
      .attr('fill', 'none').attr('stroke', colorOf(series.name))
      .attr('stroke-width', 1.5).attr('d', line)
  })

  // Axes
  const currentHour = new Date().getHours()
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => d3.timeFormat('%H:%M')(d as Date)))
    .call(gr => gr.select('.domain').attr('stroke', '#444'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#444'))
    .call(gr => gr.selectAll<SVGTextElement, Date>('text')
      .attr('fill', d => (d as Date).getHours() === currentHour ? '#fade2a' : '#888')
      .attr('font-size', '10px')
      .attr('font-weight', d => (d as Date).getHours() === currentHour ? '700' : 'normal')
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
    .text('m³/h')

  // X-axis label
  svg.append('text')
    .attr('x', margin.left + W / 2)
    .attr('y', margin.top + H + margin.bottom - 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#666').attr('font-size', '10px')
    .text('Hora do dia')

  // ── Tooltip ──────────────────────────────────────────────────────────────
  const bisect = d3.bisector((d: { time: Date; value: number }) => d.time).left

  const crosshair = g.append('line')
    .attr('stroke', '#555').attr('stroke-width', 1).attr('stroke-dasharray', '3,3')
    .attr('y1', 0).attr('y2', H).style('display', 'none')

  // One dot per series
  const dots = props.data.map(series =>
    g.append('circle').attr('r', 4)
      .attr('fill', colorOf(series.name)).attr('stroke', '#fff').attr('stroke-width', 1)
      .style('display', 'none')
  )

  g.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent')
    .on('mousemove', (event: MouseEvent) => {
      if (!tooltipRef.value) return
      const [mx] = d3.pointer(event)
      const date = x.invert(mx)

      crosshair.attr('x1', mx).attr('x2', mx).style('display', null)

      tooltipRef.value.querySelector('.tt-time')!.textContent =
        d3.timeFormat('%Y-%m-%d %H:%M:%S')(date)

      props.data.forEach((series, i) => {
        const idx = bisect(series.values, date, 1)
        const d0 = series.values[idx - 1]
        const d1 = series.values[idx]
        if (!d0) return
        const d = d1 && (date.getTime() - d0.time.getTime()) > (d1.time.getTime() - date.getTime()) ? d1 : d0

        dots[i].attr('cx', x(d.time)).attr('cy', y(d.value)).style('display', null)

        const valEl = tooltipRef.value!.querySelector(`[data-series="${series.name}"]`)
        if (valEl) valEl.textContent = d.value.toFixed(2) + ' m³/h'
      })

      const tt = tooltipRef.value
      tt.style.display = 'block'
      const ttW = tt.offsetWidth || 180
      const chartW = el.clientWidth
      const absX = mx + margin.left
      tt.style.left = (absX + ttW + 12 > chartW ? absX - ttW - 8 : absX + 12) + 'px'
      tt.style.top = '10px'
    })
    .on('mouseleave', () => {
      crosshair.style('display', 'none')
      dots.forEach(d => d.style('display', 'none'))
      if (tooltipRef.value) tooltipRef.value.style.display = 'none'
    })
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
.flow-wrapper { width: 100%; }
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

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.legend-item { display: flex; align-items: center; gap: 5px; }

.legend-dot {
  width: 10px; height: 10px;
  border-radius: 50%; flex-shrink: 0;
}

.legend-text { font-size: 0.72rem; color: #888; white-space: nowrap; }

.chart-tooltip {
  position: absolute; pointer-events: none;
  background: #1f2430; border: 1px solid #3a3f55;
  border-radius: 6px; padding: 8px 12px; min-width: 170px;
  z-index: 10; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.tt-time { font-size: 0.75rem; color: #aaa; margin-bottom: 6px; white-space: nowrap; }
.tt-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; margin-top: 3px; }
.tt-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.tt-label { color: #ccc; flex: 1; }
.tt-value { color: #fff; font-weight: 600; white-space: nowrap; }
</style>
