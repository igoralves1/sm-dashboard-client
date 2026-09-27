/**
 * Lazy MathJax loader.
 *
 * The tex-svg bundle is close to a megabyte, and the formulas it renders live
 * inside collapsed "how this was calculated" panels that most visits never
 * open. Loading it on demand keeps it out of the initial bundle entirely, and
 * the promise is cached so the second formula on the page costs nothing.
 *
 * SVG output rather than CHTML: SVG needs no web fonts, so a formula cannot
 * flash in an unstyled fallback face, and it inherits `currentColor` — which
 * means the maths follows the dashboard's light/dark theme for free.
 *
 * The bundle is served from public/ and injected as a classic <script>, kept
 * entirely outside the module graph. Two separate problems force this:
 *
 *   1. It is an IIFE that locates its own assets through
 *      `document.currentScript`, which is null under an ES import — MathJax
 *      then cannot resolve its base path and startup never completes, leaving
 *      the raw \\[...\\] delimiters on screen.
 *   2. Importing it at all makes Vite crawl the package, where the speech
 *      worker's dynamic require fails to resolve and breaks the dev server.
 *
 * public/ is copied verbatim, so neither applies. Refresh the copy with:
 *   cp node_modules/mathjax/tex-svg.js public/vendor/mathjax/tex-svg.js
 */

declare global {
  interface Window {
    MathJax?: any
  }
}

/** Served from public/, so BASE_URL is required for the deployed sub-path. */
const BUNDLE_URL = `${import.meta.env.BASE_URL}vendor/mathjax/tex-svg.js`

let loader: Promise<void> | null = null

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('MathJax failed to load'))
    document.head.appendChild(script)
  })
}

export function loadMathJax(): Promise<void> {
  if (loader) return loader

  loader = (async () => {
    // Configuration has to exist before the bundle evaluates; MathJax reads it
    // at import time and ignores changes made afterwards.
    window.MathJax = {
      startup: { typeset: false },
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']],
      },
      svg: {
        fontCache: 'local',
        // Inherit the surrounding text colour so themes apply without a redraw.
        exFactor: 0.5,
      },
      options: {
        enableMenu: false,
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      },
    }

    await injectScript(BUNDLE_URL)

    // v4 swaps the global for {version, _, config} during boot, so the startup
    // object only appears after the script has evaluated.
    const startup = window.MathJax?.startup
    if (startup?.promise) await startup.promise
  })()

  return loader
}

/**
 * Typeset one element. Returns false when MathJax is unavailable, so the
 * caller can keep its plain-text fallback rather than leaving raw LaTeX on
 * screen.
 */
export async function typeset(el: HTMLElement): Promise<boolean> {
  try {
    await loadMathJax()

    const typesetPromise = window.MathJax?.typesetPromise
    if (typeof typesetPromise !== 'function') {
      console.warn('[mathjax] loaded but typesetPromise is unavailable', window.MathJax)
      return false
    }

    await typesetPromise([el])
    return true
  } catch (error) {
    console.warn('[mathjax] typeset failed', error)
    return false
  }
}
