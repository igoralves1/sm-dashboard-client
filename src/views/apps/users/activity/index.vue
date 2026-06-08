<template>
  <MainLayout>
    <BContainer fluid class="py-3">

      <!-- Page header -->
      <BRow class="mb-3 align-items-center">
        <BCol>
          <h4 class="mb-0 fw-semibold">Atividade de Usuários</h4>
          <p class="text-muted fs-xs mb-0">
            Sessões, páginas visitadas, cliques e localização em tempo real.
          </p>
        </BCol>
        <BCol xs="auto" class="d-flex gap-2">
          <button class="act-btn act-btn--ghost" @click="refresh">
            <Icon icon="tabler:refresh" width="15" /> Atualizar
          </button>
          <button class="act-btn act-btn--danger" @click="clearAll">
            <Icon icon="tabler:trash" width="15" /> Limpar dados
          </button>
        </BCol>
      </BRow>

      <!-- Summary stat cards -->
      <BRow class="g-3 mb-3">
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--blue"><Icon icon="tabler:users" width="20" /></div>
            <div>
              <div class="stat-val">{{ uniqueUsers.length }}</div>
              <div class="stat-label">Usuários distintos</div>
            </div>
          </div>
        </BCol>
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--green"><Icon icon="tabler:file-analytics" width="20" /></div>
            <div>
              <div class="stat-val">{{ sessions.length }}</div>
              <div class="stat-label">Total de sessões</div>
            </div>
          </div>
        </BCol>
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--orange"><Icon icon="tabler:pointer" width="20" /></div>
            <div>
              <div class="stat-val">{{ totalClicks }}</div>
              <div class="stat-label">Cliques registrados</div>
            </div>
          </div>
        </BCol>
        <BCol sm="6" xl="3">
          <div class="stat-card">
            <div class="stat-icon stat-icon--purple"><Icon icon="tabler:clock" width="20" /></div>
            <div>
              <div class="stat-val">{{ avgDuration }}s</div>
              <div class="stat-label">Tempo médio por página</div>
            </div>
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

      <!-- Sessions list -->
      <BRow class="g-3">
        <BCol
          v-for="s in filteredSessions"
          :key="s.id"
          xl="6"
        >
          <div class="session-card" :class="{ 'session-card--open': expandedId === s.id }">

            <!-- Session header -->
            <div class="session-header" @click="toggle(s.id)">
              <div class="session-header-left">
                <div class="session-avatar">{{ avatarLetter(s.user) }}</div>
                <div>
                  <div class="session-user">{{ s.user }}</div>
                  <div class="session-page">
                    <Icon icon="tabler:arrow-right" width="11" />
                    {{ s.page }}
                  </div>
                </div>
              </div>
              <div class="session-header-right">
                <div class="session-time">{{ fmtTime(s.enteredAt) }}</div>
                <div class="session-dur">
                  <Icon icon="tabler:clock" width="11" />
                  {{ s.duration ?? '—' }}s
                </div>
                <Icon
                  :icon="expandedId === s.id ? 'tabler:chevron-up' : 'tabler:chevron-down'"
                  width="16"
                  class="session-chevron"
                />
              </div>
            </div>

            <!-- Expanded detail -->
            <div v-if="expandedId === s.id" class="session-body">

              <!-- Geo + IP -->
              <div class="detail-section">
                <div class="detail-title">
                  <Icon icon="tabler:map-pin" width="13" /> Localização & IP
                </div>
                <div v-if="s.geo" class="detail-geo">
                  <div class="geo-row">
                    <span class="geo-label">IP</span>
                    <code class="geo-val">{{ s.geo.ip }}</code>
                  </div>
                  <div class="geo-row">
                    <span class="geo-label">Cidade</span>
                    <span class="geo-val">{{ s.geo.city }}, {{ s.geo.region }}</span>
                  </div>
                  <div class="geo-row">
                    <span class="geo-label">País</span>
                    <span class="geo-val">{{ s.geo.country }}</span>
                  </div>
                  <div class="geo-row">
                    <span class="geo-label">Coordenadas</span>
                    <span class="geo-val">{{ s.geo.lat.toFixed(4) }}, {{ s.geo.lng.toFixed(4) }}</span>
                  </div>
                </div>
                <div v-else class="detail-empty">Localização não disponível</div>
              </div>

              <!-- Timeline -->
              <div class="detail-section">
                <div class="detail-title">
                  <Icon icon="tabler:timeline" width="13" /> Linha do tempo
                </div>
                <div class="timeline">
                  <div class="tl-item tl-item--entry">
                    <span class="tl-dot tl-dot--green"></span>
                    <span class="tl-text">Entrou na página</span>
                    <span class="tl-ts">{{ fmtFull(s.enteredAt) }}</span>
                  </div>
                  <div v-if="s.exitedAt" class="tl-item tl-item--exit">
                    <span class="tl-dot tl-dot--gray"></span>
                    <span class="tl-text">Saiu da página</span>
                    <span class="tl-ts">{{ fmtFull(s.exitedAt) }} · {{ s.duration }}s</span>
                  </div>
                  <div v-else class="tl-item">
                    <span class="tl-dot tl-dot--pulse"></span>
                    <span class="tl-text tl-text--live">Em sessão agora</span>
                  </div>
                </div>
              </div>

              <!-- Mouse trail -->
              <div class="detail-section">
                <div class="detail-title">
                  <Icon icon="tabler:brand-mouse" width="13" /> Rastro do mouse
                  <span class="detail-badge">{{ s.mouseTrails.length }} amostras · cada 10s</span>
                </div>
                <div v-if="s.mouseTrails.length" class="mouse-trail">
                  <div v-for="(m, i) in s.mouseTrails" :key="i" class="mouse-row">
                    <span class="mouse-t">+{{ m.t }}s</span>
                    <div class="mouse-bar">
                      <div class="mouse-bar-fill" :style="{ width: m.pct_x + '%' }"></div>
                    </div>
                    <span class="mouse-pos">{{ m.x }}, {{ m.y }}px</span>
                    <span class="mouse-el">{{ m.element }}</span>
                  </div>
                </div>
                <div v-else class="detail-empty">Nenhum dado de mouse registrado</div>
              </div>

              <!-- Clicks -->
              <div class="detail-section">
                <div class="detail-title">
                  <Icon icon="tabler:pointer" width="13" /> Cliques
                  <span class="detail-badge">{{ s.clicks.length }}</span>
                </div>
                <div v-if="s.clicks.length" class="clicks-list">
                  <div v-for="(c, i) in s.clicks" :key="i" class="click-row">
                    <span class="click-t">+{{ c.t }}s</span>
                    <span class="click-pos">{{ c.x }}, {{ c.y }}</span>
                    <span class="click-el">{{ c.element }}</span>
                    <span v-if="c.text" class="click-text">"{{ c.text }}"</span>
                  </div>
                </div>
                <div v-else class="detail-empty">Nenhum clique registrado nesta sessão</div>
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

    </BContainer>
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { BCard, BCol, BContainer, BRow } from 'bootstrap-vue-next'
import { Icon } from '@iconify/vue'
import MainLayout from '@/layouts/MainLayout.vue'
import { useSessionTracker } from '@/composables/useSessionTracker'

