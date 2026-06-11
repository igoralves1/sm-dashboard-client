<template>
  <div class="bp-wrapper" :class="theme === 'light' ? 'chart-theme-light' : 'chart-theme-dark'">
    <div v-if="label" class="bp-label" :style="{ color: labelColor }">
      {{ label }}<span v-if="unit" class="bp-label__unit"> ({{ unit }})</span>
      <span v-if="stats !== null" class="bp-label__status">
        · {{ isInControl ? t('spc.in_control') : t('spc.out_of_control') }}
      </span>
    </div>
    <!-- containerRef always in DOM so observers attach on mount regardless of stats -->
    <div ref="containerRef" class="bp-svg-area" style="position:relative">
      <div ref="tipRef" class="bp-tip" style="display:none"></div>
    </div>
    <div v-if="!stats" class="bp-empty">{{ t('spc.insufficient_data') }}</div>

    <!-- Collapsible interpretation panel (contains stats + findings) -->
    <div v-if="stats" class="bp-interp">
      <button class="bp-interp__toggle" @click="interpOpen = !interpOpen">
        <span>▶ {{ t('spc.interpretation') }}</span>
        <span class="bp-interp__chevron" :class="{ open: interpOpen }">▾</span>
      </button>
      <div v-show="interpOpen" class="bp-interp__body">
        <!-- Stats strip — sorted by actual value so order always matches chart left→right -->
        <div class="bp-stats-strip">
          <div v-for="s in sortedStatsStrip" :key="s.k" class="bp-stat" :class="{ 'bp-stat--divider': s.divider }">
            <span class="bp-stat__k">{{ s.k }}</span>
            <span class="bp-stat__v" :style="{ color: s.color }">{{ s.v }}</span>
          </div>
        </div>
        <!-- Findings -->
        <div class="bp-interp__findings">
          <p v-for="(line, i) in interpretation" :key="i" class="bp-interp__line">
            <span class="bp-interp__bullet" :style="{ color: line.color }">{{ line.icon }}</span>
            {{ line.text }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useChartTheme } from '@/composables/useChartTheme'
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import type { SensorStats } from '@/composables/useStatistics'

const props = defineProps<{
  stats:    SensorStats | null
  unit?:    string
  label?:   string
  decimals?: number
  theme?:   'dark' | 'light'
}>()

const { t } = useI18n()
const containerRef = ref<HTMLDivElement | null>(null)
const tipRef       = ref<HTMLDivElement | null>(null)
const interpOpen   = ref(false)
let ro: ResizeObserver
let io: IntersectionObserver

const isInControl = computed(() => {
  if (!props.stats) return null
  return props.stats.min >= props.stats.lcl && props.stats.max <= props.stats.ucl
})

const labelColor = computed(() => {
  if (isInControl.value === null) return '#666'
  return isInControl.value ? '#73bf69' : '#e84040'
})

const tc = useChartTheme(() => props.theme)

interface InterpLine { icon: string; color: string; text: string }

const sortedStatsStrip = computed(() => {
  const st = props.stats
  if (!st) return []
  const dec = props.decimals ?? 1
  // Positional entries — sort by numeric value so strip always matches chart left→right
  const positional = [
    { k: t('spc.stats.lcl'),    numV: st.lcl,    color: '#e84040' },
    { k: t('spc.stats.min'),    numV: st.whiskerLow,  color: '#aaa' },
    { k: t('spc.stats.q1'),     numV: st.q1,          color: '#aaa' },
    { k: 'μ',                   numV: st.mean,        color: '#aaaaaa' },
    { k: t('spc.stats.median'), numV: st.median,      color: tc.value.median },
    { k: t('spc.stats.q3'),     numV: st.q3,          color: '#aaa' },
    { k: t('spc.stats.max'),    numV: st.whiskerHigh, color: '#aaa' },
    { k: t('spc.stats.ucl'),    numV: st.ucl,    color: '#e84040' },
  ].sort((a, b) => a.numV - b.numV)
   .map(e => ({ k: e.k, v: e.numV.toFixed(dec + 1), color: e.color, divider: false }))

  // Derived stats (no positional meaning) — appended after divider
  const derived = [
    { k: t('spc.stats.std'),      v: st.std.toFixed(dec + 1), color: '#aaa', divider: true },
    { k: t('spc.stats.iqr'),      v: st.iqr.toFixed(dec + 1), color: '#aaa', divider: false },
    { k: t('spc.stats.n'),        v: String(st.n),        color: '#aaa', divider: false },
    ...(st.outliers.length ? [{ k: t('spc.stats.outliers'), v: String(st.outliers.length), color: '#e84040', divider: false }] : []),
  ]

  return [...positional, ...derived]
})

