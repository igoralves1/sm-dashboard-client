/**
 * Detail-page state for one device.
 *
 * Two independent data paths, exactly as in the production page:
 *   - "Leituras em tempo real" comes from MQTT and updates continuously.
 *   - "Leituras por intervalo" comes from /consumo/eletrico for the selected
 *     range, and is what every chart plots.
 *
 * All electrical quantities beyond v/i/p are derived — see utils/energy/electrical.ts.
 */

import { computed, onUnmounted, ref } from 'vue'
import { getChartsOfBoard, getWaveform, loadDevices } from '@/services/energisa/devices'
import { subscribeDevice, type Subscription } from '@/services/energisa/pubsub'
import { isEnergisaConfigured } from '@/services/energisa/config'
import { mergeChannels, parseDeviceMessage } from '@/utils/energy/deviceMessage'
import { calculateResumes } from '@/utils/energy/calcs'
import {
  CHART_COLORS,
  calcChannel,
  channelLoadFactor,
  threePhase,
} from '@/utils/energy/electrical'
import type {
  ChannelReading,
  ConsumptionPoint,
  EnergisaDevice,
  WaveformSample,
} from '@/services/energisa/types'

/** The five metric buttons under the Potência tab. */
export type PowerMetric = 'S' | 'P' | 'Q' | 'FP' | 'FC'
/** The three tabs. */
export type ChartTab = 'power' | 'energy' | 'accumulated'

export interface Series {
  key: string
  label: string
  color: string
  points: [number, number][]
}

const CHANNELS = [1, 2, 3] as const

/**
 * Fallback nominal power. The production code falls back to 112500 when a
 * transformer has no nomP configured, so load factors stay plotted rather
 * than collapsing to zero.
 */
const DEFAULT_NOMINAL_POWER = 112_500

