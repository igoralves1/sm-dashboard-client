<template>
  <div ref="mapRef" class="site-map"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons broken by Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

const props = defineProps<{
  markers?: { lat: number; lng: number; label: string; color?: string }[]
}>()

const mapRef = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null

onMounted(() => {
  if (!mapRef.value) return

  map = L.map(mapRef.value, { zoomControl: true, attributionControl: true })
    .setView([-11.15430944152578, -48.172973779141344], 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  // Default marker if no custom markers passed
  const markers = props.markers ?? [
    { lat: -11.15430944152578, lng: -48.172973779141344, label: 'RAP01 Silvanópolis' }
  ]

  markers.forEach(m => {
    const icon = m.color ? L.divIcon({
      className: '',
      html: `<div style="
        width:14px;height:14px;border-radius:50%;
        background:${m.color};border:2px solid #fff;
        box-shadow:0 0 6px rgba(0,0,0,0.5)">
      </div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }) : new L.Icon.Default()

    L.marker([m.lat, m.lng], { icon })
      .addTo(map!)
      .bindPopup(`<b>${m.label}</b>`)
  })
})

onUnmounted(() => { map?.remove(); map = null })
</script>

<style scoped>
.site-map {
  width: 100%;
  height: 100%;
  min-height: 220px;
  border-radius: 6px;
  z-index: 0;
}
</style>
