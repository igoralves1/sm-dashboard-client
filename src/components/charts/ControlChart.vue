<template>
  <div class="cc-wrapper" :class="theme === 'light' ? 'chart-theme-light' : 'chart-theme-dark'">
    <div v-if="title" class="cc-title">{{ title }}</div>
    <div ref="containerRef" class="cc-container" style="position:relative">
      <div ref="tooltipRef" class="cc-tooltip" style="display:none">
        <div class="tt-time"></div>
        <div class="tt-row">
          <span class="tt-dot"></span>
          <span class="tt-val"></span>
        </div>
        <div class="tt-stats"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import { zScore, pValue, sigmaZone, ZONE_COLORS, type SensorStats } from '@/composables/useStatistics'

interface DataPoint { time: Date; value: number }

const props = defineProps<{
  data:    DataPoint[]
  stats:   SensorStats | null
  unit?:   string
  title?:  string
  height?: number
  yDomain?: [number, number]
  theme?:  'dark' | 'light'
}>()

const { t } = useI18n()
const containerRef = ref<HTMLDivElement | null>(null)

const tc = computed(() => props.theme === 'light' ? {
  grid: '#e4eaf4', axisLine: '#c8d8e8', axisText: '#6a7a9a',
  label: '#8a9ab8', crosshair: '#9ab0cc', dataLine: '#3a7abf',
} : {
  grid: '#222', axisLine: '#333', axisText: '#666',
  label: '#555', crosshair: '#444', dataLine: '#4a90d9',
})
const tooltipRef   = ref<HTMLDivElement | null>(null)
let ro: ResizeObserver
let io: IntersectionObserver

