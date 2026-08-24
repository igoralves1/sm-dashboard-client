/**
 * REST client for the two Energisa APIs.
 *
 * Both sit behind API Gateway Cognito authorizers that read the raw id token
 * from the Authorization header (no "Bearer " prefix — the authorizer's
 * identitySource is method.request.header.Authorization and it expects the
 * JWT itself).
 *
 * A 204 here is not an error: the getDevices Lambda returns it when the
 * authenticated user belongs to no tenant and no groups, which is what a
 * correctly-authenticated but unaffiliated account gets back.
 */

import { energisaConfig } from './config'
import { energisaAccessToken, energisaIdToken } from './auth'

export class EnergisaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message)
    this.name = 'EnergisaApiError'
  }
}

/**
 * The two API families disagree on both token type and header format:
 *
 *   API Gateway (tenants, devices) → bare id token
 *   Organization REST host         → "Bearer " + access token
 *
 * Sending the wrong one fails in confusing ways — the org host answers 403 for
 * a bare token and 500 for a Bearer id token, neither of which reads as an
 * auth problem. Both combinations were verified against the live APIs.
 */
type AuthStyle = 'gateway' | 'bearer'

async function request<T>(base: string, path: string, style: AuthStyle = 'gateway'): Promise<T | null> {
  const url = `${base}${path}`
  const authorization =
    style === 'bearer' ? `Bearer ${await energisaAccessToken()}` : await energisaIdToken()

  const res = await fetch(url, {
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
  })

  // Empty body — authenticated, nothing to return.
  if (res.status === 204) return null

  if (!res.ok) {
    throw new EnergisaApiError(
      res.status === 401
        ? 'Energisa API rejected the token'
        : `Energisa API returned ${res.status}`,
      res.status,
      url,
    )
  }

  const text = await res.text()
  if (!text) return null
  return JSON.parse(text) as T
}

export const tenants = <T>(path: string) => request<T>(energisaConfig.tenantsApi, path)
export const devicesApi = <T>(path: string) => request<T>(energisaConfig.devicesApi, path)
export const orgApi = <T>(path: string) => request<T>(energisaConfig.orgApi, path, 'bearer')

const qs = (params: Record<string, string | number>) =>
  Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')

export { qs }