const { getSessions, clear } = useSessionTracker()

const sessions     = ref(getSessions())
const expandedId   = ref<string | null>(null)
const selectedUser = ref('Todos')

function refresh() { sessions.value = getSessions() }

function clearAll() {
  if (confirm('Apagar todos os dados de atividade?')) {
    clear()
    sessions.value = []
  }
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
  selectedUser.value === 'Todos'
    ? sessions.value
    : sessionsByUser(selectedUser.value)
)

const totalClicks = computed(() =>
  sessions.value.reduce((acc, s) => acc + s.clicks.length, 0)
)

const avgDuration = computed(() => {
  const withDur = sessions.value.filter(s => s.duration != null)
  if (!withDur.length) return 0
  return Math.round(withDur.reduce((a, s) => a + (s.duration ?? 0), 0) / withDur.length)
})

function avatarLetter(user: string) {
  return user === 'anonymous' ? '?' : user[0].toUpperCase()
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diff < 1)  return 'agora'
  if (diff < 60) return `${diff}min atrás`
  const h = Math.floor(diff / 60)
  if (h < 24)   return `${h}h atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
</script>

<style scoped>
/* ── Stat cards ─────────────────────────────────────────────────────────── */
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bs-card-bg, #fff);
  border: 1px solid var(--bs-border-color, #e5e7eb);
  border-radius: 12px;
  padding: 16px 18px;
}
.stat-icon {
  width: 42px; height: 42px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.stat-icon--blue   { background: rgba(13,110,253,0.1);  color: #0d6efd; }
.stat-icon--green  { background: rgba(55,135,45,0.1);   color: #37872d; }
.stat-icon--orange { background: rgba(245,139,6,0.1);   color: #f58b06; }
.stat-icon--purple { background: rgba(111,66,193,0.1);  color: #6f42c1; }
.stat-val   { font-size: 1.4rem; font-weight: 800; line-height: 1; }
.stat-label { font-size: 0.72rem; color: var(--bs-secondary-color, #6c757d); margin-top: 2px; }

/* ── Action buttons ─────────────────────────────────────────────────────── */
.act-btn {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.78rem; font-weight: 600;
  padding: 6px 12px; border-radius: 8px; border: 1px solid transparent; cursor: pointer;
  transition: opacity 0.15s;
}
.act-btn:hover { opacity: 0.8; }
.act-btn--ghost  { background: var(--bs-tertiary-bg, #f8f9fa); border-color: var(--bs-border-color, #dee2e6); color: var(--bs-body-color); }
.act-btn--danger { background: rgba(232,64,64,0.08); border-color: rgba(232,64,64,0.25); color: #e84040; }

/* ── User tabs ──────────────────────────────────────────────────────────── */
.user-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bs-border-color, #e5e7eb);
}
.user-tab {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.75rem; font-weight: 500;
  padding: 5px 12px; border-radius: 20px;
  border: 1px solid transparent;
  background: none; cursor: pointer;
  color: var(--bs-secondary-color, #6c757d);
  transition: all 0.15s;
}
.user-tab:hover { background: var(--bs-tertiary-bg, #f8f9fa); }
.user-tab--active {
  background: var(--bs-primary, #0d6efd);
  color: #fff; font-weight: 600;
}
.user-tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 10px; font-size: 0.65rem; font-weight: 700;
  background: rgba(255,255,255,0.25);
}
.user-tab:not(.user-tab--active) .user-tab-count {
  background: var(--bs-tertiary-bg, #e9ecef);
  color: var(--bs-body-color);
}

/* ── Session card ───────────────────────────────────────────────────────── */
.session-card {
  background: var(--bs-card-bg, #fff);
  border: 1px solid var(--bs-border-color, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.session-card--open,
.session-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }

.session-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  gap: 12px;
}
.session-header-left  { display: flex; align-items: center; gap: 10px; min-width: 0; }
.session-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.session-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--bs-primary, #0d6efd);
  color: #fff; font-weight: 800; font-size: 0.8rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.session-user { font-size: 0.82rem; font-weight: 600; }
.session-page {
  font-size: 0.72rem; color: var(--bs-secondary-color, #6c757d);
  display: flex; align-items: center; gap: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 180px;
}
.session-time { font-size: 0.72rem; color: var(--bs-secondary-color, #6c757d); }
.session-dur  { display: flex; align-items: center; gap: 3px; font-size: 0.72rem; color: var(--bs-secondary-color, #6c757d); }
.session-chevron { color: var(--bs-secondary-color, #6c757d); transition: transform 0.2s; }

/* ── Expanded body ──────────────────────────────────────────────────────── */
.session-body {
  border-top: 1px solid var(--bs-border-color, #e5e7eb);
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 16px;
}

.detail-section { display: flex; flex-direction: column; gap: 6px; }
.detail-title {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--bs-secondary-color, #6c757d);
}
.detail-badge {
  font-size: 0.65rem; font-weight: 600; text-transform: none; letter-spacing: 0;
  background: var(--bs-tertiary-bg, #f0f0f0);
  color: var(--bs-body-color);
  padding: 1px 7px; border-radius: 10px; margin-left: 4px;
}
.detail-empty { font-size: 0.75rem; color: var(--bs-secondary-color, #6c757d); font-style: italic; }

/* Geo */
.detail-geo { display: flex; flex-direction: column; gap: 4px; }
.geo-row { display: flex; gap: 10px; font-size: 0.78rem; }
.geo-label { min-width: 90px; color: var(--bs-secondary-color, #6c757d); font-weight: 500; }
.geo-val { font-weight: 600; }
code.geo-val { font-family: monospace; font-size: 0.75rem; color: #0d6efd; }

/* Timeline */
.timeline { display: flex; flex-direction: column; gap: 6px; }
.tl-item {
  display: flex; align-items: center; gap: 8px; font-size: 0.78rem;
}
.tl-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.tl-dot--green { background: #37872d; }
.tl-dot--gray  { background: #9ca3af; }
.tl-dot--pulse {
  background: #0d6efd;
  box-shadow: 0 0 0 3px rgba(13,110,253,0.25);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px rgba(13,110,253,0.25); } 50% { box-shadow: 0 0 0 6px rgba(13,110,253,0.1); } }
.tl-text { flex: 1; }
.tl-text--live { color: #0d6efd; font-weight: 600; }
.tl-ts { color: var(--bs-secondary-color, #6c757d); font-size: 0.7rem; }

/* Mouse trail */
.mouse-trail { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
.mouse-row {
  display: flex; align-items: center; gap: 8px; font-size: 0.72rem;
}
.mouse-t { color: var(--bs-secondary-color, #6c757d); min-width: 32px; }
.mouse-bar {
  flex: 1; height: 4px; background: var(--bs-tertiary-bg, #e9ecef); border-radius: 2px; max-width: 80px;
}
.mouse-bar-fill { height: 100%; background: #0d6efd; border-radius: 2px; min-width: 2px; }
.mouse-pos { min-width: 72px; color: var(--bs-secondary-color); }
.mouse-el  { font-size: 0.68rem; color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }

/* Clicks */
.clicks-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
.click-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.72rem; padding: 3px 6px;
  border-radius: 4px; background: var(--bs-tertiary-bg, #f8f9fa);
}
.click-t    { color: var(--bs-secondary-color); min-width: 32px; }
.click-pos  { min-width: 72px; color: var(--bs-secondary-color); }
.click-el   { flex: 1; color: #374151; font-size: 0.68rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.click-text { font-style: italic; color: var(--bs-secondary-color); font-size: 0.68rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Empty state */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 60px 0; color: var(--bs-secondary-color, #6c757d); text-align: center;
}
.empty-icon { opacity: 0.3; }
</style>
