/**
 * Normalise MQTT payloads into ChannelReading[].
 *
 * Devices in the field run two firmware generations that report the same
 * quantities under different keys, so every message has to be probed rather
 * than assumed. Ported from MonorepoFront models/eletricDevice.ts, where the
 * two shapes are handled by templateV1 / templateV2 and selected on the
 * presence of a `v_fw` field.
 *
 *   v1 (legacy)  { E_ch_1: { V, I, Vca, Ica, P, KWh_dia } }
 *   v2 (current) { v_fw: "...", e_ch_1: { v, i, v_a, i_a, p, e_d, v_w, i_w } }
 *
 * Note the angle mapping in v1: the React source assigns Vca to i_a and Ica to
 * v_a. That looks transposed, but it is what the firmware emits and what the
 * production dashboard renders, so it is preserved here deliberately.
 */

import type { ChannelReading } from '@/services/energisa/types'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [])

function fromV1(elm: any, channel: number): ChannelReading {
  return {
    channel,
    i: num(elm?.I),
    v: num(elm?.V),
    i_a: num(elm?.Vca),
    v_a: num(elm?.Ica),
    p: num(elm?.P),
    e_d: num(elm?.KWh_dia ?? elm?.kWh_dia),
    i_w: [],
    v_w: [],
  }
}

function fromV2(elm: any, channel: number): ChannelReading {
  return {
    channel: channel + 1,
    i: num(elm?.i),
    v: num(elm?.v),
    i_a: num(elm?.i_a),
    v_a: num(elm?.v_a),
    p: num(elm?.p),
    e_d: num(elm?.e_d),
    i_w: arr(elm?.i_w),
    v_w: arr(elm?.v_w),
  }
}

/** Channel keys look like `e_ch_1` / `E_ch_1`; pull the trailing index out. */
function channelIndex(key: string): number | null {
  const m = /_ch_?(\d+)$/i.exec(key)
  return m ? Number(m[1]) : null
}

/**
 * Extract every channel present in one MQTT message.
 * Returns [] for messages that carry no channel data (status frames, acks).
 */
export function parseDeviceMessage(message: any): ChannelReading[] {
  if (!message || typeof message !== 'object') return []

  const isV2 = Boolean(message.v_fw)
  const readings: ChannelReading[] = []

  for (const key of Object.keys(message)) {
    const idx = channelIndex(key)
    if (idx === null) continue

    const value = message[key]
    if (!value || typeof value !== 'object') continue

    // v2 channels are zero-based in the payload and shifted to 1-based by
    // fromV2; v1 channels are already 1-based.
    readings.push(isV2 ? fromV2(value, idx - 1) : fromV1(value, idx))
  }

  return readings.sort((a, b) => a.channel - b.channel)
}

/** Merge freshly-arrived channels over what we already had for a device. */
export function mergeChannels(
  current: ChannelReading[],
  incoming: ChannelReading[],
): ChannelReading[] {
  if (!incoming.length) return current
  const byChannel = new Map(current.map((c) => [c.channel, c]))
  for (const reading of incoming) byChannel.set(reading.channel, reading)
  return [...byChannel.values()].sort((a, b) => a.channel - b.channel)
}
