<template>
  <div class="topbar-item d-flex align-items-center gap-1">
    <button
      v-for="lang in languages"
      :key="lang.code"
      class="lang-btn"
      :class="{ 'lang-btn--active': locale === lang.code }"
      :title="lang.name"
      @click="setLocale(lang.code as 'en' | 'pt')"
    >
      <img :src="lang.flag" :alt="lang.name" class="lang-flag" />
      <span class="lang-code">{{ lang.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useLocale } from '@/composables/useLocale'
import usFlag from '@/assets/images/flags/us.svg'
import brFlag from '@/assets/images/flags/br.svg'

const { locale, setLocale } = useLocale()

const languages = [
  { code: 'en', name: 'English', label: 'EN', flag: usFlag },
  { code: 'pt', name: 'Português', label: 'PT', flag: brFlag },
]
</script>

<style scoped>
.lang-btn {
  display: flex; align-items: center; gap: 5px;
  background: transparent; border: 1.5px solid transparent;
  border-radius: 6px; padding: 3px 7px; cursor: pointer;
  transition: background .15s, border-color .15s;
  color: inherit;
}
.lang-btn:hover { background: rgba(128,128,128,.12); }
.lang-btn--active {
  border-color: var(--bs-primary, #4c60df);
  background: rgba(76, 96, 223, .08);
}
.lang-flag { width: 20px; height: 14px; border-radius: 3px; object-fit: cover; }
.lang-code { font-size: 12px; font-weight: 600; letter-spacing: .04em; }
</style>
