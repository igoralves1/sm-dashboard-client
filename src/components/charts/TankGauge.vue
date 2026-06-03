<template>
  <div class="tank-gauge-wrapper" ref="wrapperRef">
    <svg ref="svgRef" :width="size" :height="size + 40"></svg>
    <div class="tank-percentage" :style="{ color: levelColor }">
      {{ displayValue.toFixed(1) }}<span>%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'

const props = defineProps<{
  value: number   // 0-100 percentage
  size?: number
  label?: string
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const displayValue = ref(props.value)
const size = computed(() => props.size ?? 220)

// Color thresholds matching Grafana
const levelColor = computed(() => {
  if (props.value < 25) return '#e84040'
  if (props.value < 50) return '#f58b06'
  if (props.value < 75) return '#56a64b'
  return '#37872d'
})

const waterColor = computed(() => {
  if (props.value < 25) return '#e84040'
  if (props.value < 50) return '#f58b06'
  if (props.value < 75) return '#4da6ff'
  return '#4da6ff'
})

let waveOffset = 0
let animFrame: number

function drawTank(svgEl: SVGSVGElement, pct: number) {
  const s = size.value
  const cx = s / 2
  const totalH = s * 0.72
  const topY = s * 0.08
  const botY = topY + totalH
  const rx = s * 0.42     // horizontal radius of ellipse
  const ry = s * 0.10     // vertical radius of ellipse (3D depth)
  const fillH = totalH * (pct / 100)
  const fillY = botY - fillH

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()

  const defs = svg.append('defs')

  // Clip path — cylinder body
  const clipId = 'tank-clip'
  defs.append('clipPath').attr('id', clipId)
    .append('rect')
    .attr('x', cx - rx)
    .attr('y', topY)
    .attr('width', rx * 2)
    .attr('height', totalH)

  // ── Background cylinder body ──
  svg.append('rect')
    .attr('x', cx - rx)
    .attr('y', topY)
    .attr('width', rx * 2)
    .attr('height', totalH)
    .attr('fill', '#2a2a2a')
    .attr('rx', 2)

  // ── Horizontal rings (mesh lines) ──
  const ringCount = 7
  for (let i = 1; i < ringCount; i++) {
    const ry2 = topY + (totalH / ringCount) * i
    svg.append('ellipse')
      .attr('cx', cx).attr('cy', ry2)
      .attr('rx', rx).attr('ry', ry * 0.5)
      .attr('fill', 'none')
      .attr('stroke', '#555').attr('stroke-width', 0.8)
      .attr('opacity', 0.6)
  }

  // ── Water fill with wave ──
  if (pct > 0) {
    const waveAmp = fillH < 8 ? 1 : 3
    const waveLen = rx * 1.2
    const pts: [number, number][] = []
    const steps = 60
    for (let i = 0; i <= steps; i++) {
      const x = (cx - rx) + (rx * 2 * i / steps)
      const y = fillY + waveAmp * Math.sin((i / steps) * Math.PI * 2 * (rx / waveLen) + waveOffset)
      pts.push([x, y])
    }
    pts.push([cx + rx, botY])
    pts.push([cx - rx, botY])

    const line = d3.line<[number, number]>().x(d => d[0]).y(d => d[1]).curve(d3.curveCatmullRom)
    const pathD = line(pts) + 'Z'

    svg.append('path')
      .attr('d', pathD)
      .attr('fill', waterColor.value)
      .attr('opacity', 0.85)
      .attr('clip-path', `url(#${clipId})`)

    // Water surface ellipse
    svg.append('ellipse')
      .attr('cx', cx).attr('cy', fillY)
      .attr('rx', rx).attr('ry', ry * 0.45)
      .attr('fill', waterColor.value)
      .attr('opacity', 0.95)
      .attr('clip-path', `url(#${clipId})`)
  }

  // ── Bottom ellipse (base) ──
  svg.append('ellipse')
    .attr('cx', cx).attr('cy', botY)
    .attr('rx', rx).attr('ry', ry)
    .attr('fill', '#1a1a1a').attr('stroke', '#444').attr('stroke-width', 1)

  // ── Top ellipse ──
  svg.append('ellipse')
    .attr('cx', cx).attr('cy', topY)
    .attr('rx', rx).attr('ry', ry)
    .attr('fill', '#222').attr('stroke', '#555').attr('stroke-width', 1)

  // ── Vertical bars (gold cage) ──
  const barCount = 10
  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2
    const bx = cx + rx * Math.cos(angle)
    svg.append('line')
      .attr('x1', bx).attr('y1', topY)
      .attr('x2', bx).attr('y2', botY)
      .attr('stroke', Math.abs(Math.cos(angle)) > 0.3 ? '#c8960c' : '#888')
      .attr('stroke-width', Math.abs(Math.cos(angle)) > 0.3 ? 2 : 1)
      .attr('opacity', Math.abs(Math.cos(angle)) > 0.15 ? 1 : 0.3)
  }

  // ── Top ring (gold) ──
  svg.append('ellipse')
    .attr('cx', cx).attr('cy', topY)
    .attr('rx', rx + 2).attr('ry', ry + 1)
    .attr('fill', 'none').attr('stroke', '#c8960c').attr('stroke-width', 3)

  // ── Base ring ──
  svg.append('ellipse')
    .attr('cx', cx).attr('cy', botY + ry * 0.6)
    .attr('rx', rx + 4).attr('ry', ry * 0.5)
    .attr('fill', '#111').attr('stroke', '#333').attr('stroke-width', 2)
}

function animate() {
  if (!svgRef.value) return
  waveOffset += 0.04
  drawTank(svgRef.value, displayValue.value)
  animFrame = requestAnimationFrame(animate)
}

function animateValue(target: number) {
  const start = displayValue.value
  const duration = 800
  const startTime = performance.now()
  function step(now: number) {
    const t = Math.min((now - startTime) / duration, 1)
    displayValue.value = start + (target - start) * d3.easeCubicInOut(t)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

onMounted(() => {
  if (svgRef.value) {
    drawTank(svgRef.value, props.value)
    animate()
  }
})

watch(() => props.value, (newVal) => {
  animateValue(newVal)
})
</script>

<style scoped>
.tank-gauge-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.tank-percentage {
  font-size: 2rem;
  font-weight: 700;
  margin-top: -8px;
  letter-spacing: -0.5px;
}
.tank-percentage span {
  font-size: 1.2rem;
}
</style>
