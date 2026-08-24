/**
 * Device inventory and interval readings.
 *
 * Ported from MonorepoFront api/devices.ts and api/apitenants.ts. The React app
 * reads the device list from a Lightsail host via
 * `organizations/:organization/devices`; we use `/devices` on the tenants API
 * instead, which is API Gateway in the same AWS account and returns the same
 * tenant-scoped inventory without a second backend in the path.
 */

import { orgApi, devicesApi, tenants, qs } from './api'
import { energisaConfig } from './config'
import type { ConsumptionPoint, EnergisaDevice, WaveformSample } from './types'

/**
 * Map an organization device onto our model.
 *
 * Field names verified against a live response. Two things are easy to get
 * wrong:
 *
 *  - `id` is a UUID for the record, but the readings API keys off `code`
 *    ("smbkm7i"). The React page passes device.code as `deviceid`, and the
 *    UUID is rejected.
 *  - The card's "Palmas / Quadra 806S" is place.name + subPlace.name, which
 *    are nested objects rather than strings.
 */
export function normalizeDevice(raw: any): EnergisaDevice {
  const place = raw?.place?.name ?? raw?.subPlace?.place?.name
  const subPlace = raw?.subPlace?.name

  // An EM3 device carries one ENERGY thing holding the channel list and the
  // rating metadata that load factor is computed against.
  const energyThing =
    (raw?.things ?? []).find((t: any) => t?.type === 'ENERGY') ?? raw?.things?.[0]

  return {
    id: String(raw?.id ?? ''),
    code: String(raw?.code ?? ''),
    // The editable display name lives on the thing, not the device — the
    // pencil in the production UI calls updateThing(). The device's own
    // `name` is often just the code.
    name: energyThing?.name || raw?.name || 'Sem nome',
    // Topics come back without a trailing slash here, but the MQTT paths are
    // built as `${topic}/eletric/data`; normalise so we never emit `//`.
    topic: String(raw?.topic ?? '').replace(/\/+$/, ''),
    type: raw?.type?.type ?? raw?.type?.name,
    thingType: energyThing?.type,
    place,
    subPlace,
    location: [place, subPlace].filter(Boolean).join(' / ') || undefined,
    channelNumbers: Array.isArray(energyThing?.channels) ? energyThing.channels : [1, 2, 3],
    ratings: energyThing?.metadata ?? null,
    online: false,
    favourite: false,
    channels: [],
  }
}

/**
 * Device inventory for the configured organization.
 *
 * Uses the organization-scoped REST host rather than the tenants API. The
 * tenants `/devices` endpoint ignores organization selection and returns a
 * different tenant's devices entirely, which is why the production app calls
 * this path instead.
 */
export async function loadDevices(): Promise<EnergisaDevice[]> {
  const raw = await orgApi<any>(`/organizations/${energisaConfig.orgId}/devices`)
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.res ?? raw.devices ?? [])
  return (Array.isArray(list) ? list : [])
    .map(normalizeDevice)
    .filter((d) => d.code)
}

/**
 * Pull the readings array out of whatever wrapper the API returns.
 *
 * The response is nested twice: `{ res: { Kwh_total_c1, …, data: [...] } }`.
 * The React page unwraps `.res` in the API layer and `.data` at the call site,
 * so neither level alone is enough. Handles every intermediate shape rather
 * than assuming one, because a wrong guess here surfaces as
 * "readings.map is not a function" deep inside a computed.
 */
function extractPoints(payload: any): ConsumptionPoint[] {
  for (const candidate of [payload, payload?.res, payload?.data, payload?.res?.data]) {
    if (Array.isArray(candidate)) return candidate as ConsumptionPoint[]
  }
  return []
}

/** Interval readings for the charts on the detail page. */
export async function getChartsOfBoard(
  deviceId: string,
  start: Date,
  end: Date,
): Promise<ConsumptionPoint[]> {
  const res = await devicesApi<any>(
    `/consumo/eletrico?${qs({
      device_id: deviceId,
      dt_start: start.getTime(),
      dt_end: end.getTime(),
    })}`,
  )
  return extractPoints(res)
}

/**
 * One captured waveform, for the temporal / phasor / harmonic charts.
 *
 * `id` is the reading's own id and is required — the endpoint answers with
 * nothing when it is blank, which is why the three analysis panels stay empty
 * if you only pass a timestamp.
 */
export async function getWaveform(
  deviceId: string,
  timestamp: number,
  waveId: number,
): Promise<WaveformSample | null> {
  const res = await devicesApi<any>(
    `/consumo/eletrico/onda?${qs({
      device_id: deviceId,
      id: waveId,
      dt: timestamp,
    })}`,
  )
  if (!res) return null

  const wave = (res.res ?? res) as any
  if (!wave || typeof wave !== 'object') return null

  return {
    ...wave,
    // The API returns an ISO string here while the readings use epoch ms.
    timestamp: new Date(wave.timestamp).getTime(),
  } as WaveformSample
}

/** Daily totals, used by the accumulated-energy tab. */
export async function getDailyConsumption(
  deviceId: string,
  start: Date,
  end: Date,
): Promise<unknown> {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`

  return tenants(
    `/consumo/eletrico/diario?${qs({
      deviceID: deviceId,
      dt_start: fmt(start),
      dt_end: fmt(end),
    })}`,
  )
}
