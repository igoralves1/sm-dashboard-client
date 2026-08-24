/**
 * Device list state: inventory over REST, live metrics over MQTT.
 *
 * The two sources are deliberately independent. The inventory call fills in
 * names and locations immediately; the card metrics stay blank ("- W / - Wh")
 * until MQTT delivers a frame for that device, which is exactly how the
 * production dashboard behaves — offline devices never fill in.
 */

import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { loadDevices } from '@/services/energisa/devices'
import { subscribeDevice, type Subscription } from '@/services/energisa/pubsub'
import { isEnergisaConfigured, missingEnergisaConfig } from '@/services/energisa/config'
import { mergeChannels, parseDeviceMessage } from '@/utils/energy/deviceMessage'
import type { DeviceSummary, EnergisaDevice } from '@/services/energisa/types'

/** A device is considered online while a message arrived within this window. */
const ONLINE_WINDOW_MS = 5 * 60 * 1000

/**
 * Load factor, as the production card computes it (getDeviceFC in
 * DevicesPage.tsx).
 *
 * Total apparent power over the transformer's *nominal* rating — reactive
 * power is reconstructed per channel from the voltage/current phase
 * difference rather than measured directly:
 *
 *   Q = Σ p·tan(θv − θi)      S = √(P² + Q²)      FC = S / nomP · 100
 *
 * Only TRAFO things carry nomP, which is why two of the five production cards
 * show no load factor at all — including the one named "Trafo".
 */
function loadFactorOf(device: EnergisaDevice): number | null {
  const nominal = device.ratings?.nomP
  if (device.thingType !== 'TRAFO' || !nominal || !device.channels.length) return null

  const active = device.channels.reduce((sum, ch) => sum + ch.p, 0)
  const reactive = device.channels.reduce(
    (sum, ch) => sum + ch.p * Math.tan(((ch.v_a - ch.i_a) * Math.PI) / 180),
    0,
  )

  const apparent = Math.hypot(active, reactive)
  if (!Number.isFinite(apparent)) return null

  return (apparent / nominal) * 100
}

export function useEnergisaDevices() {
  const devices = ref<EnergisaDevice[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** True when the API authenticated but returned no devices for this tenant. */
  const emptyTenant = ref(false)

  const subscriptions = shallowRef<Subscription[]>([])
  const configured = isEnergisaConfigured()
  const missingConfig = missingEnergisaConfig()

  const now = ref(Date.now())
  const tick = window.setInterval(() => (now.value = Date.now()), 30_000)

  function applyMessage(deviceId: string, message: any) {
    const device = devices.value.find((d) => d.id === deviceId)
    if (!device) return

    const channels = parseDeviceMessage(message)
    if (!channels.length) return

    device.channels = mergeChannels(device.channels, channels)
    device.lastSeen = Date.now()
    device.online = true

    // `temper` is an array of probe readings, not a scalar. Production takes
    // the hottest one; calling Number() on the array yields NaN, which is why
    // the tile stayed blank.
    const probes = message?.temper
    if (Array.isArray(probes) && probes.length) {
      const values = probes
        .map((t: any) => Number(t?.value))
        .filter((v: number) => Number.isFinite(v))
      if (values.length) device.temperature = Math.max(...values)
    }
  }

  async function subscribeAll() {
    unsubscribeAll()
    const subs: Subscription[] = []

    await Promise.all(
      devices.value
        .filter((d) => d.topic)
        .map(async (device) => {
          try {
            subs.push(
              await subscribeDevice(device.topic, (_topic, message) =>
                applyMessage(device.id, message),
              ),
            )
          } catch {
            // One device failing to subscribe must not take down the rest;
            // it simply stays offline on the grid.
          }
        }),
    )

    subscriptions.value = subs
  }

  function unsubscribeAll() {
    for (const sub of subscriptions.value) {
      try {
        sub.unsubscribe()
      } catch {
        /* already torn down */
      }
    }
    subscriptions.value = []
  }

  async function load() {
    if (!configured) {
      error.value = `Energisa is not configured. Missing: ${missingConfig.join(', ')}`
      return
    }

    loading.value = true
    error.value = null
    emptyTenant.value = false

    try {
      const list = await loadDevices()
      devices.value = list
      emptyTenant.value = list.length === 0

      if (list.length) await subscribeAll()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load devices'
    } finally {
      loading.value = false
    }
  }

  /** Card metrics, recomputed as MQTT frames arrive. */
  function summarize(device: EnergisaDevice): DeviceSummary {
    if (!device.channels.length) {
      return { totalPower: null, consumptionToday: null, loadFactor: null, temperature: device.temperature ?? null }
    }

    const power = device.channels.reduce((sum, ch) => sum + ch.p, 0)
    const energy = device.channels.reduce((sum, ch) => sum + ch.e_d, 0)

    return {
      totalPower: power,
      consumptionToday: energy,
      loadFactor: loadFactorOf(device),
      temperature: device.temperature ?? null,
    }
  }

  /** Recomputed on the interval tick so cards grey out when a device goes quiet. */
  const liveDevices = computed(() =>
    devices.value.map((device) => ({
      ...device,
      online: Boolean(device.lastSeen && now.value - device.lastSeen < ONLINE_WINDOW_MS),
    })),
  )

  onUnmounted(() => {
    window.clearInterval(tick)
    unsubscribeAll()
  })

  return {
    devices: liveDevices,
    loading,
    error,
    emptyTenant,
    configured,
    missingConfig,
    load,
    summarize,
  }
}