const interpretation = computed<InterpLine[]>(() => {
  const st = props.stats
  if (!st) return []
  const dec  = props.decimals ?? 1
  const u    = props.unit ? ` ${props.unit}` : ''
  const lines: InterpLine[] = []

  // 1. Process control
  const inControl = st.min >= st.lcl && st.max <= st.ucl
  lines.push(inControl
    ? { icon: '✔', color: '#73bf69', text: t('spc.interp.in_control',  { ucl: st.ucl.toFixed(dec) + u, lcl: st.lcl.toFixed(dec) + u }) }
    : { icon: '✘', color: '#e84040', text: t('spc.interp.out_of_control', { ucl: st.ucl.toFixed(dec) + u, lcl: st.lcl.toFixed(dec) + u }) }
  )

  // 2. Outliers
  if (st.outliers.length > 0) {
    lines.push({ icon: '⚠', color: '#f58b06', text: t('spc.interp.outliers_found', { n: st.outliers.length }) })
  } else {
    lines.push({ icon: '✔', color: '#73bf69', text: t('spc.interp.no_outliers') })
  }

  // 3. Symmetry
  const skew    = st.mean - st.median
  const skewPct = st.std > 0 ? Math.abs(skew) / st.std : 0
  if (skewPct < 0.2) {
    lines.push({ icon: '◈', color: '#aaaaaa', text: t('spc.interp.symmetric',    { mean: st.mean.toFixed(dec) + u, median: st.median.toFixed(dec) + u }) })
  } else if (skew > 0) {
    lines.push({ icon: '◈', color: '#f58b06', text: t('spc.interp.right_skewed', { mean: st.mean.toFixed(dec) + u, median: st.median.toFixed(dec) + u }) })
  } else {
    lines.push({ icon: '◈', color: '#f58b06', text: t('spc.interp.left_skewed',  { mean: st.mean.toFixed(dec) + u, median: st.median.toFixed(dec) + u }) })
  }

  // 4. Variability
  const cvPct = st.mean > 0 ? (st.std / st.mean) * 100 : 0
  const sigmaStr = st.std.toFixed(dec) + u
  if (cvPct < 5) {
    lines.push({ icon: '◉', color: '#73bf69', text: t('spc.interp.low_variability',      { cv: cvPct.toFixed(1), sigma: sigmaStr }) })
  } else if (cvPct < 15) {
    lines.push({ icon: '◉', color: '#f58b06', text: t('spc.interp.moderate_variability', { cv: cvPct.toFixed(1), sigma: sigmaStr }) })
  } else {
    lines.push({ icon: '◉', color: '#e84040', text: t('spc.interp.high_variability',     { cv: cvPct.toFixed(1), sigma: sigmaStr }) })
  }

  // 5. Sample size
  if (st.n < 30) {
    lines.push({ icon: 'ℹ', color: '#555', text: t('spc.interp.small_sample', { n: st.n }) })
  }

  return lines
})

function fmt(v: number) {
  const dec = props.decimals ?? 1
  return v.toFixed(dec)
}

