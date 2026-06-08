import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'
import { useActivityTracker } from '@/composables/useActivityTracker'

// ── Cognito config (values injected via environment variables) ───────────────
const USER_POOL_ID = import.meta.env.VITE_USER_POOL_ID      as string
const CLIENT_ID    = import.meta.env.VITE_COGNITO_CLIENT_ID as string
const TOKEN_EXPIRY_MINUTES = 30

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
})

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{ name: string; email: string } | null>(null)
  const accessToken = ref<string | null>(null)
  const idToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const tokenExpiry = ref<number | null>(null)  // unix ms
  const mustChangePassword = ref(false)
  const cognitoUser = ref<CognitoUser | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  // ── Computed ──────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => {
    if (!accessToken.value || !tokenExpiry.value) return false
    return Date.now() < tokenExpiry.value
  })

  const tokenExpiresIn = computed(() => {
    if (!tokenExpiry.value) return 0
    return Math.max(0, Math.round((tokenExpiry.value - Date.now()) / 1000 / 60))
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setSession(session: CognitoUserSession) {
    accessToken.value = session.getAccessToken().getJwtToken()
    idToken.value = session.getIdToken().getJwtToken()
    refreshToken.value = session.getRefreshToken().getToken()
    tokenExpiry.value = Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000

    const payload = session.getIdToken().decodePayload()
    user.value = {
      name: payload['name'] ?? payload['email'] ?? 'User',
      email: payload['email'] ?? '',
    }
  }

  function clearSession() {
    accessToken.value = null
    idToken.value = null
    refreshToken.value = null
    tokenExpiry.value = null
    user.value = null
    cognitoUser.value = null
    mustChangePassword.value = false
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async function login(email: string, password: string): Promise<'ok' | 'new_password_required' | 'error'> {
    loading.value = true
    error.value = null

    return new Promise((resolve) => {
      const cu = new CognitoUser({ Username: email, Pool: userPool })
      cognitoUser.value = cu

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      })

      cu.authenticateUser(authDetails, {
        onSuccess(session) {
          setSession(session)
          loading.value = false
          useActivityTracker().trackLogin(email)
          resolve('ok')
        },
        onFailure(err) {
          error.value = err.message ?? 'Login failed'
          loading.value = false
          resolve('error')
        },
        newPasswordRequired(_userAttributes) {
          mustChangePassword.value = true
          loading.value = false
          resolve('new_password_required')
        },
      })
    })
  }

  // ── Complete new password (first login) ───────────────────────────────────
  async function completeNewPassword(newPassword: string): Promise<boolean> {
    loading.value = true
    error.value = null

    return new Promise((resolve) => {
      if (!cognitoUser.value) { resolve(false); return }
      cognitoUser.value.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess(session) {
          setSession(session)
          mustChangePassword.value = false
          loading.value = false
          resolve(true)
        },
        onFailure(err) {
          error.value = err.message ?? 'Failed to set password'
          loading.value = false
          resolve(false)
        },
      })
    })
  }

  // ── Refresh token ─────────────────────────────────────────────────────────
  async function refreshSession(): Promise<boolean> {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) return false

    return new Promise((resolve) => {
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) { clearSession(); resolve(false); return }
        setSession(session)
        resolve(true)
      })
    })
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function logout() {
    const currentUser = userPool.getCurrentUser()
    if (user.value?.email) useActivityTracker().trackLogout(user.value.email)
    currentUser?.signOut()
    clearSession()
  }

  return {
    user,
    accessToken,
    idToken,
    tokenExpiry,
    tokenExpiresIn,
    mustChangePassword,
    error,
    loading,
    isAuthenticated,
    login,
    completeNewPassword,
    refreshSession,
    logout,
  }
}, {
  persist: {
    storage: sessionStorage,
    pick: ['accessToken', 'idToken', 'refreshToken', 'tokenExpiry', 'user'],
  },
})
