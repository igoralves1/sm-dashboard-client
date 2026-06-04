<template>
  <div class="liquid-gauge-wrapper">
    <svg :id="gaugeId" :width="size" :height="size"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as d3 from 'd3'

const props = defineProps<{
  value: number   // 0–100 percentage
  size?: number
}>()

const size = computed(() => props.size ?? 200)

// Unique ID per instance to avoid clipPath collisions
let idCounter = 0
const gaugeId = `liquid-gauge-${++idCounter}-${Math.random().toString(36).slice(2, 7)}`

// Color thresholds matching Grafana
function circleColor(v: number) {
  if (v < 25) return '#e84040'
  if (v < 50) return '#f58b06'
  return '#178BCA'
}
function waveColor(v: number) {
  if (v < 25) return '#e84040'
  if (v < 50) return '#f58b06'
  return '#178BCA'
}
function waveTextColor(v: number) {
  if (v < 25) return '#ffaaaa'
  if (v < 50) return '#ffe0a0'
  return '#A4DBf8'
}
function textColor(v: number) {
  if (v < 25) return '#c02020'
  if (v < 50) return '#c07000'
  return '#045681'
}

// ── Liquid fill gauge (ported from Curtis Bratton's gist, D3 v3 → v7) ────────
let gaugeUpdater: { update: (v: number) => void } | null = null

