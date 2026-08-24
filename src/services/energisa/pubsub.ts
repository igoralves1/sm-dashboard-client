/**
 * AWS IoT MQTT over WebSockets.
 *
 * The card metrics on the device list do not come from REST — they arrive here.
 * That is why a freshly-loaded page shows "- W / - Wh" until the first message
 * lands, and why offline devices never fill in.
 *
 * Topics, from MonorepoFront models/eletricDevice.ts and models/baseDevice.ts:
 *   {topic}/eletric/data     live channel readings
 *   {topic}/data/log         periodic log frames
 *   {topic}/data/retained    last-known values, delivered on subscribe
 */

import { PubSub } from '@aws-amplify/pubsub'
import { energisaConfig } from './config'
import { ensureEnergisaSession } from './auth'

let client: PubSub | null = null

function pubsub(): PubSub {
  if (!client) {
    client = new PubSub({
      region: energisaConfig.region,
      endpoint: energisaConfig.pubsubEndpoint,
    })
  }
  return client
}

export interface Subscription {
  unsubscribe: () => void
}

/**
 * Subscribe to one device's live topics.
 *
 * Requires an Energisa session, because PubSub signs the WebSocket with
 * credentials obtained from the identity pool. If MQTT connects and then drops
 * immediately, the identity is missing its IoT policy — attach the existing
 * `cognito` policy to the identity id from energisaIdentityId().
 */
export async function subscribeDevice(
  topic: string,
  onMessage: (topic: string, message: any) => void,
  onError?: (err: unknown) => void,
): Promise<Subscription> {
  await ensureEnergisaSession()

  const topics = [`${topic}/eletric/data`, `${topic}/data/log`, `${topic}/data/retained`]

  const sub = pubsub()
    .subscribe({ topics })
    .subscribe({
      next: (data: any) => {
        // Amplify v6 delivers the payload directly; older shapes nested it
        // under `value`, so accept both.
        const payload = data?.value ?? data
        onMessage(payload?.__topic ?? topic, payload)
      },
      error: (err: unknown) => onError?.(err),
    })

  return { unsubscribe: () => sub.unsubscribe() }
}
