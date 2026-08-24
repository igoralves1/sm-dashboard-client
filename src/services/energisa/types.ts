/**
 * Energisa domain types, ported from MonorepoFront's
 * apps/simemap_dash/src/models and pages/Devices.
 *
 * The device-list response shape is not yet confirmed against a real tenant —
 * the only account available for verification belongs to no organization, so
 * the API returns 204. Fields here follow the React models; anything the live
 * response disagrees with should be corrected in normalizeDevice().
 */

/** One reading row from /consumo/eletrico — three channels per timestamp. */
export interface ConsumptionPoint {
  id: number
  timestamp: number
  v_c1: number; v_a_c1: number; i_c1: number; i_a_c1: number; p_c1: number; kwh_c1: number
  v_c2: number; v_a_c2: number; i_c2: number; i_a_c2: number; p_c2: number; kwh_c2: number
  v_c3: number; v_a_c3: number; i_c3: number; i_a_c3: number; p_c3: number; kwh_c3: number
}

/** Captured voltage/current waveform for one instant, from /consumo/eletrico/onda. */
export interface WaveformSample {
  timestamp: number
  vca_c1: number[]; ica_c1: number[]
  vca_c2: number[]; ica_c2: number[]
  vca_c3: number[]; ica_c3: number[]
}

/** Live values for a single channel, as they arrive over MQTT. */
export interface ChannelReading {
  channel: number
  /** current, amps */
  i: number
  /** voltage, volts */
  v: number
  /** current angle */
  i_a: number
  /** voltage angle */
  v_a: number
  /** power, watts */
  p: number
  /** energy accumulated today, Wh */
  e_d: number
  /** voltage waveform samples */
  v_w: number[]
  /** current waveform samples */
  i_w: number[]
}

/** Nameplate ratings from the ENERGY thing's metadata; load factor divides by these. */
export interface DeviceRatings {
  maxV?: number
  minV?: number
  maxI?: number
  minI?: number
  maxP?: number
  minP?: number
  /** Nominal power — the divisor for load factor on TRAFO devices. */
  nomP?: number
}

export interface EnergisaDevice {
  /** Record UUID — used for routing, never for the readings API. */
  id: string
  /** Short code ("smbkm7i") — this is what /consumo/eletrico expects. */
  code: string
  name: string
  /** MQTT topic root, without trailing slash; live subscriptions hang off this. */
  topic: string
  /** Device type, e.g. "EM3" for a three-phase energy meter. */
  type?: string
  /**
   * Thing type — "TRAFO", "ENERGY", … Load factor and temperature are shown
   * only for TRAFO, which is why two of the five production cards omit them
   * despite one of them being *named* "Trafo".
   */
  thingType?: string
  place?: string
  subPlace?: string
  /** "Palmas / Quadra 806S" as rendered on the card. */
  location?: string
  /** Channels this device actually reports, usually [1, 2, 3]. */
  channelNumbers: number[]
  ratings: DeviceRatings | null
  temperature?: number
  /** True once an MQTT message has arrived recently. */
  online: boolean
  favourite: boolean
  channels: ChannelReading[]
  lastSeen?: number
}

/** Card metrics, derived from whatever channels have reported. */
export interface DeviceSummary {
  /** Sum of channel power, watts. */
  totalPower: number | null
  /** Sum of channel energy today, Wh. */
  consumptionToday: number | null
  /** Mean load factor across reporting channels, percent. */
  loadFactor: number | null
  temperature: number | null
}

export interface ChannelStats {
  ch: number
  vef: { min: number; med: number; max: number }
  ief: { min: number; med: number; max: number }
  pef: { min: number; med: number; max: number }
}

export interface ConsumptionResumes {
  metrics: ChannelStats[]
  energyCh1: number
  energyCh2: number
  energyCh3: number
}
