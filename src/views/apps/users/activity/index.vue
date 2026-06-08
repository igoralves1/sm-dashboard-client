<template>
  <MainLayout>
    <BContainer fluid class="py-3">

      <!-- Page header -->
      <BRow class="mb-3 align-items-center">
        <BCol>
          <h4 class="mb-0 fw-semibold">Atividade de Usuários</h4>
          <p class="text-muted fs-xs mb-0">Sessões, páginas visitadas, cliques e localização em tempo real.</p>
        </BCol>
        <BCol xs="auto" class="d-flex gap-2 align-items-center flex-wrap">
          <span v-if="loading" class="text-muted fs-xs d-flex align-items-center gap-1">
            <Icon icon="tabler:loader-2" width="14" class="spin" />
            {{ syncing ? `Enviando ${syncCount} sessões para S3…` : 'Carregando S3…' }}
          </span>
          <span v-if="syncCount > 0 && !loading && !s3Error" class="text-success fs-xs d-flex align-items-center gap-1">
            <Icon icon="tabler:circle-check" width="14" /> {{ syncCount }} sessões sincronizadas
          </span>
          <span v-if="s3Error && !loading" class="text-danger fs-xs d-flex align-items-center gap-1">
            <Icon icon="tabler:alert-circle" width="14" /> Erro ao acessar S3
          </span>
          <button class="act-btn act-btn--ghost" :disabled="loading" @click="refresh">
            <Icon icon="tabler:refresh" width="15" /> Atualizar
          </button>
          <button class="act-btn act-btn--danger" @click="clearAll">
            <Icon icon="tabler:trash" width="15" /> Limpar dados
          </button>
        </BCol>
      </BRow>

      <!-- Global stat cards (Todos only) -->
      <BRow v-if="selectedUser === 'Todos'" class="g-3 mb-3">
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--blue"><Icon icon="tabler:users" width="20" /></div>
            <div><div class="stat-val">{{ uniqueUsers.length }}</div><div class="stat-label">Usuários distintos</div></div>
          </div>
        </BCol>
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--green"><Icon icon="tabler:file-analytics" width="20" /></div>
            <div><div class="stat-val">{{ sessions.length }}</div><div class="stat-label">Total de sessões</div></div>
          </div>
        </BCol>
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--orange"><Icon icon="tabler:pointer" width="20" /></div>
            <div><div class="stat-val">{{ totalClicks }}</div><div class="stat-label">Cliques registrados</div></div>
          </div>
        </BCol>
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--purple"><Icon icon="tabler:clock" width="20" /></div>
            <div><div class="stat-val">{{ avgDuration }}s</div><div class="stat-label">Tempo médio por página</div></div>
          </div>
        </BCol>
      </BRow>

      <!-- User selector tabs -->
      <BCard no-body class="mb-3">
        <div class="user-tabs">
          <button
            v-for="u in ['Todos', ...uniqueUsers]"
            :key="u"
            :class="['user-tab', { 'user-tab--active': selectedUser === u }]"
            @click="selectedUser = u"
          >
            <Icon v-if="u === 'Todos'" icon="tabler:layout-grid" width="13" />
            <Icon v-else icon="tabler:user-circle" width="13" />
            {{ u === 'Todos' ? 'Todos' : u }}
            <span class="user-tab-count">{{ u === 'Todos' ? sessions.length : sessionsByUser(u).length }}</span>
          </button>
        </div>
      </BCard>

      <!-- ═══ USER PROFILE VIEW ═══ -->
      <template v-if="selectedUser !== 'Todos' && userStats">

        <!-- Profile hero -->
        <div class="user-hero mb-3">
          <div class="user-hero-avatar">{{ avatarLetter(selectedUser) }}</div>
          <div class="user-hero-info">
            <div class="user-hero-name">{{ selectedUser }}</div>
            <div class="user-hero-meta">
              <span><Icon icon="tabler:calendar" width="12" /> Primeiro acesso: {{ fmtFull(userStats.firstSeen) }}</span>
              <span><Icon icon="tabler:clock" width="12" /> Último acesso: {{ fmtFull(userStats.lastSeen) }}</span>
              <span v-if="userStats.lastGeo">
                <Icon icon="tabler:map-pin" width="12" />
                {{ userStats.lastGeo.city }}, {{ userStats.lastGeo.country }}
              </span>
            </div>
          </div>
          <div class="user-hero-status" :class="userStats.isOnline ? 'status--online' : 'status--offline'">
            <span class="status-dot"></span>
            {{ userStats.isOnline ? 'Online agora' : 'Offline' }}
          </div>
        </div>

        <!-- User stat cards -->
        <BRow class="g-3 mb-3">
          <BCol sm="6" lg="3">
            <div class="stat-card stat-card--accent">
              <div class="stat-icon stat-icon--blue"><Icon icon="tabler:timeline" width="20" /></div>
              <div><div class="stat-val">{{ userStats.totalSessions }}</div><div class="stat-label">Sessões totais</div></div>
            </div>
          </BCol>
          <BCol sm="6" lg="3">
            <div class="stat-card stat-card--accent">
              <div class="stat-icon stat-icon--green"><Icon icon="tabler:clock" width="20" /></div>
              <div><div class="stat-val">{{ userStats.totalTime }}s</div><div class="stat-label">Tempo total no sistema</div></div>
            </div>
          </BCol>
          <BCol sm="6" lg="3">
            <div class="stat-card stat-card--accent">
              <div class="stat-icon stat-icon--orange"><Icon icon="tabler:pointer" width="20" /></div>
              <div><div class="stat-val">{{ userStats.totalClicks }}</div><div class="stat-label">Cliques totais</div></div>
            </div>
          </BCol>
          <BCol sm="6" lg="3">
            <div class="stat-card stat-card--accent">
              <div class="stat-icon stat-icon--purple"><Icon icon="tabler:route" width="20" /></div>
              <div><div class="stat-val">{{ userStats.uniquePages }}</div><div class="stat-label">Páginas distintas</div></div>
            </div>
          </BCol>
        </BRow>

        <BRow class="g-3 mb-3">

          <!-- IP & Geolocation history -->
          <BCol lg="4">
            <div class="detail-panel">
              <div class="panel-title"><Icon icon="tabler:map-pin" width="14" /> IPs e Localização</div>
              <div class="ip-list">
                <div v-for="(geo, ip) in userStats.geoByIp" :key="ip" class="ip-row">
                  <div class="ip-flag"><Icon icon="tabler:world" width="14" /></div>
                  <div class="ip-info">
                    <code class="ip-addr">{{ ip }}</code>
                    <div class="ip-loc">{{ geo.city }}, {{ geo.region }}, {{ geo.country }}</div>
                    <div class="ip-coords">{{ geo.lat.toFixed(4) }}, {{ geo.lng.toFixed(4) }}</div>
                  </div>
                  <div class="ip-count">{{ geo.count }}×</div>
                </div>
                <div v-if="!Object.keys(userStats.geoByIp).length" class="panel-empty">
                  Sem dados de localização
                </div>
              </div>
            </div>
          </BCol>

          <!-- Pages visited breakdown -->
          <BCol lg="4">
            <div class="detail-panel">
              <div class="panel-title"><Icon icon="tabler:files" width="14" /> Páginas Visitadas</div>
              <div class="page-list">
                <div v-for="p in userStats.pageBreakdown" :key="p.page" class="page-row">
                  <div class="page-path">{{ p.page }}</div>
                  <div class="page-bar-wrap">
                    <div class="page-bar">
                      <div class="page-bar-fill" :style="{ width: p.pct + '%' }"></div>
                    </div>
                    <span class="page-count">{{ p.count }}×</span>
                  </div>
                  <div class="page-time">ø {{ p.avgTime }}s</div>
                </div>
                <div v-if="!userStats.pageBreakdown.length" class="panel-empty">Sem dados</div>
              </div>
            </div>
          </BCol>

          <!-- Top clicked elements -->
          <BCol lg="4">
            <div class="detail-panel">
              <div class="panel-title"><Icon icon="tabler:pointer" width="14" /> Elementos Mais Clicados</div>
              <div class="click-list">
                <div v-for="(c, i) in userStats.topClicks" :key="i" class="top-click-row">
                  <span class="top-click-rank">#{{ i + 1 }}</span>
                  <div class="top-click-info">
                    <div class="top-click-el">{{ c.element }}</div>
                    <div v-if="c.text" class="top-click-text">"{{ c.text }}"</div>
                  </div>
                  <span class="top-click-count">{{ c.count }}×</span>
                </div>
                <div v-if="!userStats.topClicks.length" class="panel-empty">Nenhum clique registrado</div>
              </div>
            </div>
          </BCol>
        </BRow>

        <!-- Session timeline -->
        <div class="detail-panel mb-3">
          <div class="panel-title"><Icon icon="tabler:timeline" width="14" /> Histórico de Sessões</div>
          <div class="session-timeline">
            <div v-for="s in userStats.sessions" :key="s.id" class="stl-item" @click="toggle(s.id)">
              <div class="stl-left">
                <span class="stl-dot" :class="s.exitedAt ? 'stl-dot--done' : 'stl-dot--live'"></span>
                <div>
                  <div class="stl-page">{{ s.page }}</div>
                  <div class="stl-ts">{{ fmtFull(s.enteredAt) }}</div>
                </div>
              </div>
              <div class="stl-right">
                <span class="stl-dur"><Icon icon="tabler:clock" width="11" /> {{ s.duration ?? '—' }}s</span>
                <span class="stl-clicks"><Icon icon="tabler:pointer" width="11" /> {{ s.clicks.length }}</span>
                <span class="stl-mouse"><Icon icon="tabler:brand-mouse" width="11" /> {{ s.mouseTrails.length }}</span>
                <Icon :icon="expandedId === s.id ? 'tabler:chevron-up' : 'tabler:chevron-down'" width="14" class="stl-chevron" />
              </div>
            </div>

            <!-- Expanded session detail inside timeline -->
            <div v-if="expandedId" class="stl-detail">
              <template v-for="s in userStats.sessions" :key="s.id">
                <div v-if="expandedId === s.id" class="stl-detail-body">
                  <div class="stl-detail-grid">
                    <div>
                      <div class="detail-mini-title">Linha do tempo</div>
                      <div class="tl-item"><span class="tl-dot tl-dot--green"></span><span class="tl-text">Entrou</span><span class="tl-ts">{{ fmtFull(s.enteredAt) }}</span></div>
                      <div v-if="s.exitedAt" class="tl-item"><span class="tl-dot tl-dot--gray"></span><span class="tl-text">Saiu · {{ s.duration }}s</span><span class="tl-ts">{{ fmtFull(s.exitedAt) }}</span></div>
                      <div v-if="s.geo" class="tl-item mt-2"><span class="tl-dot" style="background:#6f42c1"></span><span class="tl-text">IP: <code style="font-size:0.68rem">{{ s.geo.ip }}</code> · {{ s.geo.city }}, {{ s.geo.country }}</span></div>
                    </div>
                    <div>
                      <div class="detail-mini-title">Rastro do mouse ({{ s.mouseTrails.length }} amostras)</div>
                      <div class="mouse-trail">
                        <div v-for="(m, i) in s.mouseTrails" :key="i" class="mouse-row">
                          <span class="mouse-t">+{{ m.t }}s</span>
                          <div class="mouse-bar"><div class="mouse-bar-fill" :style="{ width: m.pct_x + '%' }"></div></div>
                          <span class="mouse-pos">{{ m.x }},{{ m.y }}px</span>
                          <span class="mouse-el">{{ m.element }}</span>
                        </div>
                        <div v-if="!s.mouseTrails.length" class="panel-empty">Sem dados</div>
                      </div>
                    </div>
                    <div>
                      <div class="detail-mini-title">Cliques ({{ s.clicks.length }})</div>
                      <div class="clicks-list">
                        <div v-for="(c, i) in s.clicks" :key="i" class="click-row">
                          <span class="click-t">+{{ c.t }}s</span>
                          <span class="click-el">{{ c.element }}</span>
                          <span v-if="c.text" class="click-text">"{{ c.text }}"</span>
                        </div>
                        <div v-if="!s.clicks.length" class="panel-empty">Sem cliques</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- ═══ ALL SESSIONS VIEW ═══ -->
      <template v-else>
        <BRow class="g-3">
          <BCol v-for="s in filteredSessions" :key="s.id" xl="6">
            <div class="session-card" :class="{ 'session-card--open': expandedId === s.id }">
              <div class="session-header" @click="toggle(s.id)">
                <div class="session-header-left">
                  <div class="session-avatar">{{ avatarLetter(s.user) }}</div>
                  <div>
                    <div class="session-user">{{ s.user }}</div>
                    <div class="session-page"><Icon icon="tabler:arrow-right" width="11" />{{ s.page }}</div>
                  </div>
                </div>
                <div class="session-header-right">
                  <div class="session-time">{{ fmtTime(s.enteredAt) }}</div>
                  <div class="session-dur"><Icon icon="tabler:clock" width="11" />{{ s.duration ?? '—' }}s</div>
                  <Icon :icon="expandedId === s.id ? 'tabler:chevron-up' : 'tabler:chevron-down'" width="16" class="session-chevron" />
                </div>
              </div>
              <div v-if="expandedId === s.id" class="session-body">
                <div class="detail-section">
                  <div class="detail-title"><Icon icon="tabler:map-pin" width="13" /> Localização & IP</div>
                  <div v-if="s.geo" class="detail-geo">
                    <div class="geo-row"><span class="geo-label">IP</span><code class="geo-val">{{ s.geo.ip }}</code></div>
                    <div class="geo-row"><span class="geo-label">Cidade</span><span class="geo-val">{{ s.geo.city }}, {{ s.geo.region }}</span></div>
                    <div class="geo-row"><span class="geo-label">País</span><span class="geo-val">{{ s.geo.country }}</span></div>
                    <div class="geo-row"><span class="geo-label">Coordenadas</span><span class="geo-val">{{ s.geo.lat.toFixed(4) }}, {{ s.geo.lng.toFixed(4) }}</span></div>
                  </div>
                  <div v-else class="detail-empty">Localização não disponível</div>
                </div>
                <div class="detail-section">
                  <div class="detail-title"><Icon icon="tabler:timeline" width="13" /> Linha do tempo</div>
                  <div class="timeline">
                    <div class="tl-item tl-item--entry"><span class="tl-dot tl-dot--green"></span><span class="tl-text">Entrou na página</span><span class="tl-ts">{{ fmtFull(s.enteredAt) }}</span></div>
                    <div v-if="s.exitedAt" class="tl-item"><span class="tl-dot tl-dot--gray"></span><span class="tl-text">Saiu · {{ s.duration }}s</span><span class="tl-ts">{{ fmtFull(s.exitedAt) }}</span></div>
                    <div v-else class="tl-item"><span class="tl-dot tl-dot--pulse"></span><span class="tl-text tl-text--live">Em sessão agora</span></div>
                  </div>
                </div>
                <div class="detail-section">
                  <div class="detail-title"><Icon icon="tabler:brand-mouse" width="13" /> Rastro do mouse <span class="detail-badge">{{ s.mouseTrails.length }} amostras</span></div>
                  <div v-if="s.mouseTrails.length" class="mouse-trail">
                    <div v-for="(m, i) in s.mouseTrails" :key="i" class="mouse-row">
                      <span class="mouse-t">+{{ m.t }}s</span>
                      <div class="mouse-bar"><div class="mouse-bar-fill" :style="{ width: m.pct_x + '%' }"></div></div>
                      <span class="mouse-pos">{{ m.x }},{{ m.y }}px</span>
                      <span class="mouse-el">{{ m.element }}</span>
                    </div>
                  </div>
                  <div v-else class="detail-empty">Nenhum dado de mouse</div>
                </div>
                <div class="detail-section">
                  <div class="detail-title"><Icon icon="tabler:pointer" width="13" /> Cliques <span class="detail-badge">{{ s.clicks.length }}</span></div>
                  <div v-if="s.clicks.length" class="clicks-list">
                    <div v-for="(c, i) in s.clicks" :key="i" class="click-row">
                      <span class="click-t">+{{ c.t }}s</span>
                      <span class="click-pos">{{ c.x }},{{ c.y }}</span>
                      <span class="click-el">{{ c.element }}</span>
                      <span v-if="c.text" class="click-text">"{{ c.text }}"</span>
                    </div>
                  </div>
                  <div v-else class="detail-empty">Nenhum clique registrado</div>
                </div>
              </div>
            </div>
          </BCol>
          <BCol v-if="!filteredSessions.length" xs="12">
            <div class="empty-state">
              <Icon icon="tabler:mood-empty" width="48" class="empty-icon" />
              <p>Nenhuma sessão registrada ainda.</p>
              <small>Navegue pelo sistema para gerar dados de atividade.</small>
            </div>
          </BCol>
        </BRow>
      </template>

    </BContainer>
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { BCard, BCol, BContainer, BRow } from 'bootstrap-vue-next'
import { Icon } from '@iconify/vue'
import MainLayout from '@/layouts/MainLayout.vue'
import { useSessionTracker, type PageSession } from '@/composables/useSessionTracker'
import { useS3Activity } from '@/composables/useS3Activity'

