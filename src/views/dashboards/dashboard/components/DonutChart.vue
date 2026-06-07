<template>
  <div ref="container" class="donut-wrap"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'

const container = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const data = [
  { name: 'Silvanópolis', value: 97 },
  { name: 'Miranorte',    value: 88 },
  { name: 'Palmas',       value: 94 },
  { name: 'Gurupi',       value: 76 },
  { name: 'Araguaína',    value: 82 },
  { name: 'Porto Nacional', value: 91 },
]

const palette = ['#37872d','#4da6c8','#5794f2','#73bf69','#b877d9','#f2495c']

const color = d3.scaleOrdinal<string>()
  .domain(data.map(d => d.name))
  .range(palette)

const LEG_ROW_H = 26   // px per legend row
const LEG_GAP   = 4
const LEG_COLS  = 2

function draw(el: HTMLDivElement) {
  el.innerHTML = ''
  const totalW = el.getBoundingClientRect().width
  if (totalW === 0) return

  const hoverPad   = 12
  const donutSize  = Math.min(totalW, 240)
  const radius     = donutSize / 2
  const innerR     = radius * 0.54
  const legRows    = Math.ceil(data.length / LEG_COLS)
  const legHeight  = legRows * (LEG_ROW_H + LEG_GAP)
  const totalH     = donutSize + hoverPad * 2 + 16 + legHeight

  const svg = d3.select(el).append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .style('font-family', 'inherit')
    .style('overflow', 'visible')

  // ── Donut group — offset by hoverPad so expansion never clips ──
  const donutG = svg.append('g')
    .attr('transform', `translate(${totalW / 2},${radius + hoverPad})`)

  const arc = d3.arc<d3.PieArcDatum<typeof data[0]>>()
    .innerRadius(innerR).outerRadius(radius - 2)
    .cornerRadius(5).padAngle(0.028)

  const arcHover = d3.arc<d3.PieArcDatum<typeof data[0]>>()
    .innerRadius(innerR).outerRadius(radius + 7)
    .cornerRadius(5).padAngle(0.028)

  const pie = d3.pie<typeof data[0]>().sort(null).value(d => d.value)
  const arcs = pie(data)

  // Center text
  const avg = Math.round(d3.mean(data, d => d.value)!)
  const cvVal = donutG.append('text')
    .attr('text-anchor', 'middle').attr('dy', '-0.15em')
    .attr('fill', 'var(--bs-body-color)')
    .style('font-size', `${radius * 0.24}px`).style('font-weight', '700')
    .text(`${avg}%`)
  const cvLbl = donutG.append('text')
    .attr('text-anchor', 'middle').attr('dy', '1.1em')
    .attr('fill', 'var(--bs-secondary-color)')
    .style('font-size', `${radius * 0.12}px`)
    .text('média geral')

  // Slices
  const slices = donutG.append('g').selectAll('path')
    .data(arcs).join('path')
    .attr('fill', d => color(d.data.name))
    .attr('d', arc as any)
    .style('cursor', 'pointer')

  // Tooltip (HTML overlay)
  const tip = d3.select(el).append('div').attr('class', 'donut-tip')

  function positionTip(event: MouseEvent) {
    const rect = el.getBoundingClientRect()
    const cx   = event.clientX - rect.left
    const cy   = event.clientY - rect.top
    const tipW = (tip.node() as HTMLElement).offsetWidth || 160
    const nearRight = cx > rect.width / 2
    tip
      .style('left', nearRight ? `${cx - tipW - 12}px` : `${cx + 12}px`)
      .style('top',  `${cy - 36}px`)
  }

  slices
    .on('mouseenter', function(event, d) {
      d3.select(this).transition().duration(140).attr('d', arcHover as any)
      cvVal.text(`${d.data.value}%`)
      cvLbl.text(d.data.name)
      tip.style('display','block')
        .html(`<b>${d.data.name}</b> · ${d.data.value}%`)
      positionTip(event)
    })
    .on('mousemove', function(event) { positionTip(event) })
    .on('mouseleave', function() {
      d3.select(this).transition().duration(140).attr('d', arc as any)
      cvVal.text(`${avg}%`)
      cvLbl.text('média geral')
      tip.style('display','none')
    })

  // ── SVG Legend ────────────────────────────────────────────
  const legTop  = donutSize + hoverPad * 2 + 16
  const colW    = totalW / LEG_COLS
  const dotR    = 5
  const pillW   = 42
  const pillH   = 18
  const padding = 10   // inner padding each side of column
  const dotDiam = dotR * 2
  const gap     = 8    // dot → text gap

  // clip-path per column so names never bleed into the pill area
  const defs = svg.append('defs')
  ;[0, 1].forEach(col => {
    const nameMaxW = colW - padding * 2 - dotDiam - gap - pillW - 8
    defs.append('clipPath').attr('id', `leg-clip-${col}`)
      .append('rect')
        .attr('width', nameMaxW).attr('height', LEG_ROW_H)
        .attr('y', -LEG_ROW_H / 2)
  })

  const legTip = d3.select(el).append('div').attr('class', 'leg-tip')
  const legG = svg.append('g').attr('transform', `translate(0,${legTop})`)

  data.forEach((d, i) => {
    const col  = i % LEG_COLS
    const row  = Math.floor(i / LEG_COLS)
    const x    = col * colW + padding
    const y    = row * (LEG_ROW_H + LEG_GAP) + LEG_ROW_H / 2
    const rowW = colW - padding * 2

    const rowG = legG.append('g')
      .attr('transform', `translate(${x},${y})`)
      .style('cursor', 'default')

    // hover bg — also drives the name tooltip
    rowG.append('rect')
      .attr('x', -4).attr('y', -LEG_ROW_H / 2)
      .attr('width', rowW + 8).attr('height', LEG_ROW_H)
      .attr('rx', 5).attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        d3.select(this).attr('fill', 'rgba(0,0,0,0.05)')
        const rect = el.getBoundingClientRect()
        const cx = event.clientX - rect.left
        const cy = event.clientY - rect.top
        const tipW = 140
        const nearRight = cx > rect.width / 2
        legTip
          .style('display', 'block')
          .style('border-color', color(d.name))
          .html(`<span style="color:${color(d.name)}">●</span> ${d.name} · <b>${d.value}%</b>`)
          .style('left', nearRight ? `${cx - tipW - 10}px` : `${cx + 10}px`)
          .style('top', `${cy - 28}px`)
      })
      .on('mousemove', function(event) {
        const rect = el.getBoundingClientRect()
        const cx = event.clientX - rect.left
        const cy = event.clientY - rect.top
        const tipW = (legTip.node() as HTMLElement).offsetWidth || 140
        const nearRight = cx > rect.width / 2
        legTip
          .style('left', nearRight ? `${cx - tipW - 10}px` : `${cx + 10}px`)
          .style('top', `${cy - 28}px`)
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill', 'transparent')
        legTip.style('display', 'none')
      })

    // colored dot
    rowG.append('circle')
      .attr('r', dotR).attr('cx', dotR).attr('cy', 0)
      .attr('fill', color(d.name))

    // name — clipped so it never overlaps the pill
    rowG.append('text')
      .attr('x', dotDiam + gap)
      .attr('dy', '0.35em')
      .attr('clip-path', `url(#leg-clip-${col})`)
      .attr('fill', 'var(--bs-body-color)')
      .style('font-size', '11.5px')
      .text(d.name)

    // pill — anchored to the right edge of the column
    const pillX = rowW - pillW
    rowG.append('rect')
      .attr('x', pillX).attr('y', -pillH / 2)
      .attr('width', pillW).attr('height', pillH)
      .attr('rx', pillH / 2)
      .attr('fill', color(d.name)).attr('opacity', 0.15)

    rowG.append('text')
      .attr('x', pillX + pillW / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', color(d.name))
      .style('font-size', '11px').style('font-weight', '700')
      .text(`${d.value}%`)
  })
}

onMounted(() => {
  if (!container.value) return
  draw(container.value)
  resizeObserver = new ResizeObserver(() => { if (container.value) draw(container.value) })
  resizeObserver.observe(container.value)
})
onUnmounted(() => resizeObserver?.disconnect())
</script>

<style scoped>
.donut-wrap { position: relative; width: 100%; }
</style>

<style>
.leg-tip {
  display: none;
  position: absolute;
  background: var(--bs-secondary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--bs-light-text-emphasis);
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(76,76,92,0.15);
  z-index: 10;
}
.donut-tip {
  display: none;
  position: absolute;
  background: var(--bs-secondary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 6px 11px;
  font-size: 12px;
  color: var(--bs-light-text-emphasis);
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(76,76,92,0.15);
  z-index: 10;
}
</style>
