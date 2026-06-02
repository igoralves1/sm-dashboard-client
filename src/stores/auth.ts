import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { devCredentials } from '@/config/credentials'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<{ name: string; email: string } | null>(null)
    const token = ref<string | null>(null)

    const isAuthenticated = computed(() => !!token.value)

    function login(username: string, password: string): boolean {
      const match = devCredentials.find(
        (c) => c.username === username && c.password === password,
      )
      if (!match) return false
      token.value = 'mock-token-' + Date.now()
      user.value = { name: username, email: username }
      return true
    }

    function logout() {
      token.value = null
      user.value = null
    }

    return { user, token, isAuthenticated, login, logout }
  },
  {
    persist: true,
  },
)