const { getSessions, clear } = useSessionTracker()
const { loadAllSessions, uploadSession } = useS3Activity()

const sessions     = ref<PageSession[]>(getSessions())
const expandedId   = ref<string | null>(null)
const selectedUser = ref('Todos')
const loading      = ref(false)
const syncing      = ref(false)
const s3Error      = ref(false)
const syncCount    = ref(0)   // sessions pushed in last sync

// Upload any local sessions not yet in S3, return merged list
async function syncAndLoad(): Promise<PageSession[]> {
  const s3Sessions = await loadAllSessions()
  const s3Ids      = new Set(s3Sessions.map(s => s.id))
  const localOnly  = getSessions().filter(s => !s3Ids.has(s.id))

  if (localOnly.length) {
    syncing.value  = true
    syncCount.value = localOnly.length
    await Promise.all(localOnly.map(s => uploadSession(s)))
    syncing.value  = false
  } else {
    syncCount.value = 0
  }

  return [...s3Sessions, ...localOnly].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))
}

// Load from S3 on mount — also pushes any local-only sessions
onMounted(async () => {
  loading.value = true
  s3Error.value = false
  try {
    sessions.value = await syncAndLoad()
  } catch {
    s3Error.value = true
    sessions.value = getSessions()
  } finally {
    loading.value = false
  }
})