function draw() {
  if (!containerRef.value || !props.stats) return
  const el = containerRef.value
  if (el.clientWidth <= 0) return   // not laid out yet — IntersectionObserver will retry
  d3.select(el).select('svg').remove()

  const st     = props.stats
  const margin = { top: 52, right: 32, bottom: 36, left: 32 }
  const height = 110
  const W      = el.clientWidth - margin.left - margin.right
  const H      = height - margin.top - margin.bottom
  const cy     = H / 2

  const svg = d3.select(el).append('svg')
    .attr('width', el.clientWidth)
    .attr('height', height)
    .style('overflow', 'visible')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // ── Piecewise broken-axis scale ───────────────────────────────────────────
  // All data (outliers, LCL, UCL) is shown in compressed side strips separated
  // from the main data by // break symbols.
  const dec = props.decimals ?? 1
  const allVals = [st.min, st.lcl, st.whiskerLow, st.q1, st.median, st.mean,
                   st.q3, st.whiskerHigh, st.ucl, st.max, ...st.outliers]
  const trueMin = Math.min(...allVals)
  const trueMax = Math.max(...allVals)

  // Main zone: everything within 1.5× whisker spread of the whiskers
  const mainSpread = Math.max(st.whiskerHigh - st.whiskerLow, st.iqr * 3) || 1
  const mainPad    = mainSpread * 0.18
  const mainMin    = st.whiskerLow - mainPad
  const mainMax    = st.whiskerHigh + mainPad

  // Only break if the out-of-range value is MORE than 40% of mainSpread away from the main zone
  // — prevents spurious breaks when LCL/UCL are just barely outside
  const breakThreshold = mainSpread * 0.4
  const needLeft  = trueMin < mainMin && (mainMin - trueMin) > breakThreshold
  const needRight = trueMax > mainMax && (trueMax - mainMax) > breakThreshold

  const breakGap  = 10   // px gap for the // symbol
  const sideW     = needLeft || needRight ? Math.min(60, W * 0.12) : 0

  const leftStart  = 0
  const leftEnd    = needLeft ? sideW : 0
  const mainStart  = leftEnd + (needLeft ? breakGap : 0)
  const mainEnd    = W - (needRight ? sideW + breakGap : 0)
  const rightStart = needRight ? mainEnd + breakGap : W
  const rightEnd   = W

  // Piecewise mapping function (replaces d3 linear scale)
  const domainMin = needLeft ? trueMin - (trueMin < 0 ? 1 : Math.abs(trueMin) * 0.05 + 0.5) : mainMin
  const domainMax = needRight ? trueMax + Math.abs(trueMax) * 0.05 + 0.5 : mainMax

  // When a side has no break, extend the main zone to absorb all values on that side
  const fullMin = needLeft  ? mainMin : trueMin - mainPad * 0.5
  const fullMax = needRight ? mainMax : trueMax + mainPad * 0.5

  const xLeft  = needLeft  ? d3.scaleLinear().domain([trueMin - mainPad * 0.3, mainMin]).range([leftStart, leftEnd]) : null
  const xMain  = d3.scaleLinear().domain([fullMin, fullMax]).range([mainStart, mainEnd])
  const xRight = needRight ? d3.scaleLinear().domain([mainMax, trueMax + mainPad * 0.3]).range([rightStart, rightEnd]) : null

  const x = (v: number): number => {
    if (needLeft  && xLeft  && v < mainMin) return xLeft(v)
    if (needRight && xRight && v > mainMax) return xRight(v)
    return xMain(v)   // always covers everything when no break on that side
  }
  // Make x behave like a d3 scale for invert/ticks usage on main zone
  ;(x as any).domain = () => [mainMin, mainMax]
  ;(x as any).range  = () => [mainStart, mainEnd]

  // ── All annotated markers (sorted by value for stagger assignment) ─────────
  const markers: { v: number; label: string; color: string; dash: string; width: number }[] = [
    { v: st.lcl,          label: 'LCL', color: '#e84040', dash: '4,2', width: 1 },
    { v: st.ucl,          label: 'UCL', color: '#e84040', dash: '4,2', width: 1 },
    { v: st.sigma2.lower, label: '-2σ', color: '#f58b06', dash: '3,2', width: 1 },
    { v: st.sigma2.upper, label: '+2σ', color: '#f58b06', dash: '3,2', width: 1 },
    { v: st.sigma1.lower, label: '-1σ', color: '#73bf69', dash: '3,2', width: 1 },
    { v: st.sigma1.upper, label: '+1σ', color: '#73bf69', dash: '3,2', width: 1 },
    { v: st.whiskerLow,   label: 'Min', color: '#888888', dash: '',    width: 1.5 },
    { v: st.whiskerHigh,  label: 'Max', color: '#888888', dash: '',    width: 1.5 },
    { v: st.q1,           label: 'Q1',  color: '#4a90d9', dash: '',    width: 0 },
    { v: st.q3,           label: 'Q3',  color: '#4a90d9', dash: '',    width: 0 },
    { v: st.median,       label: 'Med', color: tc.value.median, dash: '',    width: 0 },
    { v: st.mean,         label: 'μ',   color: '#aaaaaa', dash: '',    width: 0 },
  ]

  // ── Tooltip helpers ───────────────────────────────────────────────────────
  const tip = tipRef.value
  const showTip = (event: MouseEvent, label: string, value: number, color = '#aaaaaa') => {
    if (!tip) return
    tip.innerHTML = `<span class="bp-tip__k" style="color:${color}">${label}</span><span class="bp-tip__v" style="color:${color}">${value.toFixed(dec + 1)}${props.unit ? ' ' + props.unit : ''}</span>`
    tip.style.display = 'flex'
    tip.style.borderColor = color + '55'
    const svgRect = el.getBoundingClientRect()
    const tx = event.clientX - svgRect.left + 8
    const ty = event.clientY - svgRect.top  - 28
    tip.style.left = `${Math.min(tx, el.clientWidth - 140)}px`
    tip.style.top  = `${ty}px`
  }
  const hideTip = () => { if (tip) tip.style.display = 'none' }

  // Draw background dashed lines — all values mapped via piecewise x()
  markers.filter(m => m.dash).forEach(m => {
    const px = x(m.v)
    // Invisible wider hit area for hover
    if (m.label) {
      g.append('line')
        .attr('x1', px).attr('x2', px)
        .attr('y1', 0).attr('y2', H)
        .attr('stroke', 'transparent').attr('stroke-width', 10)
        .style('cursor', 'crosshair')
        .on('mousemove', (e: MouseEvent) => showTip(e, m.label, m.v, m.color))
        .on('mouseleave', hideTip)
    }
    g.append('line')
      .attr('x1', px).attr('x2', px)
      .attr('y1', 0).attr('y2', H)
      .attr('stroke', m.color).attr('stroke-width', m.width || 1)
      .attr('stroke-dasharray', m.dash).attr('opacity', 0.45)
  })

  // ── Whisker line ──────────────────────────────────────────────────────────
  const boxH = 22
  g.append('line')
    .attr('x1', x(st.whiskerLow)).attr('x2', x(st.whiskerHigh))
    .attr('y1', cy).attr('y2', cy)
    .attr('stroke', tc.value.whisker).attr('stroke-width', 1.5)

  ;[{ v: st.whiskerLow, label: 'Min' }, { v: st.whiskerHigh, label: 'Max' }].forEach(({ v, label }) => {
    g.append('line')
      .attr('x1', x(v)).attr('x2', x(v))
      .attr('y1', cy - 7).attr('y2', cy + 7)
      .attr('stroke', tc.value.whisker).attr('stroke-width', 1.5)
    // Hit area
    g.append('line')
      .attr('x1', x(v)).attr('x2', x(v))
      .attr('y1', cy - 12).attr('y2', cy + 12)
      .attr('stroke', 'transparent').attr('stroke-width', 10)
      .style('cursor', 'crosshair')
      .on('mousemove', (e: MouseEvent) => showTip(e, label, v, '#888888'))
      .on('mouseleave', hideTip)
  })

  // ── IQR box (Q1 → Q3) ─────────────────────────────────────────────────────
  g.append('rect')
    .attr('x', x(st.q1))
    .attr('y', cy - boxH / 2)
    .attr('width', Math.max(x(st.q3) - x(st.q1), 1))
    .attr('height', boxH)
    .attr('fill', tc.value.boxFill)
    .attr('stroke', '#4a90d9')
    .attr('stroke-width', 1.5)
    .attr('rx', 2)
    .style('cursor', 'crosshair')
    .on('mousemove', (e: MouseEvent) => {
      const c = '#4a90d9'
      const u = props.unit ? ' ' + props.unit : ''
      if (tip) {
        tip.innerHTML =
          `<span class="bp-tip__k" style="color:${c}">Q1</span><span class="bp-tip__v" style="color:${c}">${st.q1.toFixed(dec + 1)}${u}</span>` +
          `<span class="bp-tip__sep" style="color:${c}">→</span>` +
          `<span class="bp-tip__k" style="color:${c}">Q3</span><span class="bp-tip__v" style="color:${c}">${st.q3.toFixed(dec + 1)}${u}</span>` +
          `<span class="bp-tip__sep" style="color:${c}">·</span>` +
          `<span class="bp-tip__k" style="color:${c}">IQR</span><span class="bp-tip__v" style="color:${c}">${st.iqr.toFixed(dec + 1)}</span>`
        tip.style.borderColor = c + '55'
        tip.style.display = 'flex'
        const r = el.getBoundingClientRect()
        tip.style.left = `${Math.min(e.clientX - r.left + 8, el.clientWidth - 200)}px`
        tip.style.top  = `${e.clientY - r.top - 28}px`
      }
    })
    .on('mouseleave', hideTip)

  // ── Median line ───────────────────────────────────────────────────────────
  g.append('line')
    .attr('x1', x(st.median)).attr('x2', x(st.median))
    .attr('y1', cy - boxH / 2).attr('y2', cy + boxH / 2)
    .attr('stroke', tc.value.median).attr('stroke-width', 2.5)
  g.append('line')  // hit area
    .attr('x1', x(st.median)).attr('x2', x(st.median))
    .attr('y1', cy - boxH / 2 - 4).attr('y2', cy + boxH / 2 + 4)
    .attr('stroke', 'transparent').attr('stroke-width', 10)
    .style('cursor', 'crosshair')
    .on('mousemove', (e: MouseEvent) => showTip(e, 'Median', st.median, tc.value.median))
    .on('mouseleave', hideTip)

  // ── Mean diamond ──────────────────────────────────────────────────────────
  const mx = x(st.mean)
  const md = 6
  g.append('path')
    .attr('d', `M${mx},${cy - md} L${mx + md},${cy} L${mx},${cy + md} L${mx - md},${cy} Z`)
    .attr('fill', '#aaaaaa').attr('opacity', 0.9)
    .style('cursor', 'crosshair')
    .on('mousemove', (e: MouseEvent) => showTip(e, 'Mean (μ)', st.mean, '#aaaaaa'))
    .on('mouseleave', hideTip)

  // ── Outlier dots (solid filled) ───────────────────────────────────────────
  st.outliers.forEach(v => {
    g.append('circle')
      .attr('cx', x(v)).attr('cy', cy)
      .attr('r', 6).attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (e: MouseEvent) => showTip(e, 'Outlier', v, '#e84040'))
      .on('mouseleave', hideTip)
    g.append('circle')
      .attr('cx', x(v)).attr('cy', cy)
      .attr('r', 4).attr('fill', '#e84040').attr('opacity', 0.85)
  })

  // ── Staggered labels above the chart ─────────────────────────────────────
  const labeledMarkers = markers
    .filter(m => m.label)
    .sort((a, b) => x(a.v) - x(b.v))

  // Estimate pixel width of each label at 7.5px font (~4.8px per char + 4px pad)
  const labelW = (lbl: string) => lbl.length * 4.8 + 4

  // Multi-row greedy: up to MAX_ROWS rows, each row tracks its rightmost used px
  const MAX_ROWS   = 4
  const ROW_H      = 11   // vertical gap between rows (px)
  const BASE_Y     = -6   // y of row 0 (closest to chart)
  const rowRight   = Array(MAX_ROWS).fill(-Infinity)

  interface Placed { px: number; row: number; lbl: typeof labeledMarkers[0] }
  const placed: Placed[] = []

  labeledMarkers.forEach(m => {
    const px  = x(m.v)
    const hw  = labelW(m.label) / 2   // half-width of this label

    // Find the lowest row (closest to chart) where label doesn't overlap
    let chosen = MAX_ROWS - 1   // fallback: topmost row
    for (let r = 0; r < MAX_ROWS; r++) {
      if (px - hw > rowRight[r]) { chosen = r; break }
    }
    rowRight[chosen] = px + hw + 2   // 2px extra padding

    placed.push({ px, row: chosen, lbl: m })
  })

  // Draw ticks + labels
  placed.forEach(({ px, row, lbl }) => {
    const yPos = BASE_Y - row * ROW_H

    // Tick from chart top down to just above the label baseline
    g.append('line')
      .attr('x1', px).attr('x2', px)
      .attr('y1', 0).attr('y2', yPos + 8)
      .attr('stroke', lbl.color).attr('stroke-width', 0.75).attr('opacity', 0.5)

    g.append('text')
      .attr('x', px).attr('y', yPos)
      .attr('text-anchor', 'middle')
      .attr('font-size', '7.5px')
      .attr('font-weight', '600')
      .attr('fill', lbl.color)
      .style('cursor', 'crosshair')
      .text(lbl.label)
      .on('mousemove', (e: MouseEvent) => showTip(e, lbl.label, lbl.v, lbl.color))
      .on('mouseleave', hideTip)
  })

  // ── X-axis segments ───────────────────────────────────────────────────────
  const axY = H + 10

  // Helper: draw one axis segment
  const drawAxisSeg = (scale: d3.ScaleLinear<number,number>, ticks: number) => {
    g.append('g').attr('transform', `translate(0,${axY})`)
      .call(d3.axisBottom(scale).ticks(ticks).tickFormat(d => `${(d as number).toFixed(dec)}`))
      .call(gr => gr.select('.domain').remove())
      .call(gr => gr.selectAll('.tick line').attr('stroke', tc.value.axisLine).attr('y2', 4))
      .call(gr => gr.selectAll('text').attr('fill', tc.value.axisText).attr('font-size', '8px').attr('dy', '5px'))
  }

  // Axis baseline per segment
  const drawBaseline = (x1: number, x2: number) => {
    g.append('line')
      .attr('x1', x1).attr('x2', x2)
      .attr('y1', axY).attr('y2', axY)
      .attr('stroke', tc.value.axisLine).attr('stroke-width', 1.5)
  }

  if (needLeft && xLeft) { drawAxisSeg(xLeft, 2);  drawBaseline(leftStart, leftEnd) }
  drawAxisSeg(xMain, 5); drawBaseline(mainStart, mainEnd)
  if (needRight && xRight) { drawAxisSeg(xRight, 2); drawBaseline(rightStart, rightEnd) }

  // ── Break symbols // at segment boundaries ────────────────────────────────
  const drawBreak = (bx: number) => {
    const bh = 5
    const slashColor = tc.value.breakSlash
    // Gap: short white/bg rect to erase the axis baseline at the break point
    g.append('rect')
      .attr('x', bx - 5).attr('y', axY - 1)
      .attr('width', 10).attr('height', 2)
      .attr('fill', tc.value.breakMask)
    // Two crisp diagonal slashes — tighter and smaller
    for (let i = 0; i < 2; i++) {
      const ox = bx - 3 + i * 6
      g.append('line')
        .attr('x1', ox - 1.5).attr('x2', ox + 1.5)
        .attr('y1', axY + bh).attr('y2', axY - bh)
        .attr('stroke', slashColor).attr('stroke-width', 1.2)
        .attr('stroke-linecap', 'round')
    }
  }

  if (needLeft)  drawBreak(leftEnd  + breakGap / 2)
  if (needRight) drawBreak(mainEnd  + breakGap / 2)
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
watch(() => props.stats, () => requestAnimationFrame(draw), { deep: true, flush: 'post' })
watch(() => props.theme, () => requestAnimationFrame(draw))
</script>

