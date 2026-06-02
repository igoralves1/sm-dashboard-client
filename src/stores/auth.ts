import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<{ name: string; email: string } | null>(null)
    const token = ref<string | null>(null)

    const isAuthenticated = computed(() => !!token.value)

    function login(email: string, _password: string) {
      // Replace with real API call
      token.value = 'mock-token-' + Date.now()
      user.value = { name: email.split('@')[0], email }
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
