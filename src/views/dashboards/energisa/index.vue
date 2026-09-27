<template>
  <MainLayout>
    <BContainer fluid class="energisa-page">
    <!-- Header -->
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <RouterLink to="/dashboard" class="crumb-home">
            <Icon icon="tabler:home" width="15" height="15" />
            <span>{{ t('energisa.breadcrumb_home') }}</span>
          </RouterLink>
          <span class="text-muted" style="font-size: 12px">/</span>
          <span class="text-muted" style="font-size: 12px">{{ t('energisa.title') }}</span>
        </div>
        <div class="page-kicker">{{ t('energisa.page_kicker') }}</div>
        <h4 class="page-heading mb-1">{{ t('energisa.page_title') }}</h4>
        <p class="page-intro mb-2">{{ t('energisa.page_intro') }}</p>

        <details class="about">
          <summary>{{ t('energisa.about_toggle') }}</summary>

          <p class="about__lead">{{ t('energisa.about_lead') }}</p>

          <div class="about__pillars">
            <div v-for="p in PILLARS" :key="p.key" class="pillar">
              <div class="pillar__head">
                <Icon :icon="p.icon" width="15" height="15" />
                <span>{{ t(`energisa.pillar_${p.key}_name`) }}</span>
              </div>
              <p class="pillar__text">{{ t(`energisa.pillar_${p.key}_text`) }}</p>
            </div>
          </div>

          <div class="about__label">{{ t('energisa.about_sources') }}</div>
          <ul class="about__sources">
            <li v-for="src in INDUSTRY5_SOURCES" :key="src.url">
              <a :href="src.url" target="_blank" rel="noopener noreferrer">
                {{ src.name }}
                <Icon icon="tabler:external-link" width="10" height="10" />
              </a>
              <span class="about__pub">{{ src.publisher }}, {{ src.year }}</span>
            </li>
          </ul>
        </details>
      </div>

      <div class="d-flex align-items-center gap-2">
        <select v-model="category" class="form-select form-select-sm" style="width: auto">
          <option value="">{{ t('energisa.category_all') }}</option>
          <option v-for="opt in THING_TYPES" :key="opt.type" :value="opt.type">
            {{ t(opt.label) }}
          </option>
        </select>

        <select v-model="groupBy" class="form-select form-select-sm" style="width: auto">
          <option value="">{{ t('energisa.group_none') }}</option>
          <option value="place">{{ t('energisa.group_place') }}</option>
          <option value="subPlace">{{ t('energisa.group_subplace') }}</option>
        </select>

        <div class="btn-group btn-group-sm" role="group" :aria-label="t('energisa.change_view')">
          <button
            type="button"
            class="btn"
            :class="view === 'list' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="view = 'list'"
          >
            {{ t('energisa.view_list') }}
          </button>
          <button
            type="button"
            class="btn"
            :class="view === 'grid' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="view = 'grid'"
          >
            {{ t('energisa.view_grid') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Not configured -->
    <div v-if="!configured" class="alert alert-warning">
      <strong>{{ t('energisa.not_configured') }}</strong>
      {{ t('energisa.missing_in_env') }}: {{ missingConfig.join(', ') }}
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Loading -->
    <div v-else-if="loading" class="row g-3">
      <div v-for="n in 6" :key="n" class="col-12 col-md-6 col-xl-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="placeholder-glow">
              <span class="placeholder col-7 mb-2"></span>
              <span class="placeholder col-4"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Authenticated, but this account has no organization -->
    <div v-else-if="emptyTenant" class="alert alert-info">
      <strong>{{ t('energisa.no_devices') }}</strong>
      {{ t('energisa.no_devices_hint') }}
    </div>

      <!-- Fleet overview -->
      <div v-else-if="fleet.total" class="fleet mb-3">
        <div class="fleet__group">
          <div class="fleet__stat sev-good">
            <span class="fleet__count">{{ fleet.normal }}</span>
            <span class="fleet__label">{{ t('energisa.sum_normal') }}</span>
          </div>
          <div class="fleet__stat sev-warning">
            <span class="fleet__count">{{ fleet.attention }}</span>
            <span class="fleet__label">{{ t('energisa.sum_attention') }}</span>
          </div>
          <div class="fleet__stat sev-critical">
            <span class="fleet__count">{{ fleet.critical }}</span>
            <span class="fleet__label">{{ t('energisa.sum_critical') }}</span>
          </div>
        </div>

        <div class="fleet__divider" aria-hidden="true"></div>

        <div class="fleet__group">
          <div class="fleet__stat sev-online">
            <span class="fleet__count">{{ fleet.online }}</span>
            <span class="fleet__label">{{ t('energisa.sum_online') }}</span>
          </div>
          <div class="fleet__stat sev-unknown">
            <span class="fleet__count">{{ fleet.offline }}</span>
            <span class="fleet__label">{{ t('energisa.sum_offline') }}</span>
          </div>
          <div class="fleet__stat sev-muted">
            <span class="fleet__count">{{ fleet.total }}</span>
            <span class="fleet__label">{{ t('energisa.sum_total') }}</span>
          </div>
        </div>
      </div>

    <!-- Device grid -->
    <template v-if="!loading && !error && configured && !emptyTenant">
      <div v-for="group in groups" :key="group.label" class="mb-4">
        <h6 v-if="group.label" class="text-muted text-uppercase mb-2" style="font-size: 11px; letter-spacing: 0.06em">
          {{ group.label }}
        </h6>

        <div class="row g-3">
          <div
            v-for="device in group.devices"
            :key="device.id"
            :class="view === 'grid' ? 'col-12 col-md-6 col-xl-4' : 'col-12'"
          >
            <EnergyDeviceCard
              :device="device"
              :summary="summarize(device)"
              :diagnostics="health.get(device.id) ?? null"
              :last-seen="lastSeen(device)"
              @open="openDevice(device)"
            />
          </div>
        </div>
      </div>
      </template>
    </BContainer>
  </MainLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import MainLayout from '@/layouts/MainLayout.vue'
import { analyse } from '@/utils/energy/diagnostics'
import { INDUSTRY5_SOURCES } from '@/utils/energy/references'
import { useI18n } from 'vue-i18n'
import EnergyDeviceCard from '@/components/charts/EnergyDeviceCard.vue'
import { useEnergisaDevices } from '@/composables/useEnergisaDevices'
import type { EnergisaDevice } from '@/services/energisa/types'

const { t } = useI18n()
const router = useRouter()
const { devices, loading, error, emptyTenant, configured, missingConfig, load, summarize } =
  useEnergisaDevices()

/** Categories are thing types, matching thingTypeOptions in the production UI. */
const THING_TYPES = [
  { type: 'ENERGY', label: 'energisa.type_energy' },
  { type: 'TRAFO', label: 'energisa.type_trafo' },
  { type: 'AC_UNITY', label: 'energisa.type_ac' },
  { type: 'WATER_VALVE', label: 'energisa.type_valve' },
] as const

/** The three pillars, in the order the Commission report presents them. */
const PILLARS = [
  { key: 'human', icon: 'tabler:users' },
  { key: 'sustainability', icon: 'tabler:leaf' },
  { key: 'resilience', icon: 'tabler:shield-bolt' },
] as const

const view = ref<'grid' | 'list'>('grid')
const category = ref('')
const groupBy = ref<'' | 'place' | 'subPlace'>('')

const filtered = computed(() =>
  category.value ? devices.value.filter((d) => d.thingType === category.value) : devices.value,
)

/** One unlabelled group when grouping is off, so the template stays uniform. */
const groups = computed(() => {
  if (!groupBy.value) return [{ label: '', devices: filtered.value }]

  const buckets = new Map<string, EnergisaDevice[]>()
  for (const device of filtered.value) {
    const key =
      (groupBy.value === 'place' ? device.place : device.subPlace) ??
      t(groupBy.value === 'place' ? 'energisa.no_place' : 'energisa.no_subplace')
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(device)
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, list]) => ({ label, devices: list }))
})

