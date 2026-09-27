<template>
  <div class="photo">
    <template v-if="src && !failed">
      <img
        :src="src"
        :alt="alt"
        class="photo__img"
        loading="lazy"
        decoding="async"
        @error="failed = true"
      />
      <button type="button" class="photo__expand" :title="t('energisa.photo_expand')" @click="expanded = true">
        <Icon icon="tabler:arrows-maximize" width="14" height="14" />
      </button>
    </template>

    <div v-else class="photo__empty">
      <Icon icon="tabler:photo-off" width="18" height="18" />
      <span>{{ t('energisa.photo_missing') }}</span>
    </div>

    <Teleport to="body">
      <div v-if="expanded" class="photo-modal" role="dialog" @click.self="expanded = false">
        <div class="photo-modal__box">
          <header class="photo-modal__head">
            <div class="photo-modal__title">{{ name }}</div>
            <button type="button" class="photo-modal__close" :aria-label="t('energisa.cancel')" @click="expanded = false">
              <Icon icon="tabler:x" width="18" height="18" />
            </button>
          </header>
          <img :src="src" :alt="alt" class="photo-modal__img" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * Field photograph of the transformer.
 *
 * Files are matched by device name, not by id: the asset for
 * "5707234122 Vision Residence" is `5707234122-Vision-Residence.png`. Spaces
 * become hyphens and accents are folded, so a name typed with "ç" or "ã" in
 * the device registry still resolves to an ASCII filename.
 *
 * Missing photos are the normal case — most units will not have one — so a
 * failed load falls back to a quiet placeholder rather than a broken image.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

const props = defineProps<{ name?: string }>()

const failed = ref(false)
const expanded = ref(false)

/** "5707234122 Vision Residence" → "5707234122-Vision-Residence" */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    // Strip combining marks: "Silvanópolis" → "Silvanopolis".
    .replace(/[̀-ͯ]/g, '')
    .trim()
    // Any run of whitespace collapses to a single hyphen.
    .replace(/\s+/g, '-')
    // Drop anything a filename should not carry, keeping hyphens and dots.
    .replace(/[^A-Za-z0-9._-]/g, '')
}

const src = computed(() => {
  if (!props.name) return ''
  const slug = slugify(props.name)
  if (!slug) return ''
  // BASE_URL matters: the app is served from /sm-dashboard-client/, so a
  // root-relative path would 404 in production.
  return `${import.meta.env.BASE_URL}images/pole-transformers/${slug}.png`
})

const alt = computed(() => props.name ?? '')

// A different device may well have a photo where this one did not.
watch(src, () => (failed.value = false))
</script>

<style scoped>
.photo {
  position: relative;
  height: 100%;
  min-height: 118px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bs-tertiary-bg, rgb(0 0 0 / 0.03));
}

.photo__img {
  width: 100%;
  height: 100%;
  min-height: 118px;
  /* Fill the frame the map defines, cropping rather than letterboxing so the
     two panels read as a matched pair. */
  object-fit: cover;
  object-position: center;
  display: block;
}

.photo__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 100%;
  min-height: 118px;
  padding: 0.5rem;
  font-size: 11px;
  text-align: center;
  color: var(--bs-secondary-color);
  border: 1px dashed var(--bs-border-color);
  border-radius: 6px;
}

.photo__expand {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--bs-border-color);
  border-radius: 5px;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  cursor: pointer;
}

.photo__expand:hover { color: var(--bs-primary); border-color: var(--bs-primary); }

/* ---- expanded ---- */
.photo-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 0.45);
  padding: 1rem;
}

.photo-modal__box {
  width: min(720px, 100%);
  background: var(--bs-body-bg);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgb(0 0 0 / 0.3);
}

.photo-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--bs-border-color);
}

.photo-modal__title { font-size: 14px; font-weight: 600; }

.photo-modal__close {
  border: none;
  background: none;
  color: var(--bs-secondary-color);
  cursor: pointer;
  padding: 0.2rem;
  line-height: 0;
}

.photo-modal__close:hover { color: var(--bs-body-color); }

.photo-modal__img {
  display: block;
  width: 100%;
  max-height: min(70vh, 600px);
  object-fit: contain;
  background: var(--bs-tertiary-bg, rgb(0 0 0 / 0.03));
}
</style>
