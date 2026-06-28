<template>
  <div class="topo-wrap">
    <svg ref="svgRef" class="topo-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'

interface Container { name: string; status: string; health: string }

const props = defineProps<{
  containers: Container[]
  wsReady: boolean
}>()

const svgRef = ref<SVGSVGElement | null>(null)

// ── Topology definition ──────────────────────────────────────────────────────────
// Columns left→right follow the platform data flow. Each node id == its
// docker container_name, so we match it against the observability API by name.

const COLUMNS: { title: string; nodes: string[] }[] = [
  { title: 'Monitor',                nodes: ['observability'] },
  { title: 'Ingestion & Streaming',  nodes: ['emqx', 'mqtt-kafka-bridge', 'kafka', 'flink-jobmanager', 'flink-taskmanager'] },
  { title: 'Storage',                nodes: ['iotdb', 'postgres', 'qdrant'] },
  { title: 'GPU Inference',          nodes: ['llm-server', 'vlm-server', 'embeddings'] },
  { title: 'Agent Brain',            nodes: ['agent-orchestrator', 'spc-mcp', 'rag-indexer'] },
  { title: 'Visualization',          nodes: ['grafana', 'superset'] },
]

const LABELS: Record<string, string> = {
  'observability': 'observability',
  'emqx': 'EMQX',
  'mqtt-kafka-bridge': 'MQTT → Kafka',
  'kafka': 'Kafka',
  'flink-jobmanager': 'Flink JobMgr',
  'flink-taskmanager': 'Flink TaskMgr',
  'iotdb': 'IoTDB',
  'postgres': 'PostgreSQL',
  'qdrant': 'Qdrant',
  'llm-server': 'llm-server',
  'vlm-server': 'vlm-server',
  'embeddings': 'embeddings',
  'agent-orchestrator': 'Orchestrator',
  'spc-mcp': 'spc-mcp',
  'rag-indexer': 'rag-indexer',
  'grafana': 'Grafana',
  'superset': 'Superset',
}

// Data-flow edges (source → target). Dots flow in this direction.
const EDGES: { from: string; to: string }[] = [
  // Ingestion pipeline
  { from: 'emqx',              to: 'mqtt-kafka-bridge' },
  { from: 'mqtt-kafka-bridge', to: 'kafka' },
  { from: 'kafka',             to: 'flink-jobmanager' },
  { from: 'flink-jobmanager',  to: 'flink-taskmanager' },
  { from: 'flink-jobmanager',  to: 'iotdb' },
  { from: 'flink-jobmanager',  to: 'postgres' },
  // Agent brain
  { from: 'agent-orchestrator', to: 'iotdb' },
  { from: 'agent-orchestrator', to: 'postgres' },
  { from: 'agent-orchestrator', to: 'qdrant' },
  { from: 'agent-orchestrator', to: 'llm-server' },
  { from: 'agent-orchestrator', to: 'vlm-server' },
  { from: 'agent-orchestrator', to: 'embeddings' },
  { from: 'agent-orchestrator', to: 'spc-mcp' },
  // RAG indexer
  { from: 'rag-indexer', to: 'embeddings' },
  { from: 'rag-indexer', to: 'qdrant' },
  { from: 'rag-indexer', to: 'postgres' },
  // Visualization
  { from: 'grafana',  to: 'iotdb' },
  { from: 'grafana',  to: 'postgres' },
  { from: 'superset', to: 'postgres' },
]

// ── Geometry ─────────────────────────────────────────────────────────────────────

const NODE_W = 150
const NODE_H = 54
const COL_GAP = 66
const ROW_GAP = 20
const MARGIN_X = 18
const MARGIN_TOP = 46
const MARGIN_BOTTOM = 16

const maxRows = Math.max(...COLUMNS.map(c => c.nodes.length))
const W = MARGIN_X * 2 + COLUMNS.length * NODE_W + (COLUMNS.length - 1) * COL_GAP
const H = MARGIN_TOP + maxRows * NODE_H + (maxRows - 1) * ROW_GAP + MARGIN_BOTTOM