/**
 * Fleet roll-up. A device counts as needing attention when any indicator
 * reaches warning or critical — the same judgement the detail page makes, so
 * the two never disagree.
 */
/** Health severity per device, keyed by id — shared by the strip and the cards. */
const health = computed(() => {
  const map = new Map<string, ReturnType<typeof analyse> | null>()
  for (const d of devices.value) {
    map.set(
      d.id,
      d.online
        ? analyse({ channels: d.channels, ratings: d.ratings, temperature: d.temperature ?? null })
        : null,
    )
  }
  return map
})

const fleet = computed(() => {
  const list = devices.value
  const online = list.filter((d) => d.online)
  const severities = online.map((d) => health.value.get(d.id)?.healthSeverity)

  return {
    total: list.length,
    online: online.length,
    offline: list.length - online.length,
    normal: severities.filter((s) => s === 'good').length,
    attention: severities.filter((s) => s === 'warning' || s === 'watch').length,
    critical: severities.filter((s) => s === 'critical').length,
  }
})

/** Relative time since the last MQTT frame. */
function lastSeen(device: EnergisaDevice): string {
  if (!device.lastSeen) return t('energisa.never_seen')

  const seconds = Math.max(0, (now.value - device.lastSeen) / 1000)
  if (seconds < 60) return t('energisa.ago_now')

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('energisa.ago_min', { n: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('energisa.ago_hour', { n: hours })

  return t('energisa.ago_day', { n: Math.floor(hours / 24) })
}

// Ticks so the relative timestamps stay honest without a reload.
const now = ref(Date.now())
const clock = window.setInterval(() => (now.value = Date.now()), 30_000)
onUnmounted(() => window.clearInterval(clock))

function openDevice(device: EnergisaDevice) {
  router.push(`/dashboard-energisa/${device.id}`)
}

onMounted(load)
</script>

<style scoped>
.energisa-page {
  padding-top: 1rem;
  padding-bottom: 2rem;
}

.crumb-home {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 12px;
  color: var(--bs-secondary-color);
  text-decoration: none;
}

.crumb-home:hover { color: var(--bs-primary); }

.page-kicker {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--bs-primary);
}

.page-heading {
  font-size: clamp(1.3rem, 1.1rem + 0.8vw, 1.7rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.page-intro {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--bs-secondary-color);
  max-width: 72ch;
}

.about { margin-top: 0.15rem; max-width: 80ch; }

.about summary {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--bs-primary);
  cursor: pointer;
}

.about[open] summary { margin-bottom: 0.6rem; }

.about__lead {
  margin: 0 0 0.75rem;
  font-size: 12px;
  line-height: 1.6;
  color: var(--bs-secondary-color);
}

.about__pillars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.pillar {
  border-left: 2px solid var(--bs-primary);
  padding-left: 0.6rem;
}

.pillar__head {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--bs-body-color);
  margin-bottom: 0.2rem;
}

