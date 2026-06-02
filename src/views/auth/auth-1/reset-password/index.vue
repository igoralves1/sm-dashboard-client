<template>
  <div class="auth-box overflow-hidden d-flex align-items-center">
    <BContainer>
      <BRow class="justify-content-center">
        <BCol cols="12" sm="8" md="6" xxl="4">
          <div class="auth-brand text-center mb-4">
            <AuthLogo />
            <h4 class="fw-bold mt-3">Forgot Password?</h4>
            <p class="text-muted w-lg-75 mx-auto">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <BCard no-body class="p-4 rounded-4">
            <BForm @submit.prevent="handleSubmit">
              <div class="mb-3">
                <label for="userEmail" class="form-label">
                  Email address <span class="text-danger">*</span>
                </label>
                <BFormInput
                  type="email"
                  id="userEmail"
                  v-model="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div class="mb-3">
                <BFormCheckbox name="agree"> Agree the Terms & Policy</BFormCheckbox>
              </div>

              <div class="d-grid">
                <BButton variant="primary" type="submit" class="fw-semibold py-2">
                  Send Reset Link
                </BButton>
              </div>
            </BForm>

            <p class="text-muted text-center mt-4 mb-0">
              Return to
              <RouterLink
                to="/login"
                class="text-decoration-underline link-offset-3 fw-semibold"
              >
                Sign in
              </RouterLink>
            </p>
          </BCard>

          <p class="text-center text-muted mt-4 mb-0">
            © 2014 - {{ currentYear }} SIMEMAP — by <span class="fw-semibold">{{ author }}</span>
          </p>
        </BCol>
      </BRow>
    </BContainer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { author, currentYear } from '@/helpers'
import { usePageMeta } from '@/composables/usePageMeta.ts'
import AuthLogo from '@/components/AuthLogo.vue'

usePageMeta('Forgot Password')

const email = ref('')
const router = useRouter()

function handleSubmit() {
  // In a real app, call your API here to send the reset email
  router.push({ name: 'reset-password', query: { email: email.value } })
}
</script>
