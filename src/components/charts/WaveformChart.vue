<template>
  <div class="waveform-chart">
    <div ref="containerRef" class="chart-container"></div>
    <div class="d-flex flex-wrap gap-3 justify-content-center mt-1">
      <span v-for="s in legend" :key="s.label" class="legend-item">
        <span class="legend-dot" :style="{ background: s.color }"></span>
        <span class="legend-text">{{ s.label }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Análise Temporal — one cycle of captured voltage and current samples.
 *
 * Voltage and current differ by orders of magnitude, so they get independent
 * y-axes: voltage left, current right.
 *
 * Both are scaled from the device's configured RMS ratings times √2 — the
 * peak of a sinusoid whose RMS is that rating (ondasChart.ts):
 *
 *     min = -maxV·√2      max = +maxV·√2      fallback ±400 V
 *     min = -maxI·√2      max = +maxI·√2      fallback ±30 A
 *
 * Scaling to the data instead makes the axis jump around between instants and
 * exaggerates a noisy capture — a single spike rescaled the current axis to
 * ±800 A and flattened all three traces.
 */
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { CHART_COLORS } from '@/utils/energy/electrical'

const { t, locale } = useI18n()

const props = withDefaults(
  defineProps<{
    channels: { channel: number; voltage: number[]; current: number[] }[]
    height?: number
    /** Restrict to one channel; null shows all three. */
    only?: number | null
    /** Device nameplate ratings; drives the axis bounds. */
    ratings?: { maxV?: number; maxI?: number } | null
  }>(),
  { height: 240, only: null, ratings: null },
)

const SQRT2 = Math.SQRT2

const containerRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const MARGIN = { top: 12, right: 52, bottom: 26, left: 56 }

const visible = computed(() =>
  props.only ? props.channels.filter((c) => c.channel === props.only) : props.channels,
)

const legend = computed(() =>
  [
    ...visible.value.map((c) => ({ label: `I${c.channel}`, color: CHART_COLORS.i[c.channel - 1] })),
    ...visible.value.map((c) => ({ label: `V${c.channel}`, color: CHART_COLORS.v[c.channel - 1] })),
  ],
)

function draw() {
  const el = containerRef.value
  if (!el) return

  d3.select(el).selectAll('*').remove()

  const width = el.clientWidth
  if (width <= 0) return

  const channels = visible.value
  const allV = channels.flatMap((c) => c.voltage)
  const allI = channels.flatMap((c) => c.current)

  if (!allV.length) {
    d3.select(el)
      .append('div')
      .attr('class', 'chart-empty')
      .style('height', `${props.height}px`)
      .text(t('energisa.no_waveform'))
    return
  }

  const innerW = Math.max(1, width - MARGIN.left - MARGIN.right)
  const innerH = Math.max(1, props.height - MARGIN.top - MARGIN.bottom)
  const sampleCount = d3.max(channels, (c) => c.voltage.length) ?? 0

  const svg = d3.select(el).append('svg').attr('width', width).attr('height', props.height)
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const x = d3.scaleLinear().domain([0, Math.max(1, sampleCount - 1)]).range([0, innerW])

  // Symmetric domains keep the zero line centred, so the phase relationship
  // between voltage and current stays readable.
  const vMax = props.ratings?.maxV ? props.ratings.maxV * SQRT2 : 400
  const iMax = props.ratings?.maxI ? props.ratings.maxI * SQRT2 : 30
  const yV = d3.scaleLinear().domain([-vMax, vMax]).range([innerH, 0])
  const yI = d3.scaleLinear().domain([-iMax, iMax]).range([innerH, 0])

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yV).ticks(6).tickSize(-innerW).tickFormat(() => ''))
    .call((sel) => sel.select('.domain').remove())

  g.append('g').attr('class', 'axis').call(d3.axisLeft(yV).ticks(6).tickFormat((d) => `${d}V`))
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${innerW},0)`)
    .call(d3.axisRight(yI).ticks(6).tickFormat((d) => `${d}A`))
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(innerW / 70))))

  // Zero reference
  g.append('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', yV(0))
    .attr('y2', yV(0))
    .attr('stroke', 'currentColor')
    .attr('opacity', 0.25)

  const line = (scale: d3.ScaleLinear<number, number>, bound: number) =>
    d3
      .line<number>()
      .defined((d) => Number.isFinite(d))
      .x((_, i) => x(i))
      .y((d) => scale(Math.max(-bound, Math.min(bound, d))))

  for (const channel of channels) {
    g.append('path')
      .datum(channel.voltage)
      .attr('fill', 'none')
      .attr('stroke', CHART_COLORS.v[channel.channel - 1])
      .attr('stroke-width', 1.4)
      .attr('d', line(yV, vMax))

    g.append('path')
      .datum(channel.current)
      .attr('fill', 'none')
      .attr('stroke', CHART_COLORS.i[channel.channel - 1])
      .attr('stroke-width', 1.4)
      .attr('d', line(yI, iMax))
  }
}

watch(() => props.channels, draw, { deep: false })
// Empty-state text is drawn into the SVG, so it only updates on redraw.
watch(locale, draw)
watch([() => props.only, () => props.ratings], draw)

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
.chart-container { width: 100%; }

.legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--bs-secondary-color); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }

.chart-empty {
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--bs-secondary-color);
}

:deep(.axis) { font-size: 10px; color: var(--bs-secondary-color); }
:deep(.axis .domain) { stroke: var(--bs-border-color); }
:deep(.grid line) { stroke: var(--bs-border-color); opacity: 0.45; }
</style>
