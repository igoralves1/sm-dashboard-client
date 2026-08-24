/**
 * Energisa data-plane configuration.
 *
 * The energy pages talk to a different AWS stack than the rest of this
 * dashboard: its own Cognito user pool, its own identity pool, two REST APIs
 * and an IoT MQTT endpoint. Everything here comes from .env — see .env.example.
 */

const env = import.meta.env

export const energisaConfig = {
  region: env.VITE_AWS_REGION as string,
  userPoolId: env.VITE_ENERGISA_USER_POOL_ID as string,
  clientId: env.VITE_ENERGISA_CLIENT_ID as string,
  identityPoolId: env.VITE_ENERGISA_IDENTITY_POOL_ID as string,
  pubsubEndpoint: env.VITE_ENERGISA_PUBSUB_ENDPOINT as string,
  tenantsApi: env.VITE_ENERGISA_TENANTS_API as string,
  devicesApi: env.VITE_ENERGISA_DEVICES_API as string,
  /** Organization-scoped REST host; source of the device inventory. */
  orgApi: env.VITE_ENERGISA_API as string,
  /** Which organization's devices to show. */
  orgId: env.VITE_ENERGISA_ORG_ID as string,
  user: env.VITE_ENERGISA_USER as string,
  password: env.VITE_ENERGISA_PASSWORD as string,
}

/**
 * True when the demo credentials are present. The pages check this so they can
 * show a clear "not configured" state instead of failing inside Amplify.
 */
export const isEnergisaConfigured = (): boolean =>
  Boolean(
    energisaConfig.userPoolId &&
      energisaConfig.clientId &&
      energisaConfig.user &&
      energisaConfig.password,
  )

/** Names of whatever is missing, for the not-configured message. */
export const missingEnergisaConfig = (): string[] =>
  (
    [
      ['VITE_ENERGISA_USER_POOL_ID', energisaConfig.userPoolId],
      ['VITE_ENERGISA_CLIENT_ID', energisaConfig.clientId],
      ['VITE_ENERGISA_IDENTITY_POOL_ID', energisaConfig.identityPoolId],
      ['VITE_ENERGISA_TENANTS_API', energisaConfig.tenantsApi],
      ['VITE_ENERGISA_DEVICES_API', energisaConfig.devicesApi],
      ['VITE_ENERGISA_API', energisaConfig.orgApi],
      ['VITE_ENERGISA_ORG_ID', energisaConfig.orgId],
      ['VITE_ENERGISA_USER', energisaConfig.user],
      ['VITE_ENERGISA_PASSWORD', energisaConfig.password],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name)
