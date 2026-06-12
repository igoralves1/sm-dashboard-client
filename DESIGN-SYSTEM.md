# DESIGN-SYSTEM.md — SIMEMAP UX/UI & Color Schema
# ⚡ AI REFERENCE FILE — read this before styling ANY page in this project.
# Apply these tokens/patterns consistently across all views. Do not invent new colors.

---

## 1. BRAND IDENTITY

| Token | Value | Usage |
|---|---|---|
| Brand gradient | `linear-gradient(135deg, #009ee0 0%, #303287 100%)` | Primary buttons, hero/left panels, brand surfaces |
| Brand blue (light end) | `#009ee0` | Gradient start, links on dark, accents, brush selection stroke |
| Brand indigo (dark end) | `#303287` | Gradient end, dark brand surfaces |
| Brand navy (text) | `#102a83` | Headings, links, checkbox checked state, primary text accents on light bg |
| Theme primary (INSPINIA base) | `#1ab394` (teal) | Legacy template `variant="primary"` fallback |
| Theme secondary | `#1c84c6` | Legacy template secondary |
| Favicon gradient | white `#ffffff` → `#a8d8f0`, 45° | Icon-only globe mark on dark tab bars |

### Logos
- Official logo SVG: `branding/simemap/logos/simemap-logo.svg` and `public/simemap-logo.svg`
- White version for dark backgrounds: `src/assets/images/simemap-logo-white.svg`
- Favicon: `public/favicon.svg` (globe only, white degradé, viewBox `322 144 212 212`, 36px)
- Fallback: `public/favicon.ico` (also `src/assets/images/favicon.ico`, injected by `usePageMeta` via `appFavicon` in `src/helpers/index.ts`)
- Full brand snapshot + color docs: `branding/simemap/` (see COLORS.md there)
- Preview playground: `preview-logo.html` (project root)
  - Full logo viewBox: `193 142 455 312` (tight, no waste)
  - Globe-only viewBox: `320 142 216 216` (square, tight)
- **NEVER use INSPINIA branding** ("in" icon, wrapbootstrap links). All removed; replace with SIMEMAP / https://simemap.com.br if found.

---

## 2. AUTH PAGES PALETTE (login / forgot-password / new-password)

Reference implementation: `src/views/auth/auth-1/sign-in/index.vue`

### Layout
- Split screen: left brand panel 55% (gradient), right form panel 45% (`#f6f7fb`)
- Stacks vertically below 900px
- Logo on left panel: white logo, `height:120px`, centered
- AuthLogo component (other auth pages): inline SVG `height="60"`

### Left panel (dark, gradient background)
| Element | Value |
|---|---|
| Background | `linear-gradient(135deg, #009ee0 0%, #303287 100%)` |
| H1 tagline | `#ffffff`, 2rem, 700, letter-spacing -0.5px |
| Subtitle text | `rgba(255,255,255,0.68)` |
| Feature pill background | `rgba(255,255,255,0.07)`, border `1px solid rgba(255,255,255,0.1)`, radius 12px, backdrop-filter blur(4px) |
| Pill title | `#ffffff`, 600, 0.9rem |
| Pill subtext | `rgba(255,255,255,0.5)`, 0.78rem |
| Status text | `rgba(255,255,255,0.5)`, 0.78rem |

### Feature-pill icon colors (bright accents on dark — NEVER navy on dark)
| Icon | Background | Color |
|---|---|---|
| Energy (lightning) | `rgba(255,200,60,0.18)` | `#ffd35c` gold |
| Water (droplet) | `rgba(120,220,255,0.18)` | `#7eddff` light blue |
| Telemetry (pulse) | `rgba(110,255,180,0.15)` | `#6effb4` mint |
| Icon box | 44×44px, radius 10px, font-size 22px |

### Status dot ("online" indicators)
- Green `#4ade80`, 8px, pulse animation ring `rgba(74,222,128,0.6)` → transparent, 2s infinite
- Online = green. Never navy/dark for state indicators on dark backgrounds.

### Circuit decoration (background SVG ornaments on dark panels)
- Grid lines: `stroke: rgba(255,255,255,0.08)`, width 1.5
- Small nodes (r=4): alternate `rgba(255,255,255,0.35)` and `rgba(168,216,240,0.4)`
- Large nodes (r=6): fill `rgba(168,216,240,0.18)`, stroke `rgba(168,216,240,0.45)`
- **Never warm/orange tones** on the blue gradient — stay in the white/light-blue scale.

### Right panel (light form side)
| Element | Value |
|---|---|
| Background | `#f6f7fb` |
| Card/page heading h2 | `#102a83`, 1.75rem, 700 |
| Sub-headings/help | `#8a969c`, 0.9rem |
| Field labels | `#343a40`, 0.82rem, 600 |
| Input | height 46px, radius 10px, border `#e7e9eb`, bg white, left icon `#a1a9b1` |
| Input focus | border `#102a83`, shadow `0 0 0 3px rgba(226,74,25,0.12)` |
| Primary button | brand gradient, height 48px, radius 10px, 600 weight; hover: opacity .92 + translateY(-1px) |
| Links | `#102a83`, 500–600 weight, underline on hover |
| Muted footer text | `#a1a9b1`, 0.75rem |
| Checkbox checked | `#102a83` |

