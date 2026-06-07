<template>
  <div class="sac-wrapper">
    <!-- Header -->
    <div class="sac-header">
      <div>
        <h4 class="card-title mb-1">Consumo de energia em R$ por mês</h4>
        <p class="text-muted fs-xs mb-0">{{ monthName }} {{ year }} · até dia {{ today }}</p>
      </div>
      <div class="sac-legend">
        <span class="sac-legend__item"><span class="sac-legend__dot sac-legend__dot--energia"></span>kWh</span>
        <span class="sac-legend__item"><span class="sac-legend__dot sac-legend__dot--sensores"></span>Sensores</span>
      </div>
    </div>

    <!-- Chart -->
    <div ref="container" class="sac-chart"></div>

    <!-- Stats row -->
    <div class="sac-stats">
      <div class="sac-stat">
        <span class="sac-stat__label">Consumo acumulado</span>
        <span class="sac-stat__value">R$ {{ accumulatedCost }}</span>
        <span class="sac-stat__badge sac-stat__badge--up">↑ 8.3%</span>
      </div>
      <div class="sac-stat">
        <span class="sac-stat__label">Previsão do mês</span>
        <span class="sac-stat__value">R$ {{ projectedCost }}</span>
        <span class="sac-stat__badge sac-stat__badge--neutral">IA estimativa</span>
      </div>
      <div class="sac-stat">
        <span class="sac-stat__label">Pico do dia</span>
        <span class="sac-stat__value">{{ peakDay }}</span>
        <span class="sac-stat__badge sac-stat__badge--down">↓ 4.1%</span>
      </div>
      <div class="sac-stat">
        <span class="sac-stat__label">Eficiência energética</span>
        <span class="sac-stat__value">94.7%</span>
        <span class="sac-stat__badge sac-stat__badge--up">↑ meta</span>
      </div>
      <div class="sac-stat">
        <span class="sac-stat__label">Alerta de demanda</span>
        <span class="sac-stat__value">Baixo risco</span>
        <span class="sac-stat__badge sac-stat__badge--neutral">IA</span>
      </div>
    </div>

    <!-- Collapsible model explanation -->
    <details class="sac-model" @toggle="onToggle">
      <summary class="sac-model__summary">Modelo estatístico utilizado</summary>
      <div ref="modelBody" class="sac-model__body">
        <p>Os diagnósticos acima são gerados por dois estágios complementares. Para cada série, os parâmetros são calculados <em>independentemente</em> usando apenas os valores daquela série.</p>

        <h6>1 — Detecção de valor atípico</h6>
        <p>Um valor \(x\) é classificado como <em>fora do padrão</em> se:</p>
        <div class="sac-formula">\[ x \leq \tau, \qquad \tau = 0{,}05 \cdot \max(x_i) \]</div>

        <h6>2 — Limites IQR (valores em operação)</h6>
        <p>Os quartis e a cerca de Tukey definem os limites de controle:</p>
        <div class="sac-formula">\[ L^{-} = Q_1 - 1{,}5 \cdot \text{IQR}, \qquad L^{+} = Q_3 + 1{,}5 \cdot \text{IQR}, \qquad \text{IQR} = Q_3 - Q_1 \]</div>
        <p>Guarda adicional: o desvio relativo à mediana deve superar 30% para evitar falsos positivos em séries muito estáveis:</p>
        <div class="sac-formula">\[ \frac{|x - \tilde{x}|}{\tilde{x}} > 0{,}30 \]</div>

        <h6>3 — P-valor (gráfico de controle)</h6>
        <p>Para cada ponto anômalo calcula-se o z-score em relação à distribuição normal dos valores em operação \((\mu,\,\sigma)\):</p>
        <div class="sac-formula">\[ z = \frac{x - \mu}{\sigma} \]</div>
        <p>O p-valor bicaudal é obtido via função de distribuição acumulada normal \(\Phi\):</p>
        <div class="sac-formula">\[ p = 2\left(1 - \Phi(|z|)\right), \qquad \Phi(z) = \frac{1}{2}\!\left[1 + \operatorname{erf}\!\left(\frac{z}{\sqrt{2}}\right)\right] \]</div>
        <p>Um p-valor baixo (ex.: \(p = 0{,}3\%\)) indica que há apenas 0,3% de probabilidade de aquele valor ocorrer em condições normais de operação — não identifica a causa, apenas sinaliza que o valor <strong>não é esperado</strong>.</p>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'

const container = ref<HTMLDivElement | null>(null)
const modelBody = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

function loadMathJax() {
  if ((window as any).MathJax) return
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js'
  script.async = true
  script.id = 'mathjax-script'
  ;(window as any).MathJax = {
    tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
    options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'] },
  }
  document.head.appendChild(script)
}

