<template>
  <div class="sm-auth">

    <!-- ── Left panel: branding ── -->
    <div class="sm-auth__left">
      <!-- circuit decoration -->
      <svg class="sm-circuit" viewBox="0 0 500 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g stroke="rgba(255,255,255,0.08)" stroke-width="1.5" fill="none">
          <line x1="60" y1="0" x2="60" y2="600"/>
          <line x1="200" y1="0" x2="200" y2="600"/>
          <line x1="350" y1="0" x2="350" y2="600"/>
          <line x1="480" y1="0" x2="480" y2="600"/>
          <line x1="0" y1="80" x2="500" y2="80"/>
          <line x1="0" y1="220" x2="500" y2="220"/>
          <line x1="0" y1="380" x2="500" y2="380"/>
          <line x1="0" y1="520" x2="500" y2="520"/>
          <!-- nodes -->
          <circle cx="60" cy="80" r="4" fill="rgba(226,74,25,0.4)" stroke="none"/>
          <circle cx="200" cy="220" r="4" fill="rgba(226,74,25,0.4)" stroke="none"/>
          <circle cx="350" cy="80" r="4" fill="rgba(226,74,25,0.4)" stroke="none"/>
          <circle cx="480" cy="380" r="4" fill="rgba(226,74,25,0.4)" stroke="none"/>
          <circle cx="60" cy="520" r="4" fill="rgba(226,74,25,0.4)" stroke="none"/>
          <circle cx="350" cy="380" r="6" fill="rgba(226,74,25,0.25)" stroke="rgba(226,74,25,0.5)" stroke-width="1.5"/>
          <circle cx="200" cy="520" r="6" fill="rgba(226,74,25,0.25)" stroke="rgba(226,74,25,0.5)" stroke-width="1.5"/>
        </g>
      </svg>

      <div class="sm-auth__left-content">
        <!-- Logo -->
        <div class="sm-auth__logo">
          <RouterLink to="/">
            <img :src="pranLogo" alt="prana" style="height:200px" />
          </RouterLink>
        </div>

        <div class="sm-auth__tagline">
          <h1>{{ t('login.title') }}</h1>
          <p>{{ t('login.subtitle') }}</p>
        </div>

        <!-- Feature pills -->
        <div class="sm-auth__features">
          <div class="sm-feature">
            <span class="sm-feature__icon">
              <Icon icon="tabler:bolt" />
            </span>
            <div>
              <div class="sm-feature__title">{{ t('login.energy_monitoring') }}</div>
              <div class="sm-feature__sub">{{ t('login.energy_sub') }}</div>
            </div>
          </div>
          <div class="sm-feature">
            <span class="sm-feature__icon sm-feature__icon--water">
              <Icon icon="tabler:droplet" />
            </span>
            <div>
              <div class="sm-feature__title">{{ t('login.water_monitoring') }}</div>
              <div class="sm-feature__sub">{{ t('login.water_sub') }}</div>
            </div>
          </div>
          <div class="sm-feature">
            <span class="sm-feature__icon sm-feature__icon--tele">
              <Icon icon="tabler:activity" />
            </span>
            <div>
              <div class="sm-feature__title">{{ t('login.telemetry') }}</div>
              <div class="sm-feature__sub">{{ t('login.telemetry_sub') }}</div>
            </div>
          </div>
        </div>

        <!-- Live status bar -->
        <div class="sm-auth__status">
          <span class="sm-status-dot"></span>
          <span>{{ t('login.platform_online') }} · {{ deviceCount.toLocaleString() }} {{ t('login.devices_connected') }}</span>
        </div>
      </div>
    </div>

    <!-- ── Right panel: form ── -->
    <div class="sm-auth__right">
      <div class="sm-auth__form-wrap">

        <div class="sm-auth__form-header">
          <h2>{{ t('login.sign_in') }}</h2>
          <p>{{ t('login.title') }}</p>
        </div>

        <BForm @submit.prevent="handleLogin">
          <BAlert v-if="error" variant="danger" :model-value="true" dismissible class="mb-4" @dismissed="error = ''">
            {{ error }}
          </BAlert>

          <div class="sm-field mb-4">
            <label for="userEmail">Email</label>
            <div class="sm-field__input-wrap">
              <Icon icon="tabler:mail" class="sm-field__icon" />
              <BFormInput
                id="userEmail"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                required
                class="sm-input"
              />
            </div>
          </div>

          <div class="sm-field mb-4">
            <div class="d-flex justify-content-between align-items-center">
              <label for="userPassword">{{ t('login.password') }}</label>
              <RouterLink to="/forgot-password" class="sm-link-forgot">{{ t('login.forgot_password') }}</RouterLink>
            </div>
            <div class="sm-field__input-wrap">
              <Icon icon="tabler:lock" class="sm-field__icon" />
              <BFormInput
                id="userPassword"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                required
                class="sm-input sm-input--pass"
              />
              <button type="button" class="sm-field__toggle" @click="showPassword = !showPassword" tabindex="-1">
                <Icon :icon="showPassword ? 'tabler:eye-off' : 'tabler:eye'" />
              </button>
            </div>
          </div>

          <div class="d-flex align-items-center mb-4">
            <BFormCheckbox id="keepSignedIn" v-model="keepSignedIn" class="sm-checkbox">
              {{ t('login.keep_signed') }}
            </BFormCheckbox>
          </div>

          <BButton type="submit" class="sm-btn-primary w-100 mb-4" :disabled="loading">
            <span v-if="loading" class="sm-spinner"></span>
            <Icon v-else icon="tabler:login" class="me-2" />
            {{ loading ? t('login.loading') : t('login.submit') }}
          </BButton>
        </BForm>

        <p class="sm-auth__register">
          {{ t('login.no_account') }}
          <RouterLink to="/register">{{ t('login.create_one') }}</RouterLink>
        </p>

        <div class="sm-auth__footer">
          © {{ currentYear }} prana. Todos os direitos reservados.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { currentYear } from '@/helpers'
