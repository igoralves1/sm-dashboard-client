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
        <h4 class="mb-0 fw-semibold">{{ t('energisa.title') }}</h4>
        <span class="text-muted" style="font-size: 12px">
          {{ t('energisa.subtitle') }} · {{ devices.length }} {{ t('energisa.devices') }}
        </span>
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

    <!-- Device grid -->
    <template v-else>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import MainLayout from '@/layouts/MainLayout.vue'
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
</style>
