/**
 * Fetches user list from Cognito User Pool using Identity Pool credentials.
 * Requires cognito-idp:ListUsers on the authenticated IAM role.
 */
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { useAuthStore } from '@/stores/auth'

const REGION    = import.meta.env.VITE_AWS_REGION       as string
const POOL_ID   = import.meta.env.VITE_IDENTITY_POOL_ID as string
const UP_ID     = import.meta.env.VITE_USER_POOL_ID     as string

export interface CognitoUser {
  username:     string
  email:        string
  status:       string   // CONFIRMED | FORCE_CHANGE_PASSWORD | UNCONFIRMED | ARCHIVED
  enabled:      boolean
  createdAt:    string   // ISO
  updatedAt:    string   // ISO
  passwordSet:  boolean  // true when status === CONFIRMED
}

function makeClient() {
  const auth    = useAuthStore()
  const idToken = auth.idToken ?? ''
  const logins  = idToken
    ? { [`cognito-idp.${REGION}.amazonaws.com/${UP_ID}`]: idToken }
    : undefined
  return new CognitoIdentityProviderClient({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      // @ts-ignore: duplicate CognitoIdentityClient types across AWS SDK nested-clients
      client: new CognitoIdentityClient({ region: REGION }),
      identityPoolId: POOL_ID,
      logins,
    }),
  })
}

function attr(user: UserType, name: string): string {
  return user.Attributes?.find(a => a.Name === name)?.Value ?? ''
}

export function useCognitoUsers() {
  async function listUsers(): Promise<CognitoUser[]> {
    const client = makeClient()
    const users: CognitoUser[] = []
    let paginationToken: string | undefined

    do {
      const resp = await client.send(new ListUsersCommand({
        UserPoolId:      UP_ID,
        PaginationToken: paginationToken,
        Limit:           60,
      }))

      for (const u of resp.Users ?? []) {
        users.push({
          username:    u.Username ?? '',
          email:       attr(u, 'email'),
          status:      u.UserStatus ?? 'UNKNOWN',
          enabled:     u.Enabled ?? false,
          createdAt:   u.UserCreateDate?.toISOString()      ?? '',
          updatedAt:   u.UserLastModifiedDate?.toISOString() ?? '',
          passwordSet: u.UserStatus === 'CONFIRMED',
        })
      }
      paginationToken = resp.PaginationToken
    } while (paginationToken)

    return users.sort((a, b) => a.email.localeCompare(b.email))
  }

  return { listUsers }
}
