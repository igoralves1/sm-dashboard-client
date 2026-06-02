<template>
  <div class="auth-box overflow-hidden align-items-center d-flex">
    <BContainer>
      <BRow class="justify-content-center">
        <BCol cols="12" sm="8" md="6" xxl="4">
          <div class="auth-brand text-center mb-4">
            <AuthLogo />
            <h4 class="fw-bold mt-3">Password Updated</h4>
            <p class="text-muted w-lg-75 mx-auto">
              Your password has been changed successfully.
            </p>
          </div>

          <BCard no-body class="p-4 rounded-4">
            <div class="mb-4">
              <div class="avatar-xxl mx-auto mt-2">
                <div
                  class="avatar-title bg-light-subtle border border-light border-dashed rounded-circle"
                >
                  <img :src="checkmark" alt="success" height="64" />
                </div>
              </div>
            </div>

            <h4 class="fw-bold text-center mb-4">All done! You can now sign in with your new password.</h4>

            <div class="d-grid">
              <BButton variant="primary" class="fw-semibold py-2 w-100" @click="goToLogin">
                Back to Sign In
              </BButton>
            </div>
          </BCard>

          <p class="text-center text-muted mt-4 mb-0">
            © 2014 - {{ currentYear }} INSPINIA — by <span class="fw-semibold">{{ author }}</span>
          </p>
        </BCol>
      </BRow>
    </BContainer>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { author, currentYear } from '@/helpers'
import checkmark from '@/assets/images/checkmark.png'
import AuthLogo from '@/components/AuthLogo.vue'
import { usePageMeta } from '@/composables/usePageMeta.ts'

usePageMeta('Password Changed')

const router = useRouter()

function goToLogin() {
  router.push({ name: 'login' })
}
</script>
