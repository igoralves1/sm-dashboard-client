<template>
  <div class="btn-group btn-group-sm" role="group" :aria-label="t('energisa.harmonic_quantity')">
    <button
      v-for="opt in OPTIONS"
      :key="opt.value"
      type="button"
      class="btn"
      :class="modelValue === opt.value ? 'btn-primary' : 'btn-outline-secondary'"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ t(opt.label) }}
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * Which quantity the harmonic chart plots. Unlike the phase picker on the
 * other two panels, this selects voltage vs current — the spectrum always
 * covers all three phases.
 */
import { useI18n } from 'vue-i18n'
import type { HarmonicMode } from './HarmonicBars.vue'

const { t } = useI18n()

const OPTIONS: { value: HarmonicMode; label: string }[] = [
  { value: 'all', label: 'energisa.harmonic_all' },
  { value: 'voltage', label: 'Vca' },
  { value: 'current', label: 'Ica' },
]

defineProps<{ modelValue: HarmonicMode }>()
defineEmits<{ 'update:modelValue': [HarmonicMode] }>()
</script>