function loadGauge(value: number) {
  const config = {
    minValue: 0,
    maxValue: 100,
    circleThickness: 0.05,
    circleFillGap: 0.05,
    circleColor: circleColor(value),
    waveHeight: 0.08,
    waveCount: 2,
    waveRiseTime: 1000,
    waveAnimateTime: 3000,
    waveRise: true,
    waveHeightScaling: true,
    waveAnimate: true,
    waveColor: waveColor(value),
    waveOffset: 0,
    textVertPosition: 0.5,
    textSize: 1,
    valueCountUp: true,
    displayPercent: true,
    textColor: textColor(value),
    waveTextColor: waveTextColor(value),
  }

  const gauge = d3.select('#' + gaugeId)
  // Clear previous render
  gauge.selectAll('*').remove()

  const radius = Math.min(parseInt(gauge.style('width')), parseInt(gauge.style('height'))) / 2
  const locationX = parseInt(gauge.style('width')) / 2 - radius
  const locationY = parseInt(gauge.style('height')) / 2 - radius
  const fillPercent = Math.max(config.minValue, Math.min(config.maxValue, value)) / config.maxValue

  const waveHeightScale = config.waveHeightScaling
    ? d3.scaleLinear().range([0, config.waveHeight, 0]).domain([0, 50, 100])
    : d3.scaleLinear().range([config.waveHeight, config.waveHeight]).domain([0, 100])

  const textPixels = config.textSize * radius / 2
  const textFinalValue = parseFloat(String(value)).toFixed(2)
  const textStartValue = config.valueCountUp ? config.minValue : parseFloat(textFinalValue)
  const percentText = config.displayPercent ? '%' : ''
  const circleThickness = config.circleThickness * radius
  const circleFillGap = config.circleFillGap * radius
  const fillCircleMargin = circleThickness + circleFillGap
  const fillCircleRadius = radius - fillCircleMargin
  const waveHeight = fillCircleRadius * waveHeightScale(fillPercent * 100)
  const waveLength = fillCircleRadius * 2 / config.waveCount
  const waveClipCount = 1 + config.waveCount
  const waveClipWidth = waveLength * waveClipCount

  let textRounder = (v: number) => Math.round(v).toString()
  if (parseFloat(textFinalValue) !== parseFloat(String(Math.round(parseFloat(textFinalValue))))) {
    textRounder = (v: number) => parseFloat(String(v)).toFixed(1)
  }
  if (parseFloat(textFinalValue) !== parseFloat(textRounder(parseFloat(textFinalValue)))) {
    textRounder = (v: number) => parseFloat(String(v)).toFixed(2)
  }

  const data: { x: number; y: number }[] = []
  for (let i = 0; i <= 40 * waveClipCount; i++) {
    data.push({ x: i / (40 * waveClipCount), y: i / 40 })
  }

  const gaugeCircleX = d3.scaleLinear().range([0, 2 * Math.PI]).domain([0, 1])
  const gaugeCircleY = d3.scaleLinear().range([0, radius]).domain([0, radius])
  const waveScaleX = d3.scaleLinear().range([0, waveClipWidth]).domain([0, 1])
  const waveScaleY = d3.scaleLinear().range([0, waveHeight]).domain([0, 1])
  const waveRiseScale = d3.scaleLinear()
    .range([fillCircleMargin + fillCircleRadius * 2 + waveHeight, fillCircleMargin - waveHeight])
    .domain([0, 1])
  const waveAnimateScale = d3.scaleLinear()
    .range([0, waveClipWidth - fillCircleRadius * 2])
    .domain([0, 1])
  const textRiseScaleY = d3.scaleLinear()
    .range([fillCircleMargin + fillCircleRadius * 2, fillCircleMargin + textPixels * 0.7])
    .domain([0, 1])

  const gaugeGroup = gauge.append('g')
    .attr('transform', `translate(${locationX},${locationY})`)

  // Outer circle arc
  const gaugeCircleArc = d3.arc()
    .startAngle(gaugeCircleX(0))
    .endAngle(gaugeCircleX(1))
    .outerRadius(gaugeCircleY(radius))
    .innerRadius(gaugeCircleY(radius - circleThickness))

  gaugeGroup.append('path')
    .attr('d', gaugeCircleArc as any)
    .style('fill', config.circleColor)
    .attr('transform', `translate(${radius},${radius})`)

  // Text (outside wave)
  const text1 = gaugeGroup.append('text')
    .text(textRounder(textStartValue as number) + percentText)
    .attr('class', 'liquidFillGaugeText')
    .attr('text-anchor', 'middle')
    .attr('font-size', textPixels + 'px')
    .style('fill', config.textColor)
    .attr('transform', `translate(${radius},${textRiseScaleY(config.textVertPosition)})`)

  // Clip wave area
  const clipArea = d3.area<{ x: number; y: number }>()
    .x(d => waveScaleX(d.x))
    .y0(d => waveScaleY(Math.sin(Math.PI * 2 * config.waveOffset * -1 + Math.PI * 2 * (1 - config.waveCount) + d.y * 2 * Math.PI)))
    .y1(() => fillCircleRadius * 2 + waveHeight)

  const waveGroup = gaugeGroup.append('defs')
    .append('clipPath')
    .attr('id', 'clipWave' + gaugeId)

  const wave = waveGroup.append('path')
    .datum(data)
    .attr('d', clipArea as any)
    .attr('T', 0)

  // Fill circle with clip
  const fillCircleGroup = gaugeGroup.append('g')
    .attr('clip-path', `url(#clipWave${gaugeId})`)

  fillCircleGroup.append('circle')
    .attr('cx', radius).attr('cy', radius).attr('r', fillCircleRadius)
    .style('fill', config.waveColor)

  // Text (inside wave)
  const text2 = fillCircleGroup.append('text')
    .text(textRounder(textStartValue as number) + percentText)
    .attr('class', 'liquidFillGaugeText')
    .attr('text-anchor', 'middle')
    .attr('font-size', textPixels + 'px')
    .style('fill', config.waveTextColor)
    .attr('transform', `translate(${radius},${textRiseScaleY(config.textVertPosition)})`)

  // Count-up animation
  if (config.valueCountUp) {
    const textTween = function (this: SVGTextElement) {
      const i = d3.interpolate(parseFloat(this.textContent ?? '0'), parseFloat(textFinalValue))
      return (t: number) => { this.textContent = textRounder(i(t)) + percentText }
    }
    text1.transition().duration(config.waveRiseTime).tween('text', textTween)
    text2.transition().duration(config.waveRiseTime).tween('text', textTween)
  }

  // Wave rise
  const waveGroupXPosition = fillCircleMargin + fillCircleRadius * 2 - waveClipWidth
  if (config.waveRise) {
    waveGroup
      .attr('transform', `translate(${waveGroupXPosition},${waveRiseScale(0)})`)
      .transition()
      .duration(config.waveRiseTime)
      .attr('transform', `translate(${waveGroupXPosition},${waveRiseScale(fillPercent)})`)
      .on('start', () => { wave.attr('transform', 'translate(1,0)') })
  } else {
    waveGroup.attr('transform', `translate(${waveGroupXPosition},${waveRiseScale(fillPercent)})`)
  }

  function animateWave() {
    wave.attr('transform', `translate(${waveAnimateScale(parseFloat(wave.attr('T')))},0)`)
    wave.transition()
      .duration(config.waveAnimateTime * (1 - parseFloat(wave.attr('T'))))
      .ease(d3.easeLinear)
      .attr('transform', `translate(${waveAnimateScale(1)},0)`)
      .attr('T', 1)
      .on('end', () => {
        wave.attr('T', 0)
        animateWave()
      })
  }

  if (config.waveAnimate) animateWave()

  gaugeUpdater = {
    update(newValue: number) {
      const newFinal = parseFloat(String(newValue)).toFixed(2)
      let rounder = (v: number) => Math.round(v).toString()
      if (parseFloat(newFinal) !== Math.round(parseFloat(newFinal)))
        rounder = (v: number) => parseFloat(String(v)).toFixed(1)
      if (parseFloat(newFinal) !== parseFloat(rounder(parseFloat(newFinal))))
        rounder = (v: number) => parseFloat(String(v)).toFixed(2)

      const tween = function (this: SVGTextElement) {
        const i = d3.interpolate(parseFloat(this.textContent ?? '0'), parseFloat(newFinal))
        return (t: number) => { this.textContent = rounder(i(t)) + percentText }
      }
      text1.transition().duration(config.waveRiseTime).tween('text', tween)
      text2.transition().duration(config.waveRiseTime).tween('text', tween)

      const newFillPct = Math.max(config.minValue, Math.min(config.maxValue, newValue)) / config.maxValue
      const newWaveH = fillCircleRadius * waveHeightScale(newFillPct * 100)
      const newWaveRiseScale = d3.scaleLinear()
        .range([fillCircleMargin + fillCircleRadius * 2 + newWaveH, fillCircleMargin - newWaveH])
        .domain([0, 1])
      const newWaveScaleX = d3.scaleLinear().range([0, waveClipWidth]).domain([0, 1])
      const newWaveScaleY = d3.scaleLinear().range([0, newWaveH]).domain([0, 1])
      const newClipArea = d3.area<{ x: number; y: number }>()
        .x(d => newWaveScaleX(d.x))
        .y0(d => newWaveScaleY(Math.sin(Math.PI * 2 * config.waveOffset * -1 + Math.PI * 2 * (1 - config.waveCount) + d.y * 2 * Math.PI)))
        .y1(() => fillCircleRadius * 2 + newWaveH)

      const newWavePos = config.waveAnimate ? waveAnimateScale(1) : 0
      wave.transition().duration(0).transition()
        .duration(config.waveAnimate
          ? config.waveAnimateTime * (1 - parseFloat(wave.attr('T')))
          : config.waveRiseTime)
        .ease(d3.easeLinear)
        .attr('d', newClipArea as any)
        .attr('transform', `translate(${newWavePos},0)`)
        .attr('T', 1)
        .on('end', () => {
          if (config.waveAnimate) {
            wave.attr('transform', `translate(${waveAnimateScale(0)},0)`)
            animateWave()
          }
        })

      waveGroup.transition()
        .duration(config.waveRiseTime)
        .attr('transform', `translate(${waveGroupXPosition},${newWaveRiseScale(newFillPct)})`)
    }
  }
}

onMounted(() => loadGauge(props.value))
onUnmounted(() => { d3.select('#' + gaugeId).selectAll('*').interrupt() })

watch(() => props.value, (newVal) => {
  if (gaugeUpdater) gaugeUpdater.update(newVal)
  else loadGauge(newVal)
})
</script>

<style scoped>
.liquid-gauge-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}
:global(.liquidFillGaugeText) {
  font-family: inherit;
  font-weight: 700;
}
</style>
