<template>
  <div class="sync-chart">
    <!-- Header: title on the left, live per-series values on the right -->
    <div class="sync-chart__head">
      <span class="sync-chart__title">{{ title }}</span>

      <div class="sync-chart__readouts">
        <span v-for="s in readout" :key="s.key" class="readout">
          <span class="readout__dot" :style="{ background: s.color }"></span>
          <span class="readout__label">{{ s.label }}</span>
          <span class="readout__value">{{ s.value }}</span>
          <span class="readout__unit">{{ s.unit }}</span>
        </span>
      </div>
    </div>

    <div ref="containerRef" class="sync-chart__plot"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * One panel of the synchronized chart stack.
 *
 * Four of these stack vertically sharing a single crosshair: the hovered
 * timestamp is lifted to the parent via v-model:cursor, so every panel renders
 * the same cursor by construction rather than through event plumbing.
 *
 * The y-domain is supplied by the caller from the device's configured
 * metadata (minV/maxV, minI/maxI, …) rather than derived from the data.
 * Auto-scaling looks reasonable until a current spike arrives and flattens the
 * whole series against the axis floor, which is exactly what these meters do.
 */
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Series } from '@/composables/useEnergisaDevice'

const { t, locale } = useI18n()

const props = withDefaults(
  defineProps<{
    series: Series[]
    title?: string
    height?: number
    cursor?: number | null
    /** Unit suffix for the readout column. */
    unit?: string
    /** Fixed y-domain. Falls back to the data extent when omitted. */
    yMin?: number | null
    yMax?: number | null
  }>(),
  { height: 168, cursor: null, unit: '', yMin: null, yMax: null, title: '' },
)

const emit = defineEmits<{ 'update:cursor': [number | null] }>()

const containerRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const MARGIN = { top: 8, right: 14, bottom: 24, left: 56 }

/**
 * Readout formatting, matching production's formatter in
 * SynchronizedCharts.tsx:265 — note the k-threshold is 10000, not 1000:
 *
 *   9307.73  →  "9,307.73 VA"     (locale separator, up to 2 decimals)
 *   14520    →  "14.52 kVA"       (scaled, unit gains a k)
 *
 * Applying k from 1000 upward, as the summary cards do, would disagree with
 * the production readout on every value between 1k and 10k.
 */
function formatReadout(value: number, unit: string): { value: string; unit: string } {
  if (!Number.isFinite(value)) return { value: '—', unit }

  const big = Math.abs(value) >= 10_000
  return {
    value: big
      ? (value / 1000).toFixed(2)
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    unit: `${big ? 'k' : ''}${unit.trim()}`,
  }
}

/** Compact axis-tick numbers: 42000 → 42k, 0.834 → 0.83. */
function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 1) return value.toFixed(1)
  return value.toFixed(2)
}

/** Nearest sample to a timestamp, for the readout column. */
function valueAt(series: Series, ts: number | null): number | null {
  if (!series.points.length) return null
  const target = ts ?? series.points[series.points.length - 1][0]
  const i = d3.bisector((d: [number, number]) => d[0]).center(series.points, target)
  return series.points[Math.max(0, Math.min(series.points.length - 1, i))]?.[1] ?? null
}

/** Readout falls back to the latest sample when nothing is hovered. */
const readout = computed(() =>
  props.series.map((s) => {
    const v = valueAt(s, props.cursor ?? null)
    const formatted =
      v === null ? { value: '—', unit: props.unit.trim() } : formatReadout(v, props.unit)

    return { key: s.key, label: s.label, color: s.color, ...formatted }
  }),
)

let renderCursor: ((ts: number | null) => void) | null = null