// Reset expanded when switching users
watch(selectedUser, () => { expandedId.value = null })

async function refresh() {
  loading.value = true
  s3Error.value = false
  try {
    sessions.value = await syncAndLoad()
  } catch {
    s3Error.value = true
    sessions.value = getSessions()
  } finally {
    loading.value = false
  }
}

function clearAll() {
  if (confirm('Apagar todos os dados de atividade?')) { clear(); sessions.value = [] }
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

const uniqueUsers = computed(() =>
  [...new Set(sessions.value.map(s => s.user))].filter(u => u !== 'anonymous')
)

function sessionsByUser(user: string) {
  return sessions.value.filter(s => s.user === user)
}

const filteredSessions = computed(() =>
  selectedUser.value === 'Todos' ? sessions.value : sessionsByUser(selectedUser.value)
)

// ── Global stats (Todos) ────────────────────────────────────────────────────
const totalClicks = computed(() => sessions.value.reduce((a, s) => a + s.clicks.length, 0))
const avgDuration = computed(() => {
  const w = sessions.value.filter(s => s.duration != null)
  return w.length ? Math.round(w.reduce((a, s) => a + (s.duration ?? 0), 0) / w.length) : 0
})

// ── Per-user consolidated stats ─────────────────────────────────────────────
const userStats = computed(() => {
  if (selectedUser.value === 'Todos') return null
  const us = sessionsByUser(selectedUser.value)
  if (!us.length) return null

  const sorted = [...us].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))
  const firstSeen = sorted[0].enteredAt
  const lastSeen  = sorted[sorted.length - 1].enteredAt
  const isOnline  = us.some(s => !s.exitedAt)

  const totalTime   = us.reduce((a, s) => a + (s.duration ?? 0), 0)
  const totalClicks = us.reduce((a, s) => a + s.clicks.length, 0)

  // Unique pages + breakdown
  const pageMap: Record<string, { count: number; times: number[] }> = {}
  us.forEach(s => {
    if (!pageMap[s.page]) pageMap[s.page] = { count: 0, times: [] }
    pageMap[s.page].count++
    if (s.duration) pageMap[s.page].times.push(s.duration)
  })
  const maxCount = Math.max(...Object.values(pageMap).map(p => p.count), 1)
  const pageBreakdown = Object.entries(pageMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([page, d]) => ({
      page,
      count:   d.count,
      avgTime: d.times.length ? Math.round(d.times.reduce((a, v) => a + v, 0) / d.times.length) : 0,
      pct:     Math.round((d.count / maxCount) * 100),
    }))

  // Geo by IP (deduplicated)
  const geoByIp: Record<string, { city: string; region: string; country: string; lat: number; lng: number; count: number }> = {}
  us.forEach(s => {
    if (!s.geo) return
    const ip = s.geo.ip
    if (!geoByIp[ip]) geoByIp[ip] = { ...s.geo, count: 0 }
    geoByIp[ip].count++
  })

  // Top clicked elements
  const clickMap: Record<string, { element: string; text: string; count: number }> = {}
  us.forEach(s => s.clicks.forEach(c => {
    const k = c.element
    if (!clickMap[k]) clickMap[k] = { element: c.element, text: c.text, count: 0 }
    clickMap[k].count++
  }))
  const topClicks = Object.values(clickMap).sort((a, b) => b.count - a.count).slice(0, 8)

  // Last known geo
  const lastGeo = [...us].reverse().find(s => s.geo)?.geo

  return {
    sessions:    [...us].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt)),
    firstSeen, lastSeen, isOnline,
    totalSessions: us.length,
    totalTime, totalClicks,
    uniquePages: Object.keys(pageMap).length,
    pageBreakdown, geoByIp, topClicks, lastGeo,
  }
})