interface Pos { x: number; y: number }
const pos: Record<string, Pos> = {}
COLUMNS.forEach((col, ci) => {
  col.nodes.forEach((id, ri) => {
    pos[id] = {
      x: MARGIN_X + ci * (NODE_W + COL_GAP),
      y: MARGIN_TOP + ri * (NODE_H + ROW_GAP),
    }
  })
})

// ── Health → colour ──────────────────────────────────────────────────────────────

function healthColor(c?: Container): string {
  if (!c)                          return '#cbd5e1'  // absent / offline
  if (c.status === 'restarting')   return '#fd7e14'  // orange
  if (c.health === 'unhealthy')    return '#dc3545'  // red
  if (c.health === 'healthy')      return '#3fb950'  // green
  if (c.status === 'running')      return '#58a6ff'  // blue (running, no healthcheck)
  if (c.status === 'exited')       return '#6c757d'  // grey
  if (c.status === 'created')      return '#8b949e'  // light grey
  return '#6c757d'
}
function statusText(c?: Container): string {
  if (!c) return 'offline'
  if (c.health && c.health !== 'none') return c.health
  return c.status
}

// ── D3 state ─────────────────────────────────────────────────────────────────────

interface EdgeEl {
  from: string; to: string
  pathNode: SVGPathElement
  len: number
  dots: d3.Selection<SVGCircleElement, number, any, any>
  line: d3.Selection<SVGPathElement, unknown, null, undefined>
  active: boolean
  color: string
}
const edgeEls: EdgeEl[] = []
const nodeEls: Record<string, {
  rect: d3.Selection<SVGRectElement, unknown, null, undefined>
  dot: d3.Selection<SVGCircleElement, unknown, null, undefined>
  status: d3.Selection<SVGTextElement, unknown, null, undefined>
}> = {}

let raf = 0
const DOTS_PER_EDGE = 3
const SPEED = 58 // px / second

function anchors(from: string, to: string) {
  const F = pos[from], T = pos[to]
  const rightward = T.x >= F.x
  const sx = rightward ? F.x + NODE_W : F.x
  const tx = rightward ? T.x          : T.x + NODE_W
  const sy = F.y + NODE_H / 2
  const ty = T.y + NODE_H / 2
  return { sx, sy, tx, ty }
}