function draw() {
  const el = containerRef.value
  if (!el) return

  d3.select(el).selectAll('*').remove()

  const width = el.clientWidth
  const height = props.height
  if (width <= 0) return

  const flat = props.series.flatMap((s) => s.points)
  if (!flat.length) {
    d3.select(el)
      .append('div')
      .attr('class', 'plot-empty')
      .style('height', `${height}px`)
      .text(t('energisa.no_data_range'))
    return
  }

  const innerW = Math.max(1, width - MARGIN.left - MARGIN.right)
  const innerH = Math.max(1, height - MARGIN.top - MARGIN.bottom)

  const xExtent = d3.extent(flat, (d) => d[0]) as [number, number]

  // Configured bounds win; otherwise pad the data extent so a flat series
  // doesn't collapse to a zero-height domain.
  let yLo: number
  let yHi: number
  if (props.yMin !== null && props.yMax !== null) {
    yLo = props.yMin
    yHi = props.yMax
  } else {
    const [lo, hi] = d3.extent(flat, (d) => d[1]) as [number, number]
    const pad = (hi - lo) * 0.08 || Math.abs(hi || 1) * 0.1
    yLo = lo - pad
    yHi = hi + pad
  }

  const svg = d3
    .select(el)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', props.title || 'Série temporal')

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const x = d3.scaleTime().domain(xExtent).range([0, innerW])
  const y = d3.scaleLinear().domain([yLo, yHi]).range([innerH, 0])

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(() => ''))
    .call((sel) => sel.select('.domain').remove())

  g.append('g')
    .attr('class', 'axis axis--y')
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => compact(d as number)))

  g.append('g')
    .attr('class', 'axis axis--x')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(Math.max(3, Math.floor(innerW / 110)))
        .tickFormat((d) => d3.timeFormat('%H:%M')(d as Date)),
    )

  // Zero line, when the domain straddles it
  if (yLo < 0 && yHi > 0) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('class', 'zero-line')
  }

  const line = d3
    .line<[number, number]>()
    .defined((d) => Number.isFinite(d[1]))
    .x((d) => x(d[0]))
    .y((d) => y(Math.max(yLo, Math.min(yHi, d[1]))))

  for (const s of props.series) {
    g.append('path')
      .datum(s.points)
      .attr('fill', 'none')
      .attr('stroke', s.color)
      .attr('stroke-width', 1.25)
      .attr('stroke-linejoin', 'round')
      .attr('d', line)
  }

  const crosshair = g.append('g').attr('class', 'crosshair').style('display', 'none')
  crosshair.append('line').attr('y1', 0).attr('y2', innerH).attr('class', 'crosshair-line')

  const dots = props.series.map((s) =>
    crosshair
      .append('circle')
      .attr('r', 3)
      .attr('fill', 'var(--bs-body-bg, #fff)')
      .attr('stroke', s.color)
      .attr('stroke-width', 1.6),
  )

  renderCursor = (ts: number | null) => {
    if (ts === null || ts < xExtent[0] || ts > xExtent[1]) {
      crosshair.style('display', 'none')
      return
    }

    crosshair.style('display', null).attr('transform', `translate(${x(ts)},0)`)

    props.series.forEach((s, i) => {
      const v = valueAt(s, ts)
      if (v === null || !Number.isFinite(v)) {
        dots[i].attr('display', 'none')
        return
      }
      dots[i].attr('display', null).attr('cx', 0).attr('cy', y(Math.max(yLo, Math.min(yHi, v))))
    })
  }

  svg
    .append('rect')
    .attr('x', MARGIN.left)
    .attr('y', MARGIN.top)
    .attr('width', innerW)
    .attr('height', innerH)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event)
      emit('update:cursor', x.invert(mx - MARGIN.left).getTime())
    })
    .on('mouseleave', () => emit('update:cursor', null))

  renderCursor(props.cursor)
}

watch(() => props.series, draw, { deep: false })
// Empty-state text is drawn into the SVG, so it only updates on redraw.
watch(locale, draw)
watch([() => props.height, () => props.yMin, () => props.yMax], draw)
// Only move the crosshair on cursor changes — redrawing the whole chart on
// every mousemove is visibly janky across four panels of ~800 points.
watch(
  () => props.cursor,
  (ts) => renderCursor?.(ts ?? null),
)

onMounted(() => {
  draw()
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => draw())
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => resizeObserver?.disconnect())
</script>

<style scoped>
.sync-chart {
  padding-bottom: 1.15rem;
  margin-bottom: 1.15rem;
  border-bottom: 1px solid var(--bs-border-color);
}

/* The last panel in a stack shouldn't draw a trailing rule. */
.sync-chart:last-child {
  padding-bottom: 0.25rem;
  margin-bottom: 0;
  border-bottom: none;
}

.sync-chart__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.4rem;
}

.sync-chart__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--bs-body-color);
  white-space: nowrap;
}

.sync-chart__readouts {
  display: flex;
  align-items: baseline;
  gap: 1.1rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}

.readout {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  white-space: nowrap;
}

.readout__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  transform: translateY(-1px);
}

.readout__label {
  font-size: 11px;
  color: var(--bs-secondary-color);
}

.readout__value {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.readout__unit {
  font-size: 10.5px;
  color: var(--bs-secondary-color);
}

.sync-chart__plot { width: 100%; }

.plot-empty {
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--bs-secondary-color);
}

:deep(.axis) { font-size: 10px; color: var(--bs-secondary-color); }
:deep(.axis .domain) { stroke: var(--bs-border-color); }
:deep(.axis line) { stroke: var(--bs-border-color); }
:deep(.grid line) { stroke: var(--bs-border-color); opacity: 0.4; }
:deep(.zero-line) { stroke: var(--bs-border-color); stroke-width: 1; opacity: 0.8; }
:deep(.crosshair-line) { stroke: currentColor; stroke-width: 1; opacity: 0.4; }

@media (max-width: 720px) {
  .sync-chart__head { gap: 0.4rem; }
  .sync-chart__readouts { gap: 0.75rem; }
  .readout__value { font-size: 13px; }
}
</style>