function draw() {
  if (!containerRef.value || !props.data.length) return
  const el = containerRef.value
  if (el.clientWidth <= 0) return   // not laid out yet — IntersectionObserver will retry
  d3.select(el).select('svg').remove()

  const margin = { top: 18, right: 24, bottom: 36, left: 56 }
  const W = el.clientWidth - margin.left - margin.right
  const H = (props.height ?? 200) - margin.top - margin.bottom

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth)
    .attr('height', props.height ?? 200)
    .style('overflow', 'visible')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleTime()
    .domain(d3.extent(props.data, d => d.time) as [Date, Date])
    .range([0, W])

  const vals   = props.data.map(d => d.value)
  const st     = props.stats
  const rawMin = d3.min(vals)!
  const rawMax = d3.max(vals)!
  const pad    = (rawMax - rawMin) * 0.15 || 5

  const yMin = props.yDomain ? props.yDomain[0] : Math.min(rawMin - pad, st ? st.lcl - pad : rawMin - pad)
  const yMax = props.yDomain ? props.yDomain[1] : Math.max(rawMax + pad, st ? st.ucl + pad : rawMax + pad)

  const y = d3.scaleLinear().domain([yMin, yMax]).range([H, 0]).nice()

  // ── Sigma band fills ───────────────────────────────────────────────────────
  if (st) {
    const bands = [
      { lo: st.sigma2.lower, hi: st.sigma3.upper, fill: 'rgba(232,64,64,0.06)' },   // 2σ–3σ outer
      { lo: st.sigma1.lower, hi: st.sigma2.upper, fill: 'rgba(245,139,6,0.07)' },   // 1σ–2σ middle
      { lo: st.sigma1.lower, hi: st.sigma1.upper, fill: 'rgba(115,191,105,0.07)' }, // ±1σ inner
    ]
    bands.forEach(b => {
      const lo = Math.max(b.lo, yMin)
      const hi = Math.min(b.hi, yMax)
      if (hi <= lo) return
      g.append('rect')
        .attr('x', 0).attr('width', W)
        .attr('y', y(hi)).attr('height', y(lo) - y(hi))
        .attr('fill', b.fill)
    })

    // Also 3σ lower half
    const lo3 = Math.max(st.sigma3.lower, yMin)
    const hi3 = Math.min(st.sigma2.lower, yMax)
    if (hi3 > lo3) {
      g.append('rect')
        .attr('x', 0).attr('width', W)
        .attr('y', y(hi3)).attr('height', y(lo3) - y(hi3))
        .attr('fill', 'rgba(232,64,64,0.06)')
    }

    // Sigma lines
    const lines = [
      { v: st.mean,          color: '#aaaaaa', dash: '',      label: 'μ',   width: 1.5 },
      { v: st.sigma1.upper,  color: '#73bf69', dash: '4,3',   label: '+1σ', width: 1 },
      { v: st.sigma1.lower,  color: '#73bf69', dash: '4,3',   label: '−1σ', width: 1 },
      { v: st.sigma2.upper,  color: '#f58b06', dash: '4,3',   label: '+2σ', width: 1 },
      { v: st.sigma2.lower,  color: '#f58b06', dash: '4,3',   label: '−2σ', width: 1 },
      { v: st.ucl,           color: '#e84040', dash: '6,3',   label: 'UCL', width: 1.5 },
      { v: st.lcl,           color: '#e84040', dash: '6,3',   label: 'LCL', width: 1.5 },
    ]
    lines.forEach(l => {
      if (l.v < yMin || l.v > yMax) return
      g.append('line')
        .attr('x1', 0).attr('x2', W)
        .attr('y1', y(l.v)).attr('y2', y(l.v))
        .attr('stroke', l.color)
        .attr('stroke-width', l.width)
        .attr('stroke-dasharray', l.dash)
        .attr('opacity', 0.75)
      // Label on right edge
      g.append('text')
        .attr('x', W + 3).attr('y', y(l.v) + 3.5)
        .attr('font-size', '8px').attr('fill', l.color)
        .text(l.label)
    })
  }

  // ── Grid ──────────────────────────────────────────────────────────────────
  g.append('g')
    .call(d3.axisLeft(y).tickSize(-W).tickFormat(() => ''))
    .call(gr => gr.select('.domain').remove())
    .call(gr => gr.selectAll('.tick line').attr('stroke', tc.value.grid).attr('stroke-dasharray', '2,2'))

  // ── Data line ─────────────────────────────────────────────────────────────
  const line = d3.line<DataPoint>()
    .x(d => x(d.time))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX)

  g.append('path')
    .datum(props.data)
    .attr('fill', 'none')
    .attr('stroke', tc.value.dataLine)
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.5)
    .attr('d', line)

  // ── Colored dots by sigma zone ─────────────────────────────────────────────
  if (st) {
    // Only draw dots for out-of-zone points to avoid clutter; draw all when few
    const total = props.data.length
    const drawAll = total <= 120

    props.data.forEach(d => {
      const z  = zScore(d.value, st.mean, st.std)
      const zone = sigmaZone(z)
      if (!drawAll && zone === 0) return   // skip green dots when many points
      g.append('circle')
        .attr('cx', x(d.time)).attr('cy', y(d.value))
        .attr('r', zone >= 3 ? 4 : zone >= 2 ? 3 : 2)
        .attr('fill', ZONE_COLORS[zone])
        .attr('opacity', zone === 0 ? 0.35 : 0.9)
    })
  }

  // ── Axes ──────────────────────────────────────────────────────────────────
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d3.timeFormat('%H:%M')(d as Date)))
    .call(gr => gr.select('.domain').attr('stroke', tc.value.axisLine))
    .call(gr => gr.selectAll('.tick line').attr('stroke', tc.value.axisLine))
    .call(gr => gr.selectAll('text').attr('fill', tc.value.axisText).attr('font-size', '9px'))

  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d as number).toFixed(0)}${props.unit ?? ''}`))
    .call(gr => gr.select('.domain').attr('stroke', tc.value.axisLine))
    .call(gr => gr.selectAll('text').attr('fill', tc.value.axisText).attr('font-size', '9px'))
    .call(gr => gr.selectAll('.tick line').attr('stroke', tc.value.axisLine))

  // X-label
  svg.append('text')
    .attr('x', margin.left + W / 2)
    .attr('y', margin.top + H + margin.bottom - 2)
    .attr('text-anchor', 'middle')
    .attr('fill', tc.value.label).attr('font-size', '9px')
    .text(t('spc.hora_do_dia'))

  // ── Tooltip overlay ───────────────────────────────────────────────────────
  const bisect = d3.bisector((d: DataPoint) => d.time).left

  const crosshair = g.append('line')
    .attr('stroke', tc.value.crosshair).attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,3')
    .attr('y1', 0).attr('y2', H).style('display', 'none')

  const dot = g.append('circle').attr('r', 4)
    .attr('stroke', '#fff').attr('stroke-width', 1)
    .style('display', 'none')

  g.append('rect')
    .attr('width', W).attr('height', H).attr('fill', 'transparent')
    .on('mousemove', (event: MouseEvent) => {
      if (!tooltipRef.value) return
      const [mx] = d3.pointer(event)
      const date = x.invert(mx)
      const idx  = bisect(props.data, date, 1)
      const d0   = props.data[idx - 1]
      const d1   = props.data[idx]
      if (!d0) return
      const pt = d1 && (date.getTime() - d0.time.getTime()) > (d1.time.getTime() - date.getTime()) ? d1 : d0

      const cx = x(pt.time)
      const cy = y(pt.value)

      crosshair.attr('x1', cx).attr('x2', cx).style('display', null)

      let dotColor = '#4a90d9'
      let statsText = ''
      if (st) {
        const z  = zScore(pt.value, st.mean, st.std)
        const pv = pValue(z)
        const zone = sigmaZone(z)
        dotColor = ZONE_COLORS[zone]
        statsText = `z = ${z.toFixed(2)}  ·  p = ${(pv * 100).toFixed(2)}%`
      }

      dot.attr('cx', cx).attr('cy', cy).attr('fill', dotColor).style('display', null)

      const tt = tooltipRef.value
      tt.style.display = 'block'
      const ttW = tt.offsetWidth || 180
      const chartW = el.clientWidth
      const absX = cx + margin.left
      tt.style.left = (absX + ttW + 14 > chartW ? absX - ttW - 8 : absX + 12) + 'px'
      tt.style.top  = (cy + margin.top - 14) + 'px'
      ;(tt.querySelector('.tt-time') as HTMLElement).textContent = d3.timeFormat('%Y-%m-%d %H:%M')(pt.time)
      ;(tt.querySelector('.tt-dot')  as HTMLElement).style.background = dotColor
      ;(tt.querySelector('.tt-val')  as HTMLElement).textContent = `${pt.value.toFixed(2)}${props.unit ?? ''}`
      ;(tt.querySelector('.tt-stats') as HTMLElement).textContent = statsText
    })
    .on('mouseleave', () => {
      crosshair.style('display', 'none')
      dot.style('display', 'none')
      if (tooltipRef.value) tooltipRef.value.style.display = 'none'
    })
}

onMounted(async () => {
  await nextTick()
  draw()
  ro = new ResizeObserver(draw)
  if (containerRef.value) ro.observe(containerRef.value)
  // Re-draw when panel becomes visible — use rAF so browser layout is complete first
  io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) requestAnimationFrame(draw)
  }, { threshold: 0.01 })
  if (containerRef.value) io.observe(containerRef.value)
})
onUnmounted(() => { ro?.disconnect(); io?.disconnect() })
watch(() => [props.data, props.stats], draw, { deep: true })
watch(() => props.theme, draw)
</script>

<style scoped>
.cc-wrapper { width: 100%; }
.cc-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: #888;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 4px;
  padding-left: 2px;
}
.cc-container { width: 100%; }
.cc-tooltip {
  position: absolute;
  pointer-events: none;
  background: #151c28;
  border: 1px solid #2a3550;
  border-radius: 6px;
  padding: 8px 12px;
  min-width: 170px;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
}
.tt-time  { font-size: 0.72rem; color: #666; margin-bottom: 5px; white-space: nowrap; }
.tt-row   { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; }
.tt-dot   { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.tt-val   { color: #e0e0e0; font-weight: 600; }
.tt-stats { font-size: 0.72rem; color: #8ab4d4; margin-top: 5px; font-family: monospace; }

/* ── Light theme ── */
.chart-theme-light .cc-title { color: #102a83; }
.chart-theme-light .cc-tooltip {
  background: #ffffff;
  border-color: #dce6f0;
  box-shadow: 0 4px 20px rgba(16,42,131,0.1);
}
.chart-theme-light .tt-time { color: #7a8fb5; }
.chart-theme-light .tt-val  { color: #102a83; }
.chart-theme-light .tt-stats { color: #5a8abd; }
</style>
