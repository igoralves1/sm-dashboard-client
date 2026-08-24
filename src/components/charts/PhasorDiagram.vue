<template>
  <div class="phasor-diagram">
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
 * Diagrama Fasorial — each phase's voltage and current as a vector on a polar
 * plot, so the angle between them (the power factor) is visible directly.
 *
 * Magnitude and angle come from the fundamental (60 Hz) DFT bin of the
 * captured waveform, not from the instantaneous samples.
 *
 * Angles carry a +90° offset, applied where production builds its `modulos`
 * table (EnergyDevicePage.tsx:455). It puts the reference phasor on the
 * vertical rather than the horizontal; without it every vector lands a quarter
 * turn clockwise of where the production dial shows it.
 *
 * Voltage and current get independent radial scales, each running from 0 to
 * the device's rating times √2 (polarChart.ts) — the same peak-value basis the
 * temporal chart uses. Falling back to the measured magnitude keeps the vector
 * visible when a device has no ratings configured.
 *
 * Radial length therefore compares within a quantity, never across the two.
 */
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { fourier, fundamental } from '@/utils/energy/fourier'
import { CHART_COLORS } from '@/utils/energy/electrical'

const { t, locale } = useI18n()

const props = withDefaults(
  defineProps<{
    channels: { channel: number; voltage: number[]; current: number[] }[]
    size?: number
    only?: number | null
    /** Device nameplate ratings; drives the radial scale. */
    ratings?: { maxV?: number; maxI?: number } | null
  }>(),
  { size: 260, only: null, ratings: null },
)

const SQRT2 = Math.SQRT2

/** Rotation applied to every phasor angle — see the note above. */
const ANGLE_OFFSET_DEG = 90

const containerRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const visible = computed(() =>
  props.only ? props.channels.filter((c) => c.channel === props.only) : props.channels,
)

/** Fundamental magnitude and angle per channel. */
const phasors = computed(() =>
  visible.value
    .map((c) => {
      const f = fundamental(fourier(c.voltage, c.current))
      if (!f) return null
      return {
        channel: c.channel,
        v: { magnitude: f.vMagnitude, angle: f.vAngle + ANGLE_OFFSET_DEG },
        i: { magnitude: f.iMagnitude, angle: f.iAngle + ANGLE_OFFSET_DEG },
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null),
)

const legend = computed(() =>
  phasors.value.flatMap((p) => [
    { label: `V${p.channel}`, color: CHART_COLORS.v[p.channel - 1] },
    { label: `I${p.channel}`, color: CHART_COLORS.i[p.channel - 1] },
  ]),
)

function draw() {
  const el = containerRef.value
  if (!el) return

  d3.select(el).selectAll('*').remove()

  const width = el.clientWidth
  if (width <= 0) return

  const size = Math.min(width, props.size)
  const radius = size / 2 - 26

  if (!phasors.value.length || radius <= 0) {
    d3.select(el)
      .append('div')
      .attr('class', 'chart-empty')
      .style('height', `${props.size}px`)
      .text(t('energisa.no_waveform'))
    return
  }

  const svg = d3.select(el).append('svg').attr('width', width).attr('height', size)
  const g = svg.append('g').attr('transform', `translate(${width / 2},${size / 2})`)

  // Rings
  for (const frac of [0.25, 0.5, 0.75, 1]) {
    g.append('circle')
      .attr('r', radius * frac)
      .attr('fill', 'none')
      .attr('stroke', 'currentColor')
      .attr('opacity', frac === 1 ? 0.35 : 0.15)
  }

  // Spokes every 30°, labelled — 0° points right, angles increase anticlockwise
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180
    const x = Math.cos(rad) * radius
    const y = -Math.sin(rad) * radius

    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', x)
      .attr('y2', y)
      .attr('stroke', 'currentColor')
      .attr('opacity', 0.12)

    g.append('text')
      .attr('x', Math.cos(rad) * (radius + 13))
      .attr('y', -Math.sin(rad) * (radius + 13))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('class', 'spoke-label')
      .text(`${deg}°`)
  }

  const vMax = props.ratings?.maxV
    ? props.ratings.maxV * SQRT2
    : d3.max(phasors.value, (p) => p.v.magnitude) || 1
  const iMax = props.ratings?.maxI
    ? props.ratings.maxI * SQRT2
    : d3.max(phasors.value, (p) => p.i.magnitude) || 1

  function arrow(magnitude: number, angle: number, max: number, color: string) {
    // Clamp so a vector beyond the configured rating stays on the dial.
    const r = Math.min(1, magnitude / max) * radius
    const rad = (angle * Math.PI) / 180
    const x = Math.cos(rad) * r
    const y = -Math.sin(rad) * r

    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', x)
      .attr('y2', y)
      .attr('stroke', color)
      .attr('stroke-width', 2)

    g.append('circle').attr('cx', x).attr('cy', y).attr('r', 3).attr('fill', color)
  }

  for (const p of phasors.value) {
    arrow(p.v.magnitude, p.v.angle, vMax, CHART_COLORS.v[p.channel - 1])
    arrow(p.i.magnitude, p.i.angle, iMax, CHART_COLORS.i[p.channel - 1])
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
.chart-container { width: 100%; display: grid; place-items: center; color: var(--bs-secondary-color); }

.legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--bs-secondary-color); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }

.chart-empty { display: grid; place-items: center; font-size: 12px; color: var(--bs-secondary-color); }

:deep(.spoke-label) { font-size: 9px; fill: var(--bs-secondary-color); }
</style>
