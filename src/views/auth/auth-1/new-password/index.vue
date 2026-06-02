<template>
  <div class="auth-box overflow-hidden d-flex align-items-center">
    <BContainer>
      <BRow class="justify-content-center">
        <BCol cols="12" sm="8" md="6" xxl="4">
          <div class="auth-brand text-center mb-4">
            <AuthLogo />
            <h4 class="fw-bold mt-3">Set New Password</h4>
            <p class="text-muted w-lg-75 mx-auto">
              We've sent a 6-digit code to <strong>{{ email }}</strong>. Enter it below along with your new password.
            </p>
          </div>

          <BCard no-body class="p-4 rounded-4">
            <BForm @submit.prevent="handleSubmit">
              <div class="mb-3">
                <label class="form-label">
                  6-digit code <span class="text-danger">*</span>
                </label>
                <VOtpInput
                  v-model:value="otp"
                  :num-inputs="6"
                  separator=" "
                  input-classes="form-control text-center"
                  :should-auto-focus="true"
                  :is-input-num="true"
                />
              </div>

              <div class="mb-3">
                <label for="userPassword" class="form-label">
                  New Password <span class="text-danger">*</span>
                </label>
                <BFormInput
                  id="userPassword"
                  v-model="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
                <PasswordStrengthBar :password="password" />
              </div>

              <div class="mb-3">
                <label for="userConfirmPassword" class="form-label">
                  Confirm New Password <span class="text-danger">*</span>
                </label>
                <BFormInput
                  type="password"
                  id="userConfirmPassword"
                  v-model="confirmPassword"
                  placeholder="••••••••"
                  required
                />
              </div>

              <BAlert v-if="error" variant="danger" :model-value="true" class="mb-3">
                {{ error }}
              </BAlert>

              <div class="mb-3">
                <BFormCheckbox name="agree"> Agree the Terms & Policy</BFormCheckbox>
              </div>

              <BButton type="submit" variant="primary" class="fw-semibold py-2 w-100">
                Update Password
              </BButton>
            </BForm>

            <p class="mt-4 text-muted text-center mb-4">
              Didn't receive a code?
              <a href="#" class="text-decoration-underline link-offset-2 fw-semibold">Resend</a>
            </p>

            <p class="text-muted text-center mb-0">
              Return to
              <RouterLink to="/login" class="text-decoration-underline link-offset-3 fw-semibold">
                Sign in
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
import VOtpInput from 'vue3-otp-input'
import { author, currentYear } from '@/helpers'
import AuthLogo from '@/components/AuthLogo.vue'
import { usePageMeta } from '@/composables/usePageMeta.ts'

usePageMeta('Reset Password')

const router = useRouter()
const route = useRoute()

const email = route.query.email as string || ''
const otp = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')

function handleSubmit() {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  if (otp.value.length < 6) {
    error.value = 'Please enter the full 6-digit code.'
    return
  }
  // In a real app, validate OTP and update password via API here
  router.push({ name: 'password-changed' })
}
</script>
