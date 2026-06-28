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
// 5 pipeline columns laid out left→right along the data flow. Each node id ==
// its docker container_name, matched live against the observability API by name.
// `observability` sits in its own row above the columns (it monitors everything).

const COLUMNS: { title: string; nodes: string[] }[] = [
  { title: 'Ingestion & Streaming',  nodes: ['emqx', 'mqtt-kafka-bridge', 'kafka', 'flink-jobmanager', 'flink-taskmanager'] },
  { title: 'Storage',                nodes: ['iotdb', 'postgres', 'qdrant'] },
  { title: 'GPU Inference',          nodes: ['llm-server', 'vlm-server', 'embeddings'] },
  { title: 'Agent Brain',            nodes: ['agent-orchestrator', 'spc-mcp', 'rag-indexer'] },
  { title: 'Visualization',          nodes: ['grafana', 'superset'] },
]
const MONITOR = 'observability'

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
  { from: 'emqx',              to: 'mqtt-kafka-bridge' },
  { from: 'mqtt-kafka-bridge', to: 'kafka' },
  { from: 'kafka',             to: 'flink-jobmanager' },
  { from: 'flink-jobmanager',  to: 'flink-taskmanager' },
  { from: 'flink-jobmanager',  to: 'iotdb' },
  { from: 'flink-jobmanager',  to: 'postgres' },
  { from: 'agent-orchestrator', to: 'iotdb' },
  { from: 'agent-orchestrator', to: 'postgres' },
  { from: 'agent-orchestrator', to: 'qdrant' },
  { from: 'agent-orchestrator', to: 'llm-server' },
  { from: 'agent-orchestrator', to: 'vlm-server' },
  { from: 'agent-orchestrator', to: 'embeddings' },
  { from: 'agent-orchestrator', to: 'spc-mcp' },
  { from: 'rag-indexer', to: 'embeddings' },
  { from: 'rag-indexer', to: 'qdrant' },
  { from: 'rag-indexer', to: 'postgres' },
  { from: 'grafana',  to: 'iotdb' },
  { from: 'grafana',  to: 'postgres' },
  { from: 'superset', to: 'postgres' },
]

// ── Geometry ─────────────────────────────────────────────────────────────────────

const NODE_W = 150
const NODE_H = 54
const COL_GAP = 110
const ROW_GAP = 44
const MARGIN_X = 20
const OBS_Y = 14
const HEADER_Y = OBS_Y + NODE_H + 36
const NODE_TOP = HEADER_Y + 24
const SWOOP_BASE = 26    // first swoop lane offset below the grid
const SWOOP_STEP = 13    // gap between nested swoop lanes

const maxRows = Math.max(...COLUMNS.map(c => c.nodes.length))
const W = MARGIN_X * 2 + COLUMNS.length * NODE_W + (COLUMNS.length - 1) * COL_GAP
const GRID_BOTTOM = NODE_TOP + maxRows * NODE_H + (maxRows - 1) * ROW_GAP

const colX = (c: number) => MARGIN_X + c * (NODE_W + COL_GAP)
const colCenter = (c: number) => colX(c) + NODE_W / 2

function colOf(id: string): number { return COLUMNS.findIndex(c => c.nodes.includes(id)) }

interface Pos { x: number; y: number }
const pos: Record<string, Pos> = {}
COLUMNS.forEach((col, ci) => {
  col.nodes.forEach((id, ri) => {
    pos[id] = { x: colX(ci), y: NODE_TOP + ri * (NODE_H + ROW_GAP) }
  })
})
// Monitor node centered in the top row
pos[MONITOR] = { x: (W - NODE_W) / 2, y: OBS_Y }

// Pre-assign a nested "swoop lane" depth to every column-skipping edge.
// Longer spans dip deeper so the arcs nest cleanly instead of crossing.
const skipDepth: Record<string, number> = {}
{
  const skips = EDGES
    .map(e => ({ e, span: Math.abs(colOf(e.to) - colOf(e.from)) }))
    .filter(x => x.span >= 2)
    .sort((a, b) => a.span - b.span)
  skips.forEach((x, k) => { skipDepth[`${x.e.from}|${x.e.to}`] = GRID_BOTTOM + SWOOP_BASE + k * SWOOP_STEP })
}
const maxSwoop = Object.values(skipDepth).length
  ? Math.max(...Object.values(skipDepth))
  : GRID_BOTTOM
const H = maxSwoop + 34

// ── Edge path builder ────────────────────────────────────────────────────────────

