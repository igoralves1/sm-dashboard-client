<template>
  <div class="formula">
    <!--
      Two separate elements on purpose. `mathEl` is written to imperatively by
      MathJax, so Vue must never own its children: v-show only toggles a style,
      whereas v-if would patch the subtree and wipe the rendered SVG.
    -->
    <div ref="mathEl" v-show="rendered" class="formula__math"></div>
    <span v-show="!rendered" class="formula__fallback">{{ fallback }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Renders one TeX expression through MathJax.
 *
 * Typesetting is deferred until the element is actually on screen: these sit
 * inside collapsed panels, and typesetting a hidden element makes MathJax
 * measure against a zero-width container and lay the formula out wrongly.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { typeset } from '@/utils/mathjax'

const props = defineProps<{
  /** LaTeX source, without delimiters. */
  tex: string
  /** Plain-text equivalent, shown until MathJax is ready. */
  fallback?: string
}>()

const mathEl = ref<HTMLElement | null>(null)
const rendered = ref(false)
let observer: IntersectionObserver | null = null

async function render() {
  const el = mathEl.value
  if (!el || !props.tex) return

  el.textContent = `\\[${props.tex}\\]`

  const ok = await typeset(el)
  if (ok) {
    rendered.value = true
  } else {
    // Leave the plain-text fallback in place rather than showing raw LaTeX.
    el.textContent = ''
  }
}

function observe() {
  const el = mathEl.value
  if (!el) return

  // offsetParent is null while an ancestor <details> is closed.
  if (el.offsetParent !== null) {
    void render()
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer?.disconnect()
      observer = null
      void render()
    }
  })
  observer.observe(el)
}

watch(
  () => props.tex,
  async () => {
    rendered.value = false
    await nextTick()
    if (mathEl.value?.offsetParent !== null) void render()
  },
)

onMounted(() => nextTick(observe))
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.formula {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.45rem 0.55rem;
  border-radius: 4px;
  background: var(--bs-tertiary-bg, rgb(0 0 0 / 0.035));
  /* SVG output inherits this, so the maths follows the theme. */
  color: var(--bs-body-color);
  font-size: 12px;
  line-height: 1.5;
}

.formula__fallback {
  font-family: var(--bs-font-monospace, monospace);
  font-size: 10.5px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--bs-secondary-color);
}

/* MathJax centres display math; left-align it to sit under the labels. */
:deep(mjx-container[display='true']) {
  margin: 0 !important;
  text-align: left;
}

:deep(mjx-container) { min-width: 0 !important; }
:deep(mjx-container svg) { vertical-align: middle; }
</style>