import pranLogo from '@/assets/images/pranafinal_300px.svg'
import { usePageMeta } from '@/composables/usePageMeta.ts'
import { useAuthStore } from '@/stores/auth.ts'
import { useI18n } from 'vue-i18n'

usePageMeta('Sign In')

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const keepSignedIn = ref(false)
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const deviceCount = ref(2847)

async function handleLogin() {
  error.value = ''
  loading.value = true
  const result = await auth.login(email.value, password.value)
  if (result === 'ok') {
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } else if (result === 'new_password_required') {
    router.push({ name: 'new-password', query: { email: email.value } })
  } else {
    error.value = auth.error || 'Invalid email or password.'
  }
  loading.value = false
}
</script>

<style scoped>
/* ─── Layout ─────────────────────────────────────── */
.sm-auth {
  display: flex;
  min-height: 100vh;
}

/* ─── Left panel ─────────────────────────────────── */
.sm-auth__left {
  position: relative;
  width: 55%;
  background: linear-gradient(145deg, #017b56 0%, #2a7a1a 45%, #4a8c10 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 60px 56px;
}

.sm-circuit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.sm-auth__left-content {
  position: relative;
  z-index: 1;
  max-width: 480px;
  width: 100%;
}

.sm-auth__logo {
  margin-bottom: 48px;
  display: flex;
  justify-content: center;
}

.sm-auth__tagline h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.25;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
}

.sm-auth__tagline p {
  color: rgba(255,255,255,0.68);
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 40px;
}

/* Features */
.sm-auth__features {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 44px;
}

.sm-feature {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 16px 20px;
  backdrop-filter: blur(4px);
}

.sm-feature__icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(226,74,25,0.25);
  color: #e24a19;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.sm-feature__icon--water {
  background: rgba(144,210,236,0.25);
  color: #90d2ec;
}

.sm-feature__icon--tele {
  background: rgba(214,170,1,0.2);
  color: #d6aa01;
}

.sm-feature__title {
  color: #ffffff;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 2px;
}