.pillar__text {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--bs-secondary-color);
}

.about__label {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bs-secondary-color);
  margin-bottom: 0.25rem;
}

.about__sources { list-style: none; margin: 0; padding: 0; }

.about__sources li {
  font-size: 11px;
  line-height: 1.5;
  margin-bottom: 0.3rem;
}

.about__sources a {
  color: var(--bs-body-color);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.about__sources a:hover { color: var(--bs-primary); text-decoration: underline; }

.about__pub { display: block; font-size: 10px; color: var(--bs-secondary-color); }

.fleet {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding: 0.85rem 1.1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 8px;
  background: var(--bs-body-bg);
}

.fleet__group { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }

.fleet__divider {
  width: 1px;
  align-self: stretch;
  min-height: 28px;
  background: var(--bs-border-color);
}

.fleet__stat { display: flex; align-items: baseline; gap: 0.4rem; }

.fleet__count {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: currentColor;
  line-height: 1;
}

.fleet__label { font-size: 11.5px; color: var(--bs-secondary-color); }

.sev-good { color: var(--bs-success); }
.sev-warning { color: var(--bs-warning); }
.sev-critical { color: var(--bs-danger); }
.sev-online { color: var(--bs-success); }
.sev-unknown { color: var(--bs-secondary-color); }
.sev-muted { color: var(--bs-body-color); }

@media (max-width: 640px) {
  .fleet__divider { display: none; }
  .fleet__group { gap: 1.1rem; }
}
</style>