function buildPath(from: string, to: string): string {
  const A = pos[from], B = pos[to]
  const ca = colOf(from), cb = colOf(to)

  // Within a column → straight vertical connector in the row gap
  if (ca === cb) {
    const x = A.x + NODE_W / 2
    const down = A.y < B.y
    const sy = down ? A.y + NODE_H : A.y
    const ty = down ? B.y : B.y + NODE_H
    return `M ${x} ${sy} L ${x} ${ty}`
  }

  const rightward = cb > ca
  const sx = rightward ? A.x + NODE_W : A.x
  const tx = rightward ? B.x : B.x + NODE_W
  const sy = A.y + NODE_H / 2
  const ty = B.y + NODE_H / 2

  // Adjacent columns → gentle curve through the (empty) column gutter
  if (Math.abs(cb - ca) === 1) {
    const k = COL_GAP * 0.5
    const c1x = sx + (rightward ? k : -k)
    const c2x = tx - (rightward ? k : -k)
    return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`
  }

  // Column-skipping → smooth arc that swoops BELOW the grid, clear of nodes
  const depth = skipDepth[`${from}|${to}`] ?? GRID_BOTTOM + SWOOP_BASE
  const c1x = sx + (rightward ? 50 : -50)
  const c2x = tx + (rightward ? -50 : 50)
  return `M ${sx} ${sy} C ${c1x} ${depth}, ${c2x} ${depth}, ${tx} ${ty}`
}

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

function draw() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const gMon   = svg.append('g').attr('class', 'monitor-links')
  const gEdges = svg.append('g').attr('class', 'edges')
  const gDots  = svg.append('g').attr('class', 'flow-dots')
  const gNodes = svg.append('g').attr('class', 'nodes')
  const gHead  = svg.append('g').attr('class', 'headers')

  // Faint dashed links from the monitor node down to each column (oversight)
  const mx = pos[MONITOR].x + NODE_W / 2
  const my = pos[MONITOR].y + NODE_H
  COLUMNS.forEach((_, ci) => {
    gMon.append('path')
      .attr('d', `M ${mx} ${my} C ${mx} ${my + 26}, ${colCenter(ci)} ${HEADER_Y - 34}, ${colCenter(ci)} ${HEADER_Y - 10}`)
      .attr('fill', 'none')
      .attr('class', 'topo-monitor-link')
  })

  // Column headers
  COLUMNS.forEach((col, ci) => {
    gHead.append('text')
      .attr('x', colCenter(ci)).attr('y', HEADER_Y)
      .attr('text-anchor', 'middle')
      .attr('class', 'topo-col-title')
      .text(col.title.toUpperCase())
  })

  // Edges + flow dots
  edgeEls.length = 0
  EDGES.forEach(e => {
    if (!pos[e.from] || !pos[e.to]) return
    const line = gEdges.append('path')
      .attr('d', buildPath(e.from, e.to))
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
      .attr('width', NODE_W).attr('height', NODE_H).attr('rx', 9)
      .attr('class', 'topo-node-rect')
    g.append('text')
      .attr('x', 13).attr('y', NODE_H / 2 - 3)
      .attr('class', 'topo-node-label')
      .text(LABELS[id] ?? id)
    const status = g.append('text')
      .attr('x', 13).attr('y', NODE_H / 2 + 14)
      .attr('class', 'topo-node-status')
      .text('—')
    const dot = g.append('circle')
      .attr('cx', NODE_W - 15).attr('cy', 15).attr('r', 4.5)
      .attr('class', 'topo-node-dot')
    nodeEls[id] = { rect, dot, status }
  })

  // Monitor caption
  gNodes.append('text')
    .attr('x', pos[MONITOR].x + NODE_W / 2).attr('y', pos[MONITOR].y + NODE_H + 14)
    .attr('text-anchor', 'middle')
    .attr('class', 'topo-monitor-caption')
    .text('monitors every container on this board')

  updateStates()
  startAnim()
}

function updateStates() {
  const map: Record<string, Container> = {}
  for (const c of props.containers) map[c.name] = c

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
    el.dot.attr('fill', color).classed('dot-pulse', running)
    el.status.attr('fill', color).text(statusText(c))
  })

  edgeEls.forEach(e => {
    const src = map[e.from]
    e.active = !!src && src.status === 'running'
    e.color = healthColor(src)
    e.line
      .attr('stroke', e.active ? e.color : '#d0d7de')
      .attr('stroke-width', e.active ? 2 : 1.4)
      .attr('stroke-dasharray', e.active ? null : '5 4')
      .style('opacity', e.active ? 0.45 : 0.5)
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
          .attr('cx', (i: number) => e.pathNode.getPointAtLength(((now * SPEED) + (i * e.len) / DOTS_PER_EDGE) % e.len).x)
          .attr('cy', (i: number) => e.pathNode.getPointAtLength(((now * SPEED) + (i * e.len) / DOTS_PER_EDGE) % e.len).y)
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
  min-width: 1000px;
  height: auto;
  display: block;
}

.topo-col-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .07em;
  fill: var(--bs-secondary-color, #6c757d);
}

.topo-node-rect { transition: stroke .4s, fill-opacity .4s, stroke-width .3s; }
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

.topo-monitor-link {
  stroke: var(--bs-secondary-color, #6c757d);
  stroke-width: 1.2;
  stroke-dasharray: 2 5;
  opacity: .22;
}
.topo-monitor-caption {
  font-size: 9.5px;
  font-style: italic;
  fill: var(--bs-secondary-color, #6c757d);
  opacity: .8;
}
</style>
