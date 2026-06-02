<template>
  <div class="auth-box overflow-hidden d-flex align-items-center">
    <BContainer>
      <BRow class="justify-content-center">
        <BCol cols="12" sm="8" md="6" xxl="4">
          <div class="auth-brand text-center mb-4">
            <AuthLogo />
            <h4 class="fw-bold mt-3">Welcome to SIMEMAP</h4>
            <p class="text-muted w-lg-75 mx-auto">
              Let's get you signed in. Enter your email and password to continue.
            </p>
          </div>

          <BCard no-body class="rounded-4 p-4">
            <BForm @submit.prevent="handleLogin">
              <div class="mb-3">
                <label for="userEmail" class="form-label">
                  Email address <span class="text-danger">*</span>
                </label>
                <BFormInput
                  id="userEmail"
                  v-model="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div class="mb-3">
                <label for="userPassword" class="form-label">
                  Password <span class="text-danger">*</span>
                </label>
                <BFormInput
                  id="userPassword"
                  v-model="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div class="d-flex justify-content-between align-items-center mb-3">
                <BFormCheckbox name="keepSignedIn"> Keep me signed in</BFormCheckbox>
                <RouterLink
                  to="/forgot-password"
                  class="text-decoration-underline link-offset-3 text-muted"
                >
                  Forgot Password?
                </RouterLink>
              </div>

              <BAlert v-if="error" variant="danger" :model-value="true" class="mb-3">
                {{ error }}
              </BAlert>

              <div class="d-grid">
                <BButton type="submit" variant="primary" class="fw-semibold py-2" :disabled="loading">
                  {{ loading ? 'Signing in…' : 'Sign In' }}
                </BButton>
              </div>
            </BForm>

            <p class="text-muted text-center mt-4 mb-0">
              New here?
              <RouterLink
                to="/register"
                class="text-decoration-underline link-offset-3 fw-semibold"
              >
                Create an account
              </RouterLink>
            </p>
          </BCard>

          <p class="text-center text-muted mt-4 mb-0">
            © 2014 - {{ currentYear }} SIMEMAP — by
            <span class="fw-semibold">{{ author }}</span>
          </p>
        </BCol>
      </BRow>
    </BContainer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { author, currentYear } from '@/helpers'
import AuthLogo from '@/components/AuthLogo.vue'
import { usePageMeta } from '@/composables/usePageMeta.ts'
import { useAuthStore } from '@/stores/auth.ts'

usePageMeta('Sign In')

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    auth.login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (e) {
    error.value = 'Invalid email or password.'
  } finally {
    loading.value = false
  }
}
</script>
