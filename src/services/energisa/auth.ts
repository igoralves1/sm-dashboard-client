/**
 * Sign-in against the Energisa Cognito pool.
 *
 * This is deliberately separate from src/stores/auth.ts. That store owns the
 * SM Dashboard session (pool us-east-2_hltmvz5dI); this one owns the Energisa
 * session (pool us-east-2_SFrYV4huf). Both pools are accepted by the API
 * Gateway authorizers, but only an Energisa account carries the organization
 * membership the backend needs — a token from the dashboard pool authenticates
 * successfully and then returns an empty device list.
 *
 * Amplify keeps one global config, so we configure it lazily on first use and
 * never touch it again. Nothing else in this app uses Amplify.
 */

import { Amplify } from 'aws-amplify'
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth'
import { energisaConfig, isEnergisaConfigured } from './config'

let configured = false
let signInPromise: Promise<void> | null = null

function configure() {
  if (configured) return
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: energisaConfig.userPoolId,
        userPoolClientId: energisaConfig.clientId,
        identityPoolId: energisaConfig.identityPoolId,
        loginWith: { username: true },
      },
    },
  })
  configured = true
}

/**
 * Ensure there is a live Energisa session, signing in with the demo account if
 * needed. Concurrent callers share one in-flight sign-in rather than racing.
 */
export async function ensureEnergisaSession(): Promise<void> {
  if (!isEnergisaConfigured()) {
    throw new Error('Energisa credentials are not configured')
  }

  configure()

  const existing = await currentIdToken()
  if (existing) return

  if (!signInPromise) {
    signInPromise = (async () => {
      try {
        // A stale session from a previous account blocks signIn with
        // UserAlreadyAuthenticatedException, so clear it first.
        await signOut().catch(() => undefined)
        // SRP, not USER_PASSWORD_AUTH: the Energisa app client leaves
        // ExplicitAuthFlows unset, so only the SRP defaults are enabled.
        // Amplify implements SRP in the browser, and the password never
        // leaves the client.
        await signIn({
          username: energisaConfig.user,
          password: energisaConfig.password,
          options: { authFlowType: 'USER_SRP_AUTH' },
        })
      } finally {
        signInPromise = null
      }
    })()
  }

  await signInPromise
}

/** The current Energisa id token, or null when there is no valid session. */
export async function currentIdToken(): Promise<string | null> {
  configure()
  try {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString() ?? null
  } catch {
    return null
  }
}

/** A fresh id token, signing in first when necessary. */
export async function energisaIdToken(): Promise<string> {
  await ensureEnergisaSession()
  const token = await currentIdToken()
  if (!token) throw new Error('Energisa sign-in produced no token')
  return token
}

/**
 * A fresh access token.
 *
 * The two API families want different tokens, which is not interchangeable:
 * the API Gateway Cognito authorizers accept the id token, while the
 * organization REST host validates the access token and rejects the id token
 * with 500. Verified against both.
 */
export async function energisaAccessToken(): Promise<string> {
  await ensureEnergisaSession()
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()
  if (!token) throw new Error('Energisa sign-in produced no access token')
  return token
}

/**
 * The Cognito identity id backing this session. AWS IoT needs an IoT policy
 * attached to this id before MQTT will stay connected.
 */
export async function energisaIdentityId(): Promise<string | null> {
  await ensureEnergisaSession()
  try {
    return (await fetchAuthSession()).identityId ?? null
  } catch {
    return null
  }
}

export async function endEnergisaSession(): Promise<void> {
  if (!configured) return
  await signOut().catch(() => undefined)
}
