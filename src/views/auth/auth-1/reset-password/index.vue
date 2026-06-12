<template>
  <div class="auth-box overflow-hidden d-flex align-items-center">
    <BContainer>
      <BRow class="justify-content-center">
        <BCol cols="12" sm="8" md="6" xxl="4">
          <div class="auth-brand text-center mb-4">
            <AuthLogo />
            <h4 class="fw-bold mt-3">{{ t('forgot.title') }}</h4>
            <p class="text-muted w-lg-75 mx-auto">
              {{ t('forgot.subtitle') }}
            </p>
          </div>

          <BCard no-body class="p-4 rounded-4">
            <BForm @submit.prevent="handleSubmit">
              <div class="mb-3">
                <label for="userEmail" class="form-label">
                  {{ t('forgot.email_label') }} <span class="text-danger">*</span>
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
                <BFormCheckbox name="agree"> {{ t('forgot.agree_terms') }}</BFormCheckbox>
              </div>

              <div class="d-grid">
                <BButton variant="primary" type="submit" class="fw-semibold py-2">
                  {{ t('forgot.send_link') }}
                </BButton>
              </div>
            </BForm>

            <p class="text-muted text-center mt-4 mb-0">
              {{ t('forgot.return_to') }}
              <RouterLink
                to="/login"
                class="text-decoration-underline link-offset-3 fw-semibold"
              >
                {{ t('forgot.sign_in') }}
              </RouterLink>
            </p>
          </BCard>

          <p class="text-center text-muted mt-4 mb-0">
            © 2018 - {{ currentYear }} SIMEMAP — by SIMEMAP
          </p>
        </BCol>
      </BRow>
    </BContainer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { currentYear } from '@/helpers'
import { usePageMeta } from '@/composables/usePageMeta.ts'
import AuthLogo from '@/components/AuthLogo.vue'
import { useI18n } from 'vue-i18n'

usePageMeta('Forgot Password')

const { t } = useI18n()
const email = ref('')
const router = useRouter()

function handleSubmit() {
  // In a real app, call your API here to send the reset email
  router.push({ name: 'reset-password', query: { email: email.value } })
}
</script>

<style scoped>
.auth-box {
  font-family: 'IBM Plex Sans', sans-serif;
}
.auth-box h4,
.auth-box .btn {
  font-family: 'Michroma', sans-serif;
  font-weight: 400;
}
.auth-box h4 {
  font-size: 1.1rem;
}
</style>
