<template>
  <div class="btn-group btn-group-sm" role="group" :aria-label="t('energisa.select_phase')">
    <button
      type="button"
      class="btn"
      :class="modelValue === null ? 'btn-primary' : 'btn-outline-secondary'"
      @click="$emit('update:modelValue', null)"
    >
      Trif
    </button>
    <button
      v-for="ch in [1, 2, 3]"
      :key="ch"
      type="button"
      class="btn"
      :class="modelValue === ch ? 'btn-primary' : 'btn-outline-secondary'"
      @click="$emit('update:modelValue', ch)"
    >
      {{ ['A', 'B', 'C'][ch - 1] }}
    </button>
  </div>
</template>

<script setup lang="ts">
/** Phase selector shared by the three waveform panels: all three, or one. */
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineProps<{ modelValue: number | null }>()
defineEmits<{ 'update:modelValue': [number | null] }>()
</script>
