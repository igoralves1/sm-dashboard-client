<template>
  <div class="loc-map">
    <div v-if="!point" class="loc-map__empty">
      <Icon icon="tabler:map-pin-off" width="18" height="18" />
      <span>{{ t('energisa.map_no_location') }}</span>
    </div>

    <template v-else>
      <div ref="previewRef" class="loc-map__canvas" />
      <button type="button" class="loc-map__expand" :title="t('energisa.map_expand')" @click="expanded = true">
        <Icon icon="tabler:arrows-maximize" width="14" height="14" />
      </button>
    </template>

    <!-- Expanded, interactive view -->
    <Teleport to="body">
      <div v-if="expanded" class="loc-modal" role="dialog" @click.self="expanded = false">
        <div class="loc-modal__box">
          <header class="loc-modal__head">
            <div>
              <div class="loc-modal__title">{{ title }}</div>
              <div class="loc-modal__coords">{{ coordsLabel }}</div>
            </div>
            <button type="button" class="loc-modal__close" :aria-label="t('energisa.cancel')" @click="expanded = false">
              <Icon icon="tabler:x" width="18" height="18" />
            </button>
          </header>
          <div ref="expandedRef" class="loc-modal__canvas" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * Transformer position on OpenStreetMap.
 *
 * Coordinates arrive on the MQTT telemetry frames themselves — the device
 * reports top-level `latitude` / `longitude` alongside its electrical values —
 * so a unit without GPS simply never shows a map.
 *
 * The inline map is deliberately inert: every interaction is disabled so it
 * reads as a thumbnail and never swallows a page scroll. Expanding opens a
 * second, fully interactive map rather than enabling handlers on the first,
 * which is how the production page behaves.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    point?: { latitude: number; longitude: number } | null
    title?: string
    zoom?: number
    /** Condition severity; colours the marker and drives the pulse. */
    health?: string
  }>(),
  { point: null, title: '', zoom: 16, health: 'unknown' },
)

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const previewRef = ref<HTMLElement | null>(null)
const expandedRef = ref<HTMLElement | null>(null)
const expanded = ref(false)

let preview: L.Map | null = null
let previewMarker: L.CircleMarker | null = null
let full: L.Map | null = null

const coordsLabel = computed(() =>
  props.point ? `${props.point.latitude.toFixed(6)}, ${props.point.longitude.toFixed(6)}` : '',
)

function build(container: HTMLElement, interactive: boolean) {
  const { latitude, longitude } = props.point!
  const coords = L.latLng(latitude, longitude)

  const map = L.map(container, {
    boxZoom: interactive,
    doubleClickZoom: interactive,
    dragging: interactive,
    keyboard: false,
    scrollWheelZoom: interactive,
    touchZoom: interactive,
    zoomControl: interactive,
    attributionControl: true,
  }).setView(coords, props.zoom)

  L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map)

  // Colour and animation come from CSS rather than Leaflet options, so the
  // marker can use the same theme tokens as the rest of the dashboard and
  // follow a light/dark switch without being redrawn.
  const marker = L.circleMarker(coords, {
    radius: 7,
    weight: 2,
    fillOpacity: 1,
    className: `loc-marker loc-marker--${props.health}`,
  }).addTo(map)

  return { map, marker }
}

async function mountPreview() {
  if (!props.point) return
  await nextTick()
  if (!previewRef.value || preview) return

  const built = build(previewRef.value, false)
  preview = built.map
  previewMarker = built.marker

  // Leaflet measures its container on creation; inside a card that is still
  // settling it can size to zero and render grey.
  requestAnimationFrame(() => preview?.invalidateSize())
}

watch(
  () => props.point,
  async (point) => {
    if (!point) {
      preview?.remove()
      preview = null
      previewMarker = null
      return
    }

    if (!preview) {
      await mountPreview()
      return
    }

    // Move rather than rebuild, so the tiles don't flash on every frame.
    const coords = L.latLng(point.latitude, point.longitude)
    previewMarker?.setLatLng(coords)
    preview.setView(coords, preview.getZoom())
  },
  { immediate: true, deep: true },
)