.sm-feature__sub {
  color: rgba(255,255,255,0.5);
  font-size: 0.78rem;
}

/* Status bar */
.sm-auth__status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255,255,255,0.5);
  font-size: 0.78rem;
  margin-top: 24px;
}

.sm-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d6aa01;
  box-shadow: 0 0 0 0 rgba(214,170,1,0.6);
  animation: pulse-dot 2s infinite;
  flex-shrink: 0;
}

@keyframes pulse-dot {
  0%   { box-shadow: 0 0 0 0 rgba(214,170,1,0.6); }
  70%  { box-shadow: 0 0 0 8px rgba(214,170,1,0); }
  100% { box-shadow: 0 0 0 0 rgba(214,170,1,0); }
}

/* ─── Right panel ─────────────────────────────────── */
.sm-auth__right {
  width: 45%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f6f7fb;
  padding: 60px 48px;
}

.sm-auth__form-wrap {
  width: 100%;
  max-width: 380px;
}

.sm-auth__form-header {
  margin-bottom: 32px;
}

.sm-auth__form-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #017b56;
  margin-bottom: 6px;
}

.sm-auth__form-header p {
  color: #8a969c;
  font-size: 0.9rem;
}

/* Fields */
.sm-field label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: #343a40;
  margin-bottom: 8px;
  letter-spacing: 0.2px;
}

.sm-field__input-wrap {
  position: relative;
}

.sm-field__icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #a1a9b1;
  font-size: 17px;
  pointer-events: none;
  z-index: 1;
}

.sm-input {
  padding-left: 42px !important;
  height: 46px;
  border-radius: 10px !important;
  border-color: #e7e9eb !important;
  background: #ffffff !important;
  font-size: 0.9rem !important;
  transition: border-color 0.2s, box-shadow 0.2s !important;
}

.sm-input:focus {
  border-color: #e24a19 !important;
  box-shadow: 0 0 0 3px rgba(226,74,25,0.12) !important;
}

.sm-input--pass {
  padding-right: 46px !important;
}

.sm-field__toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #a1a9b1;
  font-size: 17px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
}

.sm-field__toggle:hover { color: #343a40; }

.sm-link-forgot {
  font-size: 0.78rem;
  color: #e24a19;
  text-decoration: none;
  font-weight: 500;
}
.sm-link-forgot:hover { text-decoration: underline; }

/* Checkbox */
.sm-checkbox :deep(.form-check-label) {
  font-size: 0.84rem;
  color: #6c757d;
}
.sm-checkbox :deep(.form-check-input:checked) {
  background-color: #017b56;
  border-color: #017b56;
}

/* Primary button */
.sm-btn-primary {
  height: 48px;
  background: linear-gradient(135deg, #e24a19 0%, #d6aa01 100%) !important;
  border: none !important;
  border-radius: 10px !important;
  font-weight: 600 !important;
  font-size: 0.9rem !important;
  letter-spacing: 0.3px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.2s, transform 0.15s !important;
}

.sm-btn-primary:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.sm-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Register & footer */
.sm-auth__register {
  text-align: center;
  font-size: 0.84rem;
  color: #8a969c;
  margin-bottom: 0;
}

.sm-auth__register a {
  color: #017b56;
  font-weight: 600;
  text-decoration: none;
}
.sm-auth__register a:hover { text-decoration: underline; }

.sm-auth__footer {
  text-align: center;
  font-size: 0.75rem;
  color: #a1a9b1;
  margin-top: 32px;
}

/* ─── Responsive ─────────────────────────────────── */
@media (max-width: 900px) {
  .sm-auth { flex-direction: column; }
  .sm-auth__left { width: 100%; padding: 48px 32px; }
  .sm-auth__right { width: 100%; padding: 48px 32px; }
  .sm-auth__tagline h1 { font-size: 1.5rem; }
}

@media (max-width: 480px) {
  .sm-auth__left { padding: 36px 20px; }
  .sm-auth__right { padding: 36px 20px; }
}
</style>