export function useEnergisaDevice(deviceId: string) {
  let deviceCode = ''

  const device = ref<EnergisaDevice | null>(null)
  const readings = ref<ConsumptionPoint[]>([])
  const waveform = ref<WaveformSample | null>(null)
  const liveChannels = ref<ChannelReading[]>([])

  const loading = ref(false)
  const loadingWave = ref(false)
  const error = ref<string | null>(null)
  const configured = isEnergisaConfigured()

  const tab = ref<ChartTab>('power')
  const metric = ref<PowerMetric>('S')
  const perPhase = ref(true)
  /** "Detalhado" shows per-channel values in the KPI row; "Agrupado" totals them. */
  const grouped = ref(true)

  const today = new Date()
  const rangeStart = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const rangeEnd = ref(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
  )

  let subscription: Subscription | null = null

  const nominalPower = computed(
    () => device.value?.ratings?.nomP ?? DEFAULT_NOMINAL_POWER,
  )
  const isTrafo = computed(() => device.value?.thingType === 'TRAFO')

  const resumes = computed(() => calculateResumes(readings.value))

  // ── Live KPI row ──────────────────────────────────────────────────────────

  const live = computed(() => {
    const channels = liveChannels.value
    if (!channels.length) {
      return {
        totalPower: null as number | null,
        meanVoltage: null as number | null,
        currents: [] as { channel: number; value: number }[],
        energyToday: null as number | null,
      }
    }

    return {
      totalPower: channels.reduce((sum, c) => sum + c.p, 0),
      meanVoltage: channels.reduce((sum, c) => sum + c.v, 0) / channels.length,
      currents: channels.map((c) => ({ channel: c.channel, value: c.i })),
      energyToday: channels.reduce((sum, c) => sum + c.e_d, 0),
    }
  })

  /**
   * The four "Carregamento" tiles.
   *
   * Total uses apparent power rebuilt from summed P and Q; each phase uses
   * v·i against a third of the nominal rating. Only TRAFO devices show these.
   */
  const loading_ = computed(() => {
    const channels = liveChannels.value
    if (!isTrafo.value || !channels.length) return null

    const derived = channels.map((c) => ({
      p: c.p,
      q: c.p * Math.tan((c.v_a - c.i_a) * (Math.PI / 180)),
    }))

    const total = threePhase(derived, nominalPower.value)
    const third = nominalPower.value / 3

    return {
      total: total.fc,
      phases: channels.map((c) => (third ? ((c.v * c.i) / third) * 100 : 0)),
    }
  })

  // ── Interval series ───────────────────────────────────────────────────────

  /** Augment each raw reading with the derived quantities the charts plot. */
  const enriched = computed(() =>
    (Array.isArray(readings.value) ? readings.value : []).map((point) => {
      const raw = point as unknown as Record<string, number>
      const derived: Record<string, number> = { timestamp: point.timestamp }

      const perCh: { p: number; q: number }[] = []

      for (const ch of CHANNELS) {
        const p = raw[`p_c${ch}`] ?? 0
        const { s, q, fp } = calcChannel({
          p,
          v: raw[`v_c${ch}`] ?? 0,
          i: raw[`i_c${ch}`] ?? 0,
          va: raw[`v_a_c${ch}`] ?? 0,
          ia: raw[`i_a_c${ch}`] ?? 0,
        })

        derived[`P_c${ch}`] = p
        derived[`S_c${ch}`] = s
        derived[`Q_c${ch}`] = q
        derived[`FP_c${ch}`] = fp
        derived[`FC_c${ch}`] = channelLoadFactor(p, q, nominalPower.value)
        derived[`V_c${ch}`] = raw[`v_c${ch}`] ?? 0
        derived[`I_c${ch}`] = raw[`i_c${ch}`] ?? 0
        derived[`KWH_c${ch}`] = raw[`kwh_c${ch}`] ?? 0

        perCh.push({ p, q })
      }

      const trif = threePhase(perCh, nominalPower.value)
      derived.P_trif = trif.p
      derived.Q_trif = trif.q
      derived.S_trif = trif.s
      derived.FP_trif = trif.fp
      derived.FC_trif = trif.fc
      derived.KWH_trif = CHANNELS.reduce((sum, ch) => sum + (raw[`kwh_c${ch}`] ?? 0), 0)

      // Board temperature — one value per reading, whatever the API calls it.
      derived.T = raw.temperature ?? raw.temp ?? raw.t ?? NaN

      return derived
    }),
  )

  /**
   * Readout labels use the series symbol — S1, V1, I1 — not the verbose metric
   * name. That is what `sym: `${prop}${i}`` produces in lineChart.ts and what
   * the production readout column shows; "Aparente CH1" is the *legend* name,
   * used elsewhere.
   */
  function seriesFor(prop: string, colors: readonly string[]): Series[] {
    if (!enriched.value.length) return []

    if (!perPhase.value) {
      return [
        {
          key: `${prop}_trif`,
          label: prop,
          color: CHART_COLORS.trif,
          points: enriched.value.map((d) => [d.timestamp, d[`${prop}_trif`] ?? 0]),
        },
      ]
    }

    return CHANNELS.map((ch) => ({
      key: `${prop}_c${ch}`,
      label: `${prop}${ch}`,
      color: colors[ch - 1],
      points: enriched.value.map((d) => [d.timestamp, d[`${prop}_c${ch}`] ?? 0]),
    }))
  }

  /** Top chart — follows the selected metric button. */
  const powerSeries = computed(() => {
    const prop = tab.value === 'energy' ? 'KWH' : metric.value
    return seriesFor(prop, CHART_COLORS.p)
  })

  const voltageSeries = computed(() => seriesFor('V', CHART_COLORS.v))
  const currentSeries = computed(() => seriesFor('I', CHART_COLORS.i))
  const energySeries = computed(() => seriesFor('KWH', CHART_COLORS.kwh))

  /**
   * Fourth panel: board temperature. A single series, not per-phase — the
   * production page plots `T` here rather than consumption.
   */
  const temperatureSeries = computed<Series[]>(() => {
    const points = enriched.value
      .map((d) => [d.timestamp, d.T] as [number, number])
      .filter((p) => Number.isFinite(p[1]))

    if (!points.length) return []
    return [{ key: 'T', label: 'T', color: '#83ee72', points }]
  })

  /**
   * Y-axis bounds per quantity, from the device's configured metadata with
   * production's fallbacks (getMinMaxYaxis in SynchronizedCharts.tsx). Fixed
   * bounds keep a current spike from flattening the whole series.
   */
  const axisBounds = computed(() => {
    const m = device.value?.ratings ?? {}
    const trifMultiplier = perPhase.value ? 1 : 3

    let powerMin = (m.minP ?? -3000) * trifMultiplier
    let powerMax = (m.maxP ?? 3000) * trifMultiplier

    if (tab.value === 'power' && metric.value === 'FP') {
      powerMin = 0
      powerMax = 1
    } else if (tab.value === 'power' && metric.value === 'FC') {
      powerMin = 0
      powerMax = 100
    } else if (tab.value === 'energy') {
      // Consumption is monotonic and unbounded; let it auto-scale.
      return {
        power: { min: null, max: null },
        voltage: { min: m.minV ?? 100, max: m.maxV ?? 280 },
        current: { min: m.minI ?? -50, max: m.maxI ?? 50 },
        temperature: { min: (m as any).minT ?? -20, max: (m as any).maxT ?? 80 },
      }
    }

    return {
      power: { min: powerMin, max: powerMax },
      voltage: { min: m.minV ?? 100, max: m.maxV ?? 280 },
      current: { min: m.minI ?? -50, max: m.maxI ?? 50 },
      temperature: { min: (m as any).minT ?? -20, max: (m as any).maxT ?? 80 },
    }
  })

  function metricLabel(prop: string): string {
    return (
      {
        S: 'Aparente',
        P: 'Ativa',
        Q: 'Reativa',
        FP: 'Fator de potência',
        FC: 'Fator de carregamento',
        KWH: 'Consumo',
      }[prop] ?? prop
    )
  }

  /** Channel energy totals for the "Consumo CH1/2/3" cards. */
  const channelEnergy = computed(() => [
    resumes.value.energyCh1,
    resumes.value.energyCh2,
    resumes.value.energyCh3,
  ])

  // ── Waveform-derived charts ───────────────────────────────────────────────

  /**
   * Live-follow. While on, the analysis panels read the waveform straight off
   * MQTT instead of the fetched capture — every device frame carries `v_w` and
   * `i_w` sample arrays, so there is no request to make.
   */
  const realtime = ref(true)

  /** Waveform assembled from the most recent MQTT frame, when it has one. */
  const liveWaveSeries = computed(() => {
    const series = liveChannels.value
      .map((c) => ({ channel: c.channel, voltage: c.v_w ?? [], current: c.i_w ?? [] }))
      .filter((s) => s.voltage.length)

    return series.length ? series : null
  })

  /** Waveform from the fetched capture. */
  const fetchedWaveSeries = computed(() => {
    const w = waveform.value
    if (!w) return null

    const series = CHANNELS.map((ch) => ({
      channel: ch,
      voltage: (w as unknown as Record<string, number[]>)[`vca_c${ch}`] ?? [],
      current: (w as unknown as Record<string, number[]>)[`ica_c${ch}`] ?? [],
    })).filter((s) => s.voltage.length)

    return series.length ? series : null
  })

  /**
   * Live frames win while realtime is on, falling back to the fetched capture
   * for devices whose firmware does not ship waveform arrays over MQTT.
   */
  const waveSeries = computed(() =>
    realtime.value ? (liveWaveSeries.value ?? fetchedWaveSeries.value) : fetchedWaveSeries.value,
  )

  // ── Loading ───────────────────────────────────────────────────────────────

  async function loadReadings() {
    if (!deviceCode) return
    const points = await getChartsOfBoard(deviceCode, rangeStart.value, rangeEnd.value)
    readings.value = Array.isArray(points) ? points : []
  }

  async function load() {
    if (!configured) {
      error.value = 'Energisa não configurado'
      return
    }

    loading.value = true
    error.value = null

    try {
      const list = await loadDevices()
      device.value = list.find((d) => d.id === deviceId || d.code === deviceId) ?? null

      if (!device.value) {
        error.value = 'Dispositivo não encontrado'
        return
      }

      deviceCode = device.value.code
      await loadReadings()

      // Seed the waveform charts from the most recent reading, which is what
      // the production page selects on load.
      const last = readings.value[readings.value.length - 1]
      if (last) await loadWaveform(last)

      if (device.value.topic) {
        subscription = await subscribeDevice(device.value.topic, (_topic, message) => {
          const channels = parseDeviceMessage(message)
          if (channels.length) liveChannels.value = mergeChannels(liveChannels.value, channels)
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Falha ao carregar dispositivo'
    } finally {
      loading.value = false
    }
  }

  /** The reading whose waveform the analysis panels are showing. */
  const selectedPoint = ref<ConsumptionPoint | null>(null)

  async function loadWaveform(point: ConsumptionPoint) {
    if (!deviceCode) return
    selectedPoint.value = point
    loadingWave.value = true
    try {
      waveform.value = await getWaveform(deviceCode, point.timestamp, point.id)
    } catch {
      waveform.value = null
    } finally {
      loadingWave.value = false
    }
  }

  /** The reading nearest a timestamp — what a crosshair click resolves to. */
  function readingNear(timestamp: number): ConsumptionPoint | null {
    if (!readings.value.length) return null
    return readings.value.reduce((best, r) =>
      Math.abs(r.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? r : best,
    )
  }

  async function setRange(start: Date, end: Date) {
    rangeStart.value = start
    rangeEnd.value = end
    loading.value = true
    try {
      await loadReadings()
    } finally {
      loading.value = false
    }
  }

  onUnmounted(() => subscription?.unsubscribe())

  return {
    device,
    readings,
    waveform,
    waveSeries,
    live,
    liveChannels,
    loadingTiles: loading_,
    resumes,
    channelEnergy,
    powerSeries,
    voltageSeries,
    currentSeries,
    energySeries,
    temperatureSeries,
    axisBounds,
    tab,
    metric,
    perPhase,
    grouped,
    isTrafo,
    rangeStart,
    rangeEnd,
    loading,
    loadingWave,
    error,
    configured,
    load,
    loadWaveform,
    readingNear,
    selectedPoint,
    realtime,
    setRange,
    metricLabel,
  }
}