<style scoped>
.bp-wrapper { width: 100%; }

.bp-label {
  font-size: 0.67rem;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin-bottom: 2px;
  padding-left: 2px;
}

.bp-label__unit {
  text-transform: none;   /* prevents m³/h → M³/H */
  font-weight: 400;
}

.bp-label__status {
  font-weight: 500;
  text-transform: none;   /* keeps "in control" lowercase */
  letter-spacing: 0;
}

.bp-empty {
  font-size: 0.68rem;
  color: #444;
  padding: 8px 4px;
  font-style: italic;
}

.bp-svg-area { width: 100%; }

.bp-tip {
  position: absolute;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 5px;
  background: #151c28;
  border: 1px solid #2a3550;
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 0.68rem;
  white-space: nowrap;
  z-index: 20;
  box-shadow: 0 3px 12px rgba(0,0,0,0.6);
}
.bp-tip__k  { color: #555; text-transform: uppercase; letter-spacing: 0.4px; }
.bp-tip__v  { color: #e0e0e0; font-family: 'Roboto Mono', monospace; margin-left: 2px; }
.bp-tip__sep { color: #333; font-size: 0.6rem; margin: 0 2px; }

.bp-stats-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 10px;
  padding: 5px 4px 2px;
  border-top: 1px solid #2e2e2e;
  margin-top: 2px;
}

.bp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.bp-stat--divider {
  border-left: 1px solid #3a3a3a;
  padding-left: 10px;
}

.bp-stat__k {
  font-size: 0.55rem;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.bp-stat__v {
  font-size: 0.58rem;
  color: #aaa;
  font-weight: 400;
  font-family: 'Roboto Mono', monospace;
}

/* ── Interpretation panel ────────────────────────────────────────────────── */
.bp-interp {
  margin-top: 4px;
  border-top: 1px solid #2e2e2e;
}

.bp-interp__toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 2px;
  color: #444;
  font-size: 0.58rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.bp-interp__toggle:hover { color: #6a8fc0; }

.bp-interp__chevron {
  transition: transform 0.2s;
  font-size: 0.75rem;
}
.bp-interp__chevron.open { transform: rotate(180deg); }

.bp-interp__body {
  padding: 4px 2px 2px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.bp-interp__findings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid #1a1a1a;
}

.bp-interp__line {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 0.6rem;
  color: #666;
  line-height: 1.4;
  margin: 0;
}

.bp-interp__bullet {
  flex-shrink: 0;
  font-size: 0.65rem;
  margin-top: 1px;
}

/* ── Light theme ── */
.chart-theme-light .bp-tip {
  background: #ffffff;
  border-color: #dce6f0;
  box-shadow: 0 3px 12px rgba(16,42,131,0.1);
}
.chart-theme-light .bp-tip__k  { color: inherit; }
.chart-theme-light .bp-tip__v  { color: #102a83; }
.chart-theme-light .bp-tip__sep { color: #b0c0d8; }
.chart-theme-light .bp-stats-strip { border-top-color: #dce6f0; }
.chart-theme-light .bp-stat--divider { border-left-color: #dce6f0; }
.chart-theme-light .bp-stat__k { color: #8a9ab8; }
.chart-theme-light .bp-empty { color: #8a9ab8; }
.chart-theme-light .bp-interp { border-top-color: #dce6f0; }
.chart-theme-light .bp-interp__toggle { color: #8a9ab8; }
.chart-theme-light .bp-interp__toggle:hover { color: #009ee0; }
.chart-theme-light .bp-interp__findings { border-top-color: #dce6f0; }
.chart-theme-light .bp-interp__line { color: #4a5572; }
</style>
