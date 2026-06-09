<template>
  <div class="bp-wrapper">
    <div v-if="label" class="bp-label">{{ label }}</div>
    <div v-if="!stats" class="bp-empty">Insufficient data</div>
    <div v-else>
      <div ref="containerRef" class="bp-svg-area"></div>
      <!-- Stats strip -->
      <div class="bp-stats-strip">
        <div class="bp-stat">
          <span class="bp-stat__k">min</span>
          <span class="bp-stat__v">{{ fmt(stats.min) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">Q1</span>
          <span class="bp-stat__v">{{ fmt(stats.q1) }}</span>
        </div>
        <div class="bp-stat bp-stat--hi">
          <span class="bp-stat__k">median</span>
          <span class="bp-stat__v" style="color:#fade2a">{{ fmt(stats.median) }}</span>
        </div>
        <div class="bp-stat bp-stat--hi">
          <span class="bp-stat__k">μ</span>
          <span class="bp-stat__v" style="color:#aaaaaa">{{ fmt(stats.mean) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">Q3</span>
          <span class="bp-stat__v">{{ fmt(stats.q3) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">max</span>
          <span class="bp-stat__v">{{ fmt(stats.max) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">σ</span>
          <span class="bp-stat__v">{{ fmt(stats.std) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">IQR</span>
          <span class="bp-stat__v">{{ fmt(stats.iqr) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">UCL</span>
          <span class="bp-stat__v" style="color:#e84040">{{ fmt(stats.ucl) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">LCL</span>
          <span class="bp-stat__v" style="color:#e84040">{{ fmt(stats.lcl) }}</span>
        </div>
        <div class="bp-stat">
          <span class="bp-stat__k">n</span>
          <span class="bp-stat__v">{{ stats.n }}</span>
        </div>
        <div v-if="stats.outliers.length" class="bp-stat">
          <span class="bp-stat__k">outliers</span>
          <span class="bp-stat__v" style="color:#e84040">{{ stats.outliers.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'
import type { SensorStats } from '@/composables/useStatistics'

const props = defineProps<{
  stats:  SensorStats | null
  unit?:  string
  label?: string
  decimals?: number
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let ro: ResizeObserver

function fmt(v: number) {
  const dec = props.decimals ?? 1
  return v.toFixed(dec) + (props.unit ?? '')
}

function draw() {
  if (!containerRef.value || !props.stats) return
  const el = containerRef.value
  d3.select(el).select('svg').remove()

  const st     = props.stats
  const margin = { top: 18, right: 32, bottom: 18, left: 32 }
  const height = 72
  const W      = el.clientWidth - margin.left - margin.right
  const H      = height - margin.top - margin.bottom
  const cy     = H / 2  // center Y of the horizontal box

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth)
    .attr('height', height)
    .style('overflow', 'visible')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Domain: extend to show outliers and UCL/LCL
  const domainMin = Math.min(st.whiskerLow,  st.lcl, ...st.outliers) - (st.iqr * 0.1 || 1)
  const domainMax = Math.max(st.whiskerHigh, st.ucl, ...st.outliers) + (st.iqr * 0.1 || 1)

  const x = d3.scaleLinear().domain([domainMin, domainMax]).range([0, W])

  // ── UCL / LCL background ticks ──────────────────────────────────────────
  const ctrlLines = [
    { v: st.lcl, color: '#e84040', label: 'LCL' },
    { v: st.ucl, color: '#e84040', label: 'UCL' },
    { v: st.sigma2.lower, color: '#f58b06', label: '' },
    { v: st.sigma2.upper, color: '#f58b06', label: '' },
    { v: st.sigma1.lower, color: '#73bf69', label: '' },
    { v: st.sigma1.upper, color: '#73bf69', label: '' },
  ]
  ctrlLines.forEach(l => {
    g.append('line')
      .attr('x1', x(l.v)).attr('x2', x(l.v))
      .attr('y1', 0).attr('y2', H)
      .attr('stroke', l.color).attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,2').attr('opacity', 0.5)
    if (l.label) {
      g.append('text')
        .attr('x', x(l.v)).attr('y', -4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '7px').attr('fill', l.color)
        .text(l.label)
    }
  })

  // ── Whisker line ──────────────────────────────────────────────────────────
  g.append('line')
    .attr('x1', x(st.whiskerLow)).attr('x2', x(st.whiskerHigh))
    .attr('y1', cy).attr('y2', cy)
    .attr('stroke', '#555').attr('stroke-width', 1.5)

  // Whisker end caps
  ;[st.whiskerLow, st.whiskerHigh].forEach(v => {
    g.append('line')
      .attr('x1', x(v)).attr('x2', x(v))
      .attr('y1', cy - 7).attr('y2', cy + 7)
      .attr('stroke', '#555').attr('stroke-width', 1.5)
  })

  // ── IQR box (Q1 → Q3) ────────────────────────────────────────────────────
  const boxH = 22
  g.append('rect')
    .attr('x', x(st.q1))
    .attr('y', cy - boxH / 2)
    .attr('width', Math.max(x(st.q3) - x(st.q1), 1))
    .attr('height', boxH)
    .attr('fill', '#1a3055')
    .attr('stroke', '#4a90d9')
    .attr('stroke-width', 1.5)
    .attr('rx', 2)

  // ── Median line ───────────────────────────────────────────────────────────
  g.append('line')
    .attr('x1', x(st.median)).attr('x2', x(st.median))
    .attr('y1', cy - boxH / 2).attr('y2', cy + boxH / 2)
    .attr('stroke', '#fade2a').attr('stroke-width', 2.5)

  // ── Mean diamond ──────────────────────────────────────────────────────────
  const mx = x(st.mean)
  const md = 6
  g.append('path')
    .attr('d', `M${mx},${cy - md} L${mx + md},${cy} L${mx},${cy + md} L${mx - md},${cy} Z`)
    .attr('fill', '#aaaaaa')
    .attr('opacity', 0.9)

  // ── Outlier dots ──────────────────────────────────────────────────────────
  st.outliers.forEach(v => {
    g.append('circle')
      .attr('cx', x(v)).attr('cy', cy)
      .attr('r', 3.5)
      .attr('fill', 'none')
      .attr('stroke', '#e84040')
      .attr('stroke-width', 1.5)
  })

  // ── X-axis (minimal) ─────────────────────────────────────────────────────
  g.append('g').attr('transform', `translate(0,${H + 2})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${(d as number).toFixed(0)}${props.unit ?? ''}`))
    .call(gr => gr.select('.domain').remove())
    .call(gr => gr.selectAll('.tick line').attr('stroke', '#333'))
    .call(gr => gr.selectAll('text').attr('fill', '#555').attr('font-size', '8px'))
}

onMounted(() => {
  draw()
  ro = new ResizeObserver(draw)
  if (containerRef.value) ro.observe(containerRef.value)
})
onUnmounted(() => ro?.disconnect())
watch(() => props.stats, draw, { deep: true })
</script>

<style scoped>
.bp-wrapper { width: 100%; }

.bp-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #666;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 2px;
  padding-left: 2px;
}

.bp-empty {
  font-size: 0.75rem;
  color: #444;
  padding: 8px 4px;
  font-style: italic;
}

.bp-svg-area { width: 100%; }

.bp-stats-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding: 6px 4px 2px;
  border-top: 1px solid #1a1a1a;
  margin-top: 2px;
}

.bp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.bp-stat__k {
  font-size: 0.62rem;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.bp-stat__v {
  font-size: 0.75rem;
  color: #aaa;
  font-weight: 600;
  font-family: 'Roboto Mono', monospace;
}
</style>
