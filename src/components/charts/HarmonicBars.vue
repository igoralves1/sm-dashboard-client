<template>
  <div class="harmonic-bars">
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
 * Análise Harmônica — harmonic spectrum of the captured waveform.
 *
 * Plots voltage and current for all three phases as six grouped series, with
 * bin 0 (DC) included: a DC offset on a current channel is exactly the kind of
 * fault this chart exists to reveal, so dropping it would hide the signal.
 *
 * Each series is normalised against **its own fundamental** (bin 1) and the
 * axis is capped at 100:
 *
 *     value * 100 / modulos[1][1]        (dftChart.ts)
 *
 * Bars therefore exceed 100% whenever a harmonic is larger than the
 * fundamental, and are clipped flat at the top of the axis. That clipping is
 * the point — a row of bars pinned at 100 is how a badly distorted current
 * channel announces itself, and it is what production shows.
 */
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { fourier } from '@/utils/energy/fourier'
import { CHART_COLORS } from '@/utils/energy/electrical'

const { t, locale } = useI18n()

/** Todos = both quantities; Vca / Ica isolate one. */
export type HarmonicMode = 'all' | 'voltage' | 'current'

const props = withDefaults(
  defineProps<{
    channels: { channel: number; voltage: number[]; current: number[] }[]
    height?: number
    mode?: HarmonicMode
  }>(),
  { height: 240, mode: 'all' },
)

const containerRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const MARGIN = { top: 12, right: 10, bottom: 26, left: 44 }

interface Spectrum {
  key: string
  label: string
  color: string
  /** Percentage of this series' own peak, indexed by harmonic bin. */
  bars: { k: number; percent: number }[]
}

const spectra = computed<Spectrum[]>(() => {
  const out: Spectrum[] = []

  for (const channel of props.channels) {
    const harmonics = fourier(channel.voltage, channel.current)
    if (!harmonics.length) continue

    const wanted: { field: 'vMagnitude' | 'iMagnitude'; prefix: string; color: string }[] = []
    if (props.mode !== 'current') {
      wanted.push({
        field: 'vMagnitude',
        prefix: 'V',
        color: CHART_COLORS.v[channel.channel - 1],
      })
    }
    if (props.mode !== 'voltage') {
      wanted.push({
        field: 'iMagnitude',
        prefix: 'I',
        color: CHART_COLORS.i[channel.channel - 1],
      })
    }

    for (const { field, prefix, color } of wanted) {
      // Bin 1 is the fundamental — the reference every other bin is measured
      // against. Without it there is nothing to normalise by.
      const fundamental = harmonics.find((h) => h.k === 1)?.[field]
      if (!fundamental) continue

      out.push({
        key: `${prefix}${channel.channel}`,
        label: `${prefix}${channel.channel}`,
        color,
        bars: harmonics.map((h) => ({
          k: h.k,
          percent: (Math.abs(h[field]) * 100) / Math.abs(fundamental),
        })),
      })
    }
  }

  // V1, I1, V2, I2, … — pairs the two quantities per phase, as production does.
  return out.sort((a, b) => {
    const chA = Number(a.key.slice(1))
    const chB = Number(b.key.slice(1))
    if (chA !== chB) return chA - chB
    return a.key[0] === 'V' ? -1 : 1
  })
})

const legend = computed(() => spectra.value.map((s) => ({ label: s.label, color: s.color })))

function draw() {
  const el = containerRef.value
  if (!el) return

  d3.select(el).selectAll('*').remove()

  const width = el.clientWidth
  if (width <= 0) return

  if (!spectra.value.length) {
    d3.select(el)
      .append('div')
      .attr('class', 'chart-empty')
      .style('height', `${props.height}px`)
      .text(t('energisa.no_waveform'))
    return
  }

  const innerW = Math.max(1, width - MARGIN.left - MARGIN.right)
  const innerH = Math.max(1, props.height - MARGIN.top - MARGIN.bottom)

  const svg = d3.select(el).append('svg').attr('width', width).attr('height', props.height)
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const bins = spectra.value[0].bars.map((b) => b.k)

  const x0 = d3.scaleBand().domain(bins.map(String)).range([0, innerW]).paddingInner(0.35)
  const x1 = d3
    .scaleBand()
    .domain(spectra.value.map((s) => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.05)

  const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0])

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(() => ''))
    .call((sel) => sel.select('.domain').remove())

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5))

  // Label every other bin when they'd otherwise collide.
  const labelEvery = innerW / bins.length < 22 ? 2 : 1
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x0).tickFormat((d, i) => (i % labelEvery === 0 ? d : '')))

  g.append('text')
    .attr('class', 'axis-title')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -MARGIN.left + 12)
    .attr('text-anchor', 'middle')
    .text(t('energisa.values'))

  for (const spectrum of spectra.value) {
    g.selectAll(`.bar-${spectrum.key}`)
      .data(spectrum.bars)
      .join('rect')
      .attr('x', (d) => (x0(String(d.k)) ?? 0) + (x1(spectrum.key) ?? 0))
      .attr('width', Math.max(1, x1.bandwidth()))
      .attr('y', (d) => y(Math.min(d.percent, 100)))
      .attr('height', (d) => innerH - y(Math.min(d.percent, 100)))
      .attr('fill', spectrum.color)
  }
}

watch(() => props.channels, draw, { deep: false })
// Empty-state text is drawn into the SVG, so it only updates on redraw.
watch(locale, draw)
watch([() => props.mode, () => props.height], draw)

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

.chart-empty { display: grid; place-items: center; font-size: 12px; color: var(--bs-secondary-color); }

:deep(.axis) { font-size: 10px; color: var(--bs-secondary-color); }
:deep(.axis .domain) { stroke: var(--bs-border-color); }
:deep(.axis line) { stroke: var(--bs-border-color); }
:deep(.grid line) { stroke: var(--bs-border-color); opacity: 0.45; }
:deep(.axis-title) { font-size: 10px; fill: var(--bs-secondary-color); }
</style>