watch(expanded, async (open) => {
  if (!open) {
    full?.remove()
    full = null
    return
  }

  await nextTick()
  if (expandedRef.value) {
    full = build(expandedRef.value, true).map
    requestAnimationFrame(() => full?.invalidateSize())
  }
})

watch(
  () => props.health,
  (health) => {
    const className = `loc-marker loc-marker--${health}`
    previewMarker?.setStyle({ className } as L.PathOptions)
    // setStyle does not rewrite the class on an existing path, so set it directly.
    const el = (previewMarker as unknown as { _path?: SVGElement })?._path
    if (el) el.setAttribute('class', className)
  },
)

onBeforeUnmount(() => {
  preview?.remove()
  full?.remove()
})
</script>

<style scoped>
.loc-map {
  position: relative;
  height: 100%;
  min-height: 118px;
  border-radius: 6px;
  overflow: hidden;
}

.loc-map__canvas { width: 100%; height: 100%; min-height: 118px; }

.loc-map__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 100%;
  min-height: 118px;
  font-size: 11px;
  text-align: center;
  color: var(--bs-secondary-color);
  border: 1px dashed var(--bs-border-color);
  border-radius: 6px;
  padding: 0.5rem;
}

.loc-map__expand {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 500;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--bs-border-color);
  border-radius: 5px;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  cursor: pointer;
}

.loc-map__expand:hover { color: var(--bs-primary); border-color: var(--bs-primary); }

/* ---- expanded ---- */
.loc-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 0.45);
  padding: 1rem;
}

.loc-modal__box {
  width: min(860px, 100%);
  background: var(--bs-body-bg);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgb(0 0 0 / 0.3);
}

.loc-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--bs-border-color);
}

.loc-modal__title { font-size: 14px; font-weight: 600; }

.loc-modal__coords {
  font-size: 11.5px;
  color: var(--bs-secondary-color);
  font-variant-numeric: tabular-nums;
}

.loc-modal__close {
  border: none;
  background: none;
  color: var(--bs-secondary-color);
  cursor: pointer;
  padding: 0.2rem;
  line-height: 0;
}

.loc-modal__close:hover { color: var(--bs-body-color); }

.loc-modal__canvas { width: 100%; height: min(60vh, 520px); }
</style>

<style>
/* Marker colour and pulse.
   Unscoped on purpose — the expanded map is teleported to <body>, so a scoped
   selector would style the thumbnail and leave the modal's marker unstyled. */
.loc-marker {
  fill: var(--marker, #6c757d);
  stroke: var(--marker, #6c757d);
  fill-opacity: 1;
  transition: fill 0.3s ease, stroke 0.3s ease;
}

.loc-marker--good     { --marker: var(--bs-success, #198754); }
.loc-marker--watch    { --marker: var(--bs-info, #0dcaf0); }
.loc-marker--warning  { --marker: var(--bs-warning, #ffc107); }
.loc-marker--critical { --marker: var(--bs-danger, #dc3545); }
.loc-marker--unknown  { --marker: var(--bs-secondary-color, #6c757d); }

/* Only units that need attention pulse, and critical pulses faster.
   A permanently blinking map trains the eye to ignore it; motion reserved for
   the exceptions keeps it meaningful. */
@keyframes loc-marker-pulse {
  0%   { stroke-width: 2; stroke-opacity: 1; }
  70%  { stroke-width: 12; stroke-opacity: 0; }
  100% { stroke-width: 2; stroke-opacity: 0; }
}

.loc-marker--warning,
.loc-marker--critical {
  animation: loc-marker-pulse 2s ease-out infinite;
  paint-order: stroke;
}

.loc-marker--critical { animation-duration: 1.1s; }

@media (prefers-reduced-motion: reduce) {
  .loc-marker--warning,
  .loc-marker--critical {
    animation: none;
    stroke-width: 4;
    stroke-opacity: 0.45;
  }
}
</style>