// ── Helpers ─────────────────────────────────────────────────────────────────
function avatarLetter(user: string) { return user === 'anonymous' ? '?' : user[0].toUpperCase() }

function fmtTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1)  return 'agora'
  if (diff < 60) return `${diff}min atrás`
  const h = Math.floor(diff / 60)
  if (h < 24)   return `${h}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
</script>

<style scoped>
@keyframes spin { to { transform: rotate(360deg) } }
.spin { animation: spin 1s linear infinite; display: inline-block; }

/* ── Stat cards ─────────────────────────────────────────────────────────── */
.stat-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--bs-card-bg, #fff);
  border: 1px solid var(--bs-border-color, #e5e7eb);
  border-radius: 12px; padding: 16px 18px;
}
.stat-card--accent { border-top: 3px solid var(--bs-primary, #0d6efd); }
.stat-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon--blue   { background: rgba(13,110,253,0.1);  color: #0d6efd; }
.stat-icon--green  { background: rgba(55,135,45,0.1);   color: #37872d; }
.stat-icon--orange { background: rgba(245,139,6,0.1);   color: #f58b06; }
.stat-icon--purple { background: rgba(111,66,193,0.1);  color: #6f42c1; }
.stat-val   { font-size: 1.4rem; font-weight: 800; line-height: 1; }
.stat-label { font-size: 0.72rem; color: var(--bs-secondary-color, #6c757d); margin-top: 2px; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.act-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 600; padding: 6px 12px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; transition: opacity 0.15s; }
.act-btn:hover { opacity: 0.8; }
.act-btn--ghost  { background: var(--bs-tertiary-bg, #f8f9fa); border-color: var(--bs-border-color, #dee2e6); color: var(--bs-body-color); }
.act-btn--danger { background: rgba(232,64,64,0.08); border-color: rgba(232,64,64,0.25); color: #e84040; }

/* ── User tabs ──────────────────────────────────────────────────────────── */
.user-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 12px; }
.user-tab { display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; font-weight: 500; padding: 5px 12px; border-radius: 20px; border: 1px solid transparent; background: none; cursor: pointer; color: var(--bs-secondary-color, #6c757d); transition: all 0.15s; }
.user-tab:hover { background: var(--bs-tertiary-bg, #f8f9fa); }
.user-tab--active { background: var(--bs-primary, #0d6efd); color: #fff; font-weight: 600; }
.user-tab-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 10px; font-size: 0.65rem; font-weight: 700; background: rgba(255,255,255,0.25); }
.user-tab:not(.user-tab--active) .user-tab-count { background: var(--bs-tertiary-bg, #e9ecef); color: var(--bs-body-color); }

/* ── User hero ──────────────────────────────────────────────────────────── */
.user-hero {
  display: flex; align-items: center; gap: 16px;
  background: var(--bs-card-bg, #fff);
  border: 1px solid var(--bs-border-color, #e5e7eb);
  border-radius: 14px; padding: 18px 22px;
}
.user-hero-avatar {
  width: 54px; height: 54px; border-radius: 50%;
  background: var(--bs-primary, #0d6efd); color: #fff;
  font-size: 1.3rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.user-hero-info { flex: 1; min-width: 0; }
.user-hero-name { font-size: 1rem; font-weight: 700; }
.user-hero-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; font-size: 0.72rem; color: var(--bs-secondary-color, #6c757d); }
.user-hero-meta span { display: flex; align-items: center; gap: 4px; }
.user-hero-status { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; }
.status--online .status-dot { background: #37872d; box-shadow: 0 0 0 3px rgba(55,135,45,0.2); animation: pulse 1.5s ease-in-out infinite; }
.status--online  { color: #37872d; }
.status--offline .status-dot { background: #9ca3af; }
.status--offline { color: #9ca3af; }

/* ── Detail panels ──────────────────────────────────────────────────────── */
.detail-panel {
  background: var(--bs-card-bg, #fff);
  border: 1px solid var(--bs-border-color, #e5e7eb);
  border-radius: 12px; padding: 16px; height: 100%;
}
.panel-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--bs-secondary-color, #6c757d); margin-bottom: 12px;
}
.panel-empty { font-size: 0.75rem; color: var(--bs-secondary-color); font-style: italic; }

/* IP list */
.ip-list { display: flex; flex-direction: column; gap: 10px; }
.ip-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px; background: var(--bs-tertiary-bg, #f8f9fa); border-radius: 8px; }
.ip-flag { color: var(--bs-secondary-color); margin-top: 2px; }
.ip-info { flex: 1; min-width: 0; }
.ip-addr { font-size: 0.72rem; color: #0d6efd; word-break: break-all; }
.ip-loc  { font-size: 0.72rem; font-weight: 600; margin-top: 2px; }
.ip-coords { font-size: 0.68rem; color: var(--bs-secondary-color); }
.ip-count { font-size: 0.72rem; font-weight: 700; color: var(--bs-secondary-color); white-space: nowrap; }

/* Page breakdown */
.page-list { display: flex; flex-direction: column; gap: 8px; }
.page-row { display: flex; flex-direction: column; gap: 3px; }
.page-path { font-size: 0.75rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.page-bar-wrap { display: flex; align-items: center; gap: 8px; }
.page-bar { flex: 1; height: 5px; background: var(--bs-tertiary-bg, #e9ecef); border-radius: 3px; }
.page-bar-fill { height: 100%; background: var(--bs-primary, #0d6efd); border-radius: 3px; min-width: 3px; transition: width 0.4s; }
.page-count { font-size: 0.68rem; font-weight: 700; color: var(--bs-secondary-color); min-width: 20px; }
.page-time  { font-size: 0.68rem; color: var(--bs-secondary-color); }

/* Top clicks */
.click-list { display: flex; flex-direction: column; gap: 6px; }
.top-click-row { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; background: var(--bs-tertiary-bg, #f8f9fa); border-radius: 6px; }
.top-click-rank { font-size: 0.68rem; font-weight: 800; color: var(--bs-secondary-color); min-width: 20px; margin-top: 1px; }
.top-click-info { flex: 1; min-width: 0; }
.top-click-el   { font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.top-click-text { font-size: 0.68rem; color: var(--bs-secondary-color); font-style: italic; }
.top-click-count { font-size: 0.72rem; font-weight: 700; color: var(--bs-primary, #0d6efd); white-space: nowrap; }

/* ── Session timeline ───────────────────────────────────────────────────── */
.session-timeline { display: flex; flex-direction: column; }
.stl-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  transition: background 0.15s; gap: 12px;
}
.stl-item:hover { background: var(--bs-tertiary-bg, #f8f9fa); }
.stl-left  { display: flex; align-items: center; gap: 10px; min-width: 0; }
.stl-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; font-size: 0.72rem; color: var(--bs-secondary-color); }
.stl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.stl-dot--done { background: #9ca3af; }
.stl-dot--live { background: #37872d; box-shadow: 0 0 0 3px rgba(55,135,45,0.2); animation: pulse 1.5s ease-in-out infinite; }
.stl-page { font-size: 0.78rem; font-weight: 600; }
.stl-ts   { font-size: 0.68rem; color: var(--bs-secondary-color); }
.stl-dur, .stl-clicks, .stl-mouse { display: flex; align-items: center; gap: 3px; }
.stl-chevron { color: var(--bs-secondary-color); }
.stl-detail { margin: 0 4px 8px; }
.stl-detail-body { background: var(--bs-tertiary-bg, #f8f9fa); border-radius: 10px; padding: 14px; }
.stl-detail-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .stl-detail-grid { grid-template-columns: 1fr; } }
.detail-mini-title { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--bs-secondary-color); margin-bottom: 8px; }

/* ── Session cards (Todos view) ─────────────────────────────────────────── */
.session-card { background: var(--bs-card-bg, #fff); border: 1px solid var(--bs-border-color, #e5e7eb); border-radius: 12px; overflow: hidden; transition: box-shadow 0.2s; }
.session-card--open, .session-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
.session-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; gap: 12px; }
.session-header-left  { display: flex; align-items: center; gap: 10px; min-width: 0; }
.session-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.session-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--bs-primary, #0d6efd); color: #fff; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.session-user { font-size: 0.82rem; font-weight: 600; }
.session-page { font-size: 0.72rem; color: var(--bs-secondary-color, #6c757d); display: flex; align-items: center; gap: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.session-time { font-size: 0.72rem; color: var(--bs-secondary-color); }
.session-dur  { display: flex; align-items: center; gap: 3px; font-size: 0.72rem; color: var(--bs-secondary-color); }
.session-chevron { color: var(--bs-secondary-color); }
.session-body { border-top: 1px solid var(--bs-border-color, #e5e7eb); padding: 14px 16px; display: flex; flex-direction: column; gap: 16px; }

/* ── Shared detail bits ─────────────────────────────────────────────────── */
.detail-section { display: flex; flex-direction: column; gap: 6px; }
.detail-title { display: flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--bs-secondary-color); }
.detail-badge { font-size: 0.65rem; font-weight: 600; text-transform: none; letter-spacing: 0; background: var(--bs-tertiary-bg, #f0f0f0); color: var(--bs-body-color); padding: 1px 7px; border-radius: 10px; margin-left: 4px; }
.detail-empty { font-size: 0.75rem; color: var(--bs-secondary-color); font-style: italic; }
.detail-geo { display: flex; flex-direction: column; gap: 4px; }
.geo-row { display: flex; gap: 10px; font-size: 0.78rem; }
.geo-label { min-width: 90px; color: var(--bs-secondary-color); font-weight: 500; }
.geo-val { font-weight: 600; }
code.geo-val { font-family: monospace; font-size: 0.75rem; color: #0d6efd; }
.timeline { display: flex; flex-direction: column; gap: 6px; }
.tl-item { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; }
.tl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tl-dot--green { background: #37872d; }
.tl-dot--gray  { background: #9ca3af; }
.tl-dot--pulse { background: #0d6efd; box-shadow: 0 0 0 3px rgba(13,110,253,0.25); animation: pulse 1.5s ease-in-out infinite; }
.tl-text { flex: 1; }
.tl-text--live { color: #0d6efd; font-weight: 600; }
.tl-ts { color: var(--bs-secondary-color); font-size: 0.7rem; }
.mouse-trail { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
.mouse-row { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; }
.mouse-t { color: var(--bs-secondary-color); min-width: 32px; }
.mouse-bar { flex: 1; height: 4px; background: var(--bs-tertiary-bg, #e9ecef); border-radius: 2px; max-width: 80px; }
.mouse-bar-fill { height: 100%; background: #0d6efd; border-radius: 2px; min-width: 2px; }
.mouse-pos { min-width: 72px; color: var(--bs-secondary-color); }
.mouse-el  { font-size: 0.68rem; color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.clicks-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
.click-row { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; padding: 3px 6px; border-radius: 4px; background: var(--bs-tertiary-bg, #f8f9fa); }
.click-t    { color: var(--bs-secondary-color); min-width: 32px; }
.click-pos  { min-width: 72px; color: var(--bs-secondary-color); }
.click-el   { flex: 1; color: #374151; font-size: 0.68rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.click-text { font-style: italic; color: var(--bs-secondary-color); font-size: 0.68rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 60px 0; color: var(--bs-secondary-color); text-align: center; }
.empty-icon { opacity: 0.3; }

@keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px rgba(13,110,253,0.25); } 50% { box-shadow: 0 0 0 6px rgba(13,110,253,0.1); } }
</style>