### Footers
- Login: `© {{ currentYear }} SIMEMAP. {{ t('login.rights') }}`
- Forgot password: `© 2018 - {{ currentYear }} SIMEMAP — by SIMEMAP`
- `currentYear` from `@/helpers` — never hardcode the year.

---

## 3. DASHBOARD / CHART COLOR THRESHOLDS (apply EVERYWHERE)

| Level | Color | Hex |
|---|---|---|
| < 50% | Red | `#e84040` |
| 50–80% | Orange | `#f58b06` (TankGauge), `#f4954e` (LevelTimeSeries) |
| > 80% | Green | `#37872d` (TankGauge), `#73bf69` (LevelTimeSeries) |
| Water fill | Blue | `#178BCA` — always, regardless of level |
| Wave text | Light blue | `#A4DBf8` — always |

### Threshold dashed lines (LevelTimeSeries, dash `6,3`)
- 25% → `#e84040` · 50% → `#f4954e` · 75% → `#73bf69` · 100% → `#73bf69`

### FlowTimeSeries series colors
- PTP_01 `#fade2a` · PTP_02 `#ff9830` · PTP_03 `#5794f2` · PTP_04 `#73bf69` · PTP_07 `#f2495c`

### Chart brush-to-zoom selection (all charts)
```css
.chart-brush .overlay   { cursor: crosshair; }
.chart-brush .selection { fill: rgba(0,158,224,0.12); stroke: #009ee0;
                          stroke-width: 1; stroke-dasharray: 4,2; }
.chart-brush .handle    { fill: none; }
```
Chart colors centralized in the `useChartTheme` composable — use it, don't hardcode.

---

## 4. UX PATTERNS & CONVENTIONS

### Internationalization (MANDATORY for all user-facing strings)
- 4 locales: `src/locales/{en,pt,fr,es}.json` — every new string goes in ALL FOUR
- Use `const { t } = useI18n()` + `{{ t('section.key') }}` in templates
- Existing sections: `nav`, `topbar`, `data`, `megamenu`, `login`, `forgot`, `new_password`, `dashboard`, `monitoring`, `activity`, `spc`
- Locale persistence key: `simemap_locale_v1` (localStorage, via `useLocale` composable)
- Locale priority: localStorage override → IP geolocation → browser language → EN
- Brand names, emails, URLs, "SIMEMAP" are NOT translated

### Storage keys
- All prefixed `simemap_*` (locale, geo, sessions, alerts, activity)

### Page meta
- Every view calls `usePageMeta('Page Title')` — sets title, description, favicon

### Typography & shape language
- Sans-serif system stack (Bootstrap default)
- Border radius: cards 12px (rounded-4 on auth cards), inputs/buttons 10px
- Buttons: gradient primary, 600 weight, subtle hover lift (translateY(-1px))
- Spinner: 16px, 2px border, white-on-transparent, 0.7s spin

### Interaction
- Charts: drag = brush-to-zoom rectangle; scroll wheel = zoom; legend click = toggle series
- Auto-refresh: 300s (`REFRESH_SECS` in `useTimestreamDashboard.ts`), countdown arc widget
- Tooltips on charts follow crosshair; hidden during brushing

### Accessibility / contrast rules of thumb
- On gradient/dark surfaces: white or bright pastels only (`#ffd35c`, `#7eddff`, `#6effb4`, `#a8d8f0`); minimum `rgba(255,255,255,0.5)` for secondary text
- On light surfaces: navy `#102a83` for emphasis, `#343a40` body, `#8a969c`/`#a1a9b1` muted
- State colors: success/online green `#4ade80`, danger `#e84040`, warning `#f58b06`

---

## 5. FILES THAT DEFINE THE LOOK (quick map)

```
src/views/auth/auth-1/sign-in/index.vue      ← canonical auth styling (scoped CSS)
src/views/auth/auth-1/reset-password/index.vue ← forgot-password (i18n'd)
src/components/AuthLogo.vue                  ← shared auth logo (inline SVG, height 60)
src/composables/useChartTheme.ts             ← centralized chart colors
src/composables/useLocale.ts                 ← locale resolution
src/locales/{en,pt,fr,es}.json               ← translations
src/assets/scss/_theme-classic.scss          ← global theme (prana blocks removed)
branding/simemap/                            ← brand assets + COLORS.md
public/favicon.svg                           ← globe favicon (white degradé)
preview-logo.html                            ← logo/favicon visual playground
```

---

## 6. DO / DON'T CHEAT SHEET

✅ DO
- Use the brand gradient for primary CTAs and brand panels
- Use bright pastel accents on dark, navy on light
- Route every string through i18n (4 locales)
- Reuse `.sm-*` class patterns from sign-in when building new auth-style pages
- Use `currentYear` from `@/helpers` for copyright lines

❌ DON'T
- Use INSPINIA branding, wrapbootstrap links, or the "in" icon
- Put navy `#102a83` icons/text on the dark gradient (invisible)
- Use warm orange/rust decorative dots on blue surfaces
- Hardcode chart colors (use `useChartTheme`) or years or user-facing strings
- Create new color values when a token above fits