function onToggle(e: Event) {
  const details = e.target as HTMLDetailsElement
  if (!details.open) return
  if ((window as any).MathJax?.typesetPromise && modelBody.value) {
    (window as any).MathJax.typesetPromise([modelBody.value])
  } else {
    loadMathJax()
    // typeset after MathJax loads
    const check = setInterval(() => {
      if ((window as any).MathJax?.typesetPromise && modelBody.value) {
        clearInterval(check)
        ;(window as any).MathJax.typesetPromise([modelBody.value])
      }
    }, 200)
  }
}

// ── Date context ──────────────────────────────────────────
const now = new Date()
const today = now.getDate()
const year = now.getFullYear()
const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate()
const monthName = now.toLocaleString('pt-BR', { month: 'long' })
  .replace(/^\w/, c => c.toUpperCase())

// ── Generate fake data: one entry per day up to today ─────
function generateData() {
  return Array.from({ length: today }, (_, i) => {
    const d = i + 1
    const base = 45 + d * 80 + Math.sin(d * 0.7) * 120
    const noise = (Math.random() - 0.5) * 60
    const energia = Math.round(Math.max(30, base + noise))
    const sensores = Math.round(energia * 0.22 + Math.random() * 20)
    return { day: d, label: `Dia ${d}`, energia, sensores }
  })
}

const rawData = generateData()

// ── Stats ─────────────────────────────────────────────────
const ratePerKwh = 0.87  // fake R$/kWh
const accumulatedCost = computed(() => {
  const total = rawData.reduce((s, d) => s + d.energia, 0)
  return (total * ratePerKwh).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
})
const projectedCost = computed(() => {
  const avg = rawData.reduce((s, d) => s + d.energia, 0) / rawData.length
  return (avg * daysInMonth * ratePerKwh).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
})
const peakDay = computed(() => {
  const peak = rawData.reduce((a, b) => a.energia > b.energia ? a : b)
  return `Dia ${peak.day} — ${peak.energia} kWh`
})

// ── Colors ────────────────────────────────────────────────
const colors = {
  energia: 'var(--bs-primary)',
  sensores: 'var(--bs-secondary)',
}

// ── Draw ─────────────────────────────────────────────────
function draw(el: HTMLDivElement) {
  el.innerHTML = ''
  const { width } = el.getBoundingClientRect()
  if (width === 0) return

  const height = 220
  const mt = 12, mr = 16, mb = 28, ml = 52

  type Row = typeof rawData[0]
  const keys: (keyof Row)[] = ['sensores', 'energia']

  const stack = d3.stack<Row>()
    .keys(keys as string[])
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone)

  const series = stack(rawData)

  // Show every other day label if > 15 days
  const tickEvery = daysInMonth > 20 ? 5 : daysInMonth > 10 ? 2 : 1

  const x = d3.scaleLinear()
    .domain([1, daysInMonth])
    .range([ml, width - mr])

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, s => d3.max(s, d => d[1])) ?? 0])
    .nice()
    .range([height - mb, mt])

  const areaFn = d3.area<[number, number, unknown]>()
    .x((_, i) => x(rawData[i].day))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveCatmullRom.alpha(0.5))

  const lineFn = d3.line<[number, number, unknown]>()
    .x((_, i) => x(rawData[i].day))
    .y(d => y(d[1]))
    .curve(d3.curveCatmullRom.alpha(0.5))

  const svg = d3.select(el).append('svg')
    .attr('width', width).attr('height', height)
    .style('overflow', 'visible')

  const defs = svg.append('defs')
  keys.forEach(key => {
    const grad = defs.append('linearGradient')
      .attr('id', `sac-grad-${key}`)
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1')
    grad.append('stop').attr('offset', '0%').attr('stop-color', colors[key as keyof typeof colors]).attr('stop-opacity', 0.45)
    grad.append('stop').attr('offset', '100%').attr('stop-color', colors[key as keyof typeof colors]).attr('stop-opacity', 0.04)
  })

  // Grid
  svg.append('g').attr('transform', `translate(${ml},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(width - ml - mr)).tickFormat(() => ''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').attr('stroke', '#676b891f').attr('stroke-dasharray', '4,3'))

  // "Today" vertical line
  svg.append('line')
    .attr('x1', x(today)).attr('x2', x(today))
    .attr('y1', mt).attr('y2', height - mb)
    .attr('stroke', 'var(--bs-primary)').attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3').attr('opacity', 0.5)

  svg.append('text')
    .attr('x', x(today) + 4).attr('y', mt + 10)
    .attr('fill', 'var(--bs-primary)').style('font-size', '10px')
    .text('hoje')

  // Areas + lines
  series.forEach(s => {
    svg.append('path').datum(s as unknown as [number, number, unknown][])
      .attr('fill', `url(#sac-grad-${s.key})`).attr('d', areaFn)
    svg.append('path').datum(s as unknown as [number, number, unknown][])
      .attr('fill', 'none')
      .attr('stroke', colors[s.key as keyof typeof colors])
      .attr('stroke-width', 2).attr('d', lineFn)
  })

  // X axis — days
  svg.append('g').attr('transform', `translate(0,${height - mb})`)
    .call(d3.axisBottom(x)
      .tickValues(Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d % tickEvery === 0 || d === 1 || d === today))
      .tickFormat(d => `${d}`)
    )
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').remove())
    .call(g => g.selectAll('text').attr('fill', 'var(--bs-secondary-color)').style('font-size', '11px'))

  // Y axis — R$
  svg.append('g').attr('transform', `translate(${ml},0)`)
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => `R$${d}`))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').remove())
    .call(g => g.selectAll('text').attr('fill', 'var(--bs-secondary-color)').style('font-size', '11px'))

  // Tooltip
  const tooltip = d3.select(el).append('div').attr('class', 'sac-tooltip')
  svg.append('rect')
    .attr('x', ml).attr('y', mt)
    .attr('width', width - ml - mr).attr('height', height - mt - mb)
    .attr('fill', 'transparent')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event)
      const dayVal = Math.max(1, Math.min(today, Math.round(x.invert(mx))))
      const d = rawData[dayVal - 1]
      if (!d) return
      const cx = x(d.day)
      const total = d.energia + d.sensores
      tooltip.style('display', 'block')
        .style('left', `${Math.min(cx + 8, width - 160)}px`)
        .style('top', `${y(total) - 8}px`)
        .html(`
          <div class="sac-tooltip__day">Dia ${d.day}</div>
          <div class="sac-tooltip__row"><span style="color:${colors.energia}">●</span> Consumo: <b>${d.energia} kWh</b> · R$ ${(d.energia * ratePerKwh).toFixed(2)}</div>
          <div class="sac-tooltip__row"><span style="color:${colors.sensores}">●</span> Sensores: <b>${d.sensores}</b></div>
        `)
    })
    .on('mouseleave', () => tooltip.style('display', 'none'))
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
.sac-wrapper { width: 100%; }

