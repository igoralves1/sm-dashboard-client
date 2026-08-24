<template>
  <div class="range-picker" ref="rootRef">
    <button
      type="button"
      class="range-trigger"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span class="range-trigger__text">{{ label }}</span>
      <Icon icon="tabler:chevron-down" width="14" height="14" class="range-trigger__caret" :class="{ 'is-open': open }" />
    </button>

    <div v-if="open" class="range-popover" role="dialog" :aria-label="t('energisa.select_range')">
      <div class="range-presets">
        <button v-for="p in PRESETS" :key="p.label" type="button" class="preset" @click="applyPreset(p.days)">
          {{ t(p.label) }}
        </button>
      </div>

      <label class="range-field">
        <span>{{ t('energisa.start') }}</span>
        <input v-model="draftStart" type="datetime-local" class="form-control form-control-sm" />
      </label>

      <label class="range-field">
        <span>{{ t('energisa.end') }}</span>
        <input v-model="draftEnd" type="datetime-local" class="form-control form-control-sm" />
      </label>

      <p v-if="invalid" class="range-error">{{ t('energisa.range_invalid') }}</p>

      <div class="range-actions">
        <button type="button" class="btn btn-sm btn-link text-decoration-none" @click="close">{{ t('energisa.cancel') }}</button>
        <button type="button" class="btn btn-sm btn-primary" :disabled="invalid" @click="apply">{{ t('energisa.apply') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Interval selector for "Leituras por intervalo".
 *
 * Shows the active range the way the production page does —
 * "22/08/26 00:00 - 22/08/26 23:59" — and opens a popover to change it.
 * Presets cover the common cases; the datetime inputs handle the rest.
 */
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

const props = defineProps<{ start: Date; end: Date }>()
const emit = defineEmits<{ change: [start: Date, end: Date] }>()

const PRESETS = [
  { label: 'energisa.today', days: 0 },
  { label: 'energisa.yesterday', days: 1 },
  { label: 'energisa.last_7', days: 7 },
  { label: 'energisa.last_30', days: 30 },
] as const

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const draftStart = ref('')
const draftEnd = ref('')

const pad = (n: number) => String(n).padStart(2, '0')

/** "22/08/26 00:00" — two-digit year, as the production label uses. */
function display(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local wants local time in ISO-ish form, never toISOString (UTC). */
function toInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const label = computed(() => `${display(props.start)} - ${display(props.end)}`)

const parsed = computed(() => ({
  start: draftStart.value ? new Date(draftStart.value) : null,
  end: draftEnd.value ? new Date(draftEnd.value) : null,
}))

const invalid = computed(() => {
  const { start, end } = parsed.value
  if (!start || !end) return true
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start
})

function syncDraft() {
  draftStart.value = toInput(props.start)
  draftEnd.value = toInput(props.end)
}

function toggle() {
  open.value ? close() : openPopover()
}

function openPopover() {
  syncDraft()
  open.value = true
}

function close() {
  open.value = false
}

function applyPreset(days: number) {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

  // "Ontem" is that single day, not a two-day window.
  if (days === 1) end.setDate(end.getDate() - 1)

  draftStart.value = toInput(start)
  draftEnd.value = toInput(end)
}

function apply() {
  const { start, end } = parsed.value
  if (!start || !end || invalid.value) return
  emit('change', start, end)
  close()
}

function onDocumentClick(event: MouseEvent) {
  if (open.value && rootRef.value && !rootRef.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

watch(() => [props.start, props.end], syncDraft)

onMounted(() => {
  syncDraft()
  document.addEventListener('mousedown', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.range-picker { position: relative; display: inline-block; }

.range-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.7rem;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--bs-body-color);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  cursor: pointer;
}

.range-trigger:hover { border-color: var(--bs-primary); }
.range-trigger:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 1px; }

.range-trigger__caret { transition: transform 0.15s ease; color: var(--bs-secondary-color); }
.range-trigger__caret.is-open { transform: rotate(180deg); }

.range-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  min-width: 260px;
  padding: 0.85rem;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.range-presets { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.preset {
  font-size: 12px;
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--bs-border-color);
  background: transparent;
  color: var(--bs-body-color);
  cursor: pointer;
}

.preset:hover { border-color: var(--bs-primary); color: var(--bs-primary); }

.range-field { display: flex; flex-direction: column; gap: 0.2rem; }

.range-field span {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bs-secondary-color);
}

.range-error { margin: 0; font-size: 11.5px; color: var(--bs-danger); }

.range-actions { display: flex; justify-content: flex-end; gap: 0.35rem; }
</style>