function buildPath(from: string, to: string): string {
  const { sx, sy, tx, ty } = anchors(from, to)
  const dx = tx - sx
  const c1x = sx + dx * 0.5
  const c2x = tx - dx * 0.5
  return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`
}

function draw() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const gEdges = svg.append('g').attr('class', 'edges')
  const gDots  = svg.append('g').attr('class', 'flow-dots')
  const gNodes = svg.append('g').attr('class', 'nodes')
  const gHead  = svg.append('g').attr('class', 'headers')

  // Column headers
  COLUMNS.forEach((col, ci) => {
    const cx = MARGIN_X + ci * (NODE_W + COL_GAP) + NODE_W / 2
    gHead.append('text')
      .attr('x', cx).attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('class', 'topo-col-title')
      .text(col.title.toUpperCase())
  })

  // Edges + dots
  edgeEls.length = 0
  EDGES.forEach(e => {
    if (!pos[e.from] || !pos[e.to]) return
    const d = buildPath(e.from, e.to)
    const line = gEdges.append('path')
      .attr('d', d)
      .attr('fill', 'none')
      .attr('class', 'topo-edge')
    const pathNode = line.node() as SVGPathElement
    const len = pathNode.getTotalLength()

    const dots = gDots.selectAll(null)
      .data(d3.range(DOTS_PER_EDGE))
      .enter().append('circle')
      .attr('r', 3.2)
      .attr('class', 'topo-dot')
      .style('opacity', 0)

    edgeEls.push({ from: e.from, to: e.to, pathNode, len, dots, line, active: false, color: '#cbd5e1' })
  })

  // Nodes
  Object.entries(pos).forEach(([id, p]) => {
    const g = gNodes.append('g').attr('transform', `translate(${p.x},${p.y})`)

    const rect = g.append('rect')
      .attr('width', NODE_W).attr('height', NODE_H)
      .attr('rx', 9)
      .attr('class', 'topo-node-rect')

    // Label
    g.append('text')
      .attr('x', 13).attr('y', NODE_H / 2 - 3)
      .attr('class', 'topo-node-label')
      .text(LABELS[id] ?? id)

    // Status text
    const status = g.append('text')
      .attr('x', 13).attr('y', NODE_H / 2 + 14)
      .attr('class', 'topo-node-status')
      .text('—')

    // Status dot
    const dot = g.append('circle')
      .attr('cx', NODE_W - 15).attr('cy', 15).attr('r', 4.5)
      .attr('class', 'topo-node-dot')

    nodeEls[id] = { rect, dot, status }
  })

  updateStates()
  startAnim()
}

function updateStates() {
  const map: Record<string, Container> = {}
  for (const c of props.containers) map[c.name] = c

  // Nodes
  Object.keys(nodeEls).forEach(id => {
    const c = map[id]
    const color = healthColor(c)
    const absent = !c
    const running = !!c && c.status === 'running'
    const el = nodeEls[id]
    el.rect
      .attr('stroke', color)
      .attr('stroke-dasharray', absent ? '4 3' : null)
      .style('fill', absent ? 'transparent' : color)
      .style('fill-opacity', absent ? 0 : 0.07)
      .style('stroke-width', running ? 2.6 : 2)
    el.dot
      .attr('fill', color)
      .classed('dot-pulse', running)
    el.status
      .attr('fill', color)
      .text(statusText(c))
  })

  // Edges
  edgeEls.forEach(e => {
    const src = map[e.from]
    e.active = !!src && src.status === 'running'
    e.color = healthColor(src)
    e.line
      .attr('stroke', e.active ? e.color : '#d0d7de')
      .attr('stroke-width', e.active ? 2 : 1.4)
      .attr('stroke-dasharray', e.active ? null : '5 4')
      .style('opacity', e.active ? 0.4 : 0.55)
    if (!e.active) e.dots.style('opacity', 0)
  })
}

function startAnim() {
  cancelAnimationFrame(raf)
  const tick = () => {
    if (!(document as any).hidden && props.wsReady) {
      const now = performance.now() / 1000
      for (const e of edgeEls) {
        if (!e.active || e.len === 0) continue
        e.dots
          .attr('cx', (i: number) => {
            const l = ((now * SPEED) + (i * e.len) / DOTS_PER_EDGE) % e.len
            return e.pathNode.getPointAtLength(l).x
          })
          .attr('cy', (i: number) => {
            const l = ((now * SPEED) + (i * e.len) / DOTS_PER_EDGE) % e.len
            return e.pathNode.getPointAtLength(l).y
          })
          .attr('fill', e.color)
          .style('opacity', 0.95)
      }
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

onMounted(draw)
watch(() => props.containers, updateStates, { deep: true })
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<style>
.topo-wrap {
  width: 100%;
  overflow-x: auto;
  background: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px solid var(--bs-border-color);
  border-radius: 10px;
  padding: 4px 8px;
}
.topo-svg {
  width: 100%;
  min-width: 980px;
  height: auto;
  display: block;
}

.topo-col-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .07em;
  fill: var(--bs-secondary-color, #6c757d);
}

.topo-node-rect {
  transition: stroke .4s, fill-opacity .4s, stroke-width .3s;
}
.topo-node-label {
  font-size: 12.5px;
  font-weight: 700;
  fill: var(--bs-body-color, #24292f);
  dominant-baseline: middle;
}
.topo-node-status {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  dominant-baseline: middle;
}
.topo-node-dot { transition: fill .4s; }
.dot-pulse { animation: topo-dot-pulse 1.8s ease-in-out infinite; }
@keyframes topo-dot-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: .35; }
}

.topo-edge { transition: stroke .4s, opacity .4s; }
.topo-dot  { filter: drop-shadow(0 0 2px rgba(0,0,0,.15)); }
</style>