.sac-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.sac-legend { display: flex; gap: 12px; align-items: center; }
.sac-legend__item { display: flex; align-items: center; gap: 5px; font-size: 0.72rem; color: var(--bs-secondary-color); }
.sac-legend__dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.sac-legend__dot--energia { background: var(--bs-primary); }
.sac-legend__dot--sensores { background: var(--bs-secondary); }

.sac-chart { position: relative; width: 100%; min-height: 220px; }

/* Stats strip */
.sac-stats {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--bs-border-color);
  margin-top: 12px;
}
.sac-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-right: 1px solid var(--bs-border-color);
}
.sac-stat:last-child { border-right: none; }
.sac-stat__label { font-size: 0.68rem; color: var(--bs-secondary-color); text-transform: uppercase; letter-spacing: 0.4px; }
.sac-stat__value { font-size: 0.88rem; font-weight: 600; color: var(--bs-body-color); }
.sac-stat__badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  width: fit-content;
}
.sac-stat__badge--up { background: rgba(55,135,45,0.12); color: #37872d; }
.sac-stat__badge--down { background: rgba(232,64,64,0.1); color: #e84040; }
.sac-stat__badge--neutral { background: rgba(var(--bs-secondary-rgb), 0.12); color: var(--bs-secondary-color); }

/* Collapsible model */
.sac-model {
  margin-top: 8px;
  border-top: 1px solid var(--bs-border-color);
}
.sac-model__summary {
  list-style: none;
  cursor: pointer;
  padding: 8px 0;
  font-size: 0.78rem;
  color: var(--bs-secondary-color);
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sac-model__summary::-webkit-details-marker { display: none; }
.sac-model__summary::before {
  content: '▶';
  font-size: 0.6rem;
  transition: transform 0.2s;
  display: inline-block;
}
details[open] .sac-model__summary::before { transform: rotate(90deg); }

.sac-model__body {
  background: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 16px 20px;
  font-size: 0.82rem;
  line-height: 1.65;
  color: var(--bs-body-color);
  margin-bottom: 8px;
}
.sac-model__body h6 {
  font-weight: 700;
  margin: 14px 0 4px;
  font-size: 0.82rem;
}
.sac-model__body p { margin: 0 0 6px; }
.sac-formula {
  text-align: center;
  padding: 6px 0;
  overflow-x: auto;
}
</style>

<style>
.sac-tooltip {
  display: none;
  position: absolute;
  background: var(--bs-secondary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--bs-light-text-emphasis);
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(76,76,92,0.15);
  z-index: 10;
}
.sac-tooltip__day { font-weight: 600; margin-bottom: 4px; }
.sac-tooltip__row { margin-top: 2px; }
</style>
