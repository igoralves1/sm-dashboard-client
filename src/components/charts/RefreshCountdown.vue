<template>
  <svg ref="svgRef" :width="size" :height="size" class="countdown-svg"></svg>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'

const props = defineProps<{
  durationSeconds: number  // total countdown (e.g. 60)
  secondsLeft: number      // current seconds remaining
  size?: number
}>()

const emit = defineEmits<{ done: [] }>()
const svgRef = ref<SVGSVGElement | null>(null)

const sz = props.size ?? 52
const cx = sz / 2
const cy = sz / 2
const R  = sz / 2 - 4
const strokeW = 4

function draw() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const frac = props.secondsLeft / props.durationSeconds
  const color = frac > 0.4 ? '#73bf69' : frac > 0.15 ? '#f58b06' : '#e84040'

  // Background circle
  svg.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', R)
    .attr('fill', 'none')
    .attr('stroke', '#2a2a2a')
    .attr('stroke-width', strokeW)

  // Progress arc
  const arc = d3.arc()
    .innerRadius(R - strokeW / 2)
    .outerRadius(R + strokeW / 2)
    .startAngle(-Math.PI / 2)
    .endAngle(-Math.PI / 2 + 2 * Math.PI * frac)

  svg.append('path')
    .attr('d', arc as any)
    .attr('transform', `translate(${cx},${cy})`)
    .attr('fill', color)

  // Seconds text
  svg.append('text')
    .attr('x', cx).attr('y', cy + 1)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', color)
    .attr('font-size', sz * 0.28 + 'px')
    .attr('font-weight', '600')
    .text(props.secondsLeft + 's')
}

onMounted(draw)
watch(() => [props.secondsLeft, props.durationSeconds], draw)
</script>

<style scoped>
.countdown-svg { display: block; }
</style>
