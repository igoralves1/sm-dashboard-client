<template>
  <div class="chart-wrapper">
    <!-- Header: title + legend -->
    <div v-if="title" class="chart-header">
      <div class="chart-main-title">{{ title }}</div>
      <div class="chart-legend">
        <span class="legend-item">
          <span class="legend-dot" style="background:#e84040"></span>
          <span class="legend-text">{{ t('monitoring.level_critical') }}</span>
        </span>
        <span class="legend-item">
          <span class="legend-dot" style="background:#f58b06"></span>
          <span class="legend-text">{{ t('monitoring.level_alert') }}</span>
        </span>
        <span class="legend-item">
          <span class="legend-dot" style="background:#73bf69"></span>
          <span class="legend-text">{{ t('monitoring.level_normal') }}</span>
        </span>
      </div>
    </div>

    <!-- Chart area -->
    <div ref="containerRef" class="chart-container" style="position:relative">
      <!-- Tooltip -->
      <div ref="tooltipRef" class="chart-tooltip" style="display:none">
        <div class="tt-time"></div>
        <div class="tt-row">
          <span class="tt-dot"></span>
          <span class="tt-label">{{ t('monitoring.level_label') }}</span>
          <span class="tt-value"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'

interface DataPoint { time: Date; value: number }
interface Threshold { value: number; color: string; dash: string }

const props = defineProps<{
  data: DataPoint[]
  thresholds?: Threshold[]
  height?: number
  title?: string
}>()

const { t, locale } = useI18n()
const containerRef = ref<HTMLDivElement | null>(null)
const tooltipRef   = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver

const colorScale = (v: number) => {
  if (v < 50) return '#e84040'
  if (v < 80) return '#f58b06'
  return '#73bf69'
}

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  d3.select(el).select('svg').remove()

  const margin = { top: 10, right: 20, bottom: 36, left: 52 }
  const W = el.clientWidth - margin.left - margin.right
  const H = (props.height ?? 220) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth)
    .attr('height', props.height ?? 220)
    .style('overflow', 'visible')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleTime()
    .domain(d3.extent(props.data, d => d.time) as [Date, Date])
    .range([0, W])

  const y = d3.scaleLinear().domain([0, 110]).range([H, 0])

  // Grid
  g.append('g')
    .call(d3.axisLeft(y).tickSize(-W).tickFormat(() => ''))
    .call(gr => gr.select('.domain').remove())
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,2'))

  // Threshold lines
  props.thresholds?.forEach(t => {
    g.append('line')
      .attr('x1', 0).attr('x2', W)
      .attr('y1', y(t.value)).attr('y2', y(t.value))
      .attr('stroke', t.color).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', t.dash).attr('opacity', 0.7)
  })

  // Segmented colored line — use midpoint value for color
  for (let i = 1; i < props.data.length; i++) {
    const a = props.data[i - 1], b = props.data[i]
    const mid = (a.value + b.value) / 2
    g.append('line')
      .attr('x1', x(a.time)).attr('y1', y(a.value))
      .attr('x2', x(b.time)).attr('y2', y(b.value))
      .attr('stroke', colorScale(mid))
      .attr('stroke-width', 2)
  }

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
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
    .call(gr => gr.select('.domain').attr('stroke', '#444'))
    .call(gr => gr.selectAll('text').attr('fill', '#888').attr('font-size', '10px'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#444'))

  // X-axis label
  svg.append('text')
    .attr('x', margin.left + W / 2)
    .attr('y', margin.top + H + margin.bottom - 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#666')
    .attr('font-size', '10px')
    .text(t('monitoring.hour_of_day'))

  // ── Tooltip overlay ──────────────────────────────────────────────────────
  const bisect = d3.bisector((d: DataPoint) => d.time).left

  // Vertical crosshair line
  const crosshair = g.append('line')
    .attr('stroke', '#555').attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,3')
    .attr('y1', 0).attr('y2', H)
    .style('display', 'none')

  // Dot on line
  const dot = g.append('circle')
    .attr('r', 4).attr('fill', '#fff').attr('stroke', '#aaa').attr('stroke-width', 1.5)
    .style('display', 'none')

  // Invisible overlay for mouse events
  g.append('rect')
    .attr('width', W).attr('height', H)
    .attr('fill', 'transparent')
    .on('mousemove', (event: MouseEvent) => {
      if (!tooltipRef.value) return
      const [mx] = d3.pointer(event)
      const date = x.invert(mx)
      const idx = bisect(props.data, date, 1)
      const d0 = props.data[idx - 1]
      const d1 = props.data[idx]
      if (!d0) return
      const d = d1 && (date.getTime() - d0.time.getTime()) > (d1.time.getTime() - date.getTime()) ? d1 : d0

      const cx = x(d.time)
      const cy = y(d.value)

      crosshair.attr('x1', cx).attr('x2', cx).style('display', null)
      dot.attr('cx', cx).attr('cy', cy)
        .attr('fill', colorScale(d.value))
        .style('display', null)

      // Position tooltip
      const tt = tooltipRef.value
      tt.style.display = 'block'
      const ttW = tt.offsetWidth || 160
      const chartW = el.clientWidth
      const absX = cx + margin.left
      tt.style.left = (absX + ttW + 12 > chartW ? absX - ttW - 8 : absX + 12) + 'px'
      tt.style.top = (cy + margin.top - 10) + 'px'

      // Fill content
      tt.querySelector('.tt-time')!.textContent = d3.timeFormat('%Y-%m-%d %H:%M:%S')(d.time)
      const dot2 = tt.querySelector('.tt-dot') as HTMLElement
      dot2.style.background = colorScale(d.value)
      tt.querySelector('.tt-value')!.textContent = `${d.value.toFixed(1)}%`
    })
    .on('mouseleave', () => {
      crosshair.style('display', 'none')
      dot.style('display', 'none')
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
watch(locale, draw)
</script>

<style scoped>
.chart-wrapper { width: 100%; }
.chart-container { width: 100%; }

.chart-header {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #252525;
  position: sticky;
  top: 0;
  z-index: 2;
  background: #0d1018;
  padding-top: 2px;
}

.chart-main-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #d0d0d0;
  letter-spacing: 0.3px;
}

.chart-legend {
  display: flex;
  gap: 1rem;
  flex-shrink: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-text {
  font-size: 0.72rem;
  color: #888;
  white-space: nowrap;
}

.chart-tooltip {
  position: absolute;
  pointer-events: none;
  background: #1f2430;
  border: 1px solid #3a3f55;
  border-radius: 6px;
  padding: 8px 12px;
  min-width: 160px;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.tt-time {
  font-size: 0.75rem;
  color: #aaa;
  margin-bottom: 6px;
  white-space: nowrap;
}
.tt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
}
.tt-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tt-label { color: #ccc; flex: 1; }
.tt-value { color: #fff; font-weight: 600; }
</style>
