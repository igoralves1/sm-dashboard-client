/**
 * S3-backed activity storage for cross-user/cross-browser session data.
 * Bucket: <S3_BUCKET> (us-east-2)
 * Layout: sessions/{userId}/{sessionId}.json
 *
 * Uses Cognito Identity Pool credentials (same as Timestream).
 */

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { useAuthStore } from '@/stores/auth'
import type { PageSession } from './useSessionTracker'

const BUCKET  = '<S3_BUCKET>'
const REGION  = import.meta.env.VITE_AWS_REGION        as string
const POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID  as string
const UP_ID   = import.meta.env.VITE_USER_POOL_ID      as string

function makeClient(): S3Client {
  const auth = useAuthStore()
  const idToken = auth.idToken ?? ''

  const logins = idToken
    ? { [`cognito-idp.${REGION}.amazonaws.com/${UP_ID}`]: idToken }
    : undefined

  return new S3Client({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      // @ts-ignore: duplicate CognitoIdentityClient types across AWS SDK nested-clients
      client: new CognitoIdentityClient({ region: REGION }),
      identityPoolId: POOL_ID,
      logins,
    }),
  })
}

// Sanitize user email for use in S3 key
function sanitizeUser(user: string): string {
  return user.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}

function isAuthenticated(): boolean {
  return !!useAuthStore().idToken
}

export function useS3Activity() {

  async function uploadSession(session: PageSession): Promise<void> {
    if (!isAuthenticated()) return   // no Cognito session → skip silently
    try {
      const client = makeClient()
      const key = `sessions/${sanitizeUser(session.user)}/${session.id}.json`
      await client.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         key,
        Body:        JSON.stringify(session),
        ContentType: 'application/json',
      }))
    } catch (e) {
      console.warn('[S3Activity] upload failed:', e)
    }
  }

  async function loadAllSessions(): Promise<PageSession[]> {
    if (!isAuthenticated()) return []   // no Cognito session → return empty
    try {
      const client = makeClient()
      const sessions: PageSession[] = []

      let continuationToken: string | undefined
      do {
        const listResp = await client.send(new ListObjectsV2Command({
          Bucket:            BUCKET,
          Prefix:            'sessions/',
          ContinuationToken: continuationToken,
        }))

        const keys = (listResp.Contents ?? []).map(o => o.Key!).filter(Boolean)

        await Promise.all(keys.map(async (key) => {
          try {
            const obj = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
            const text = await obj.Body!.transformToString()
            sessions.push(JSON.parse(text) as PageSession)
          } catch { /* skip corrupted objects */ }
        }))

        continuationToken = listResp.NextContinuationToken
      } while (continuationToken)

      // Sort newest first
      sessions.sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))
      return sessions
    } catch (e) {
      console.warn('[S3Activity] load failed:', e)
      return []
    }
  }

  return { uploadSession, loadAllSessions }
}
