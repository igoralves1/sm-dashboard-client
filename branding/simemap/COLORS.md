# SIMEMAP — Brand Assets & Color Scheme

Snapshot of all SIMEMAP branding as used on the `main`/`simemap` branches.
Source of truth for colors: `src/assets/scss/_variables.scss`.

---

## Logos

| File | Usage |
|---|---|
| `logos/logo.png` | Full logo, light backgrounds (topbar/sidebar) |
| `logos/logo-black.png` | Full logo, dark text variant |
| `logos/logo-white.png` | Full logo, white variant for dark backgrounds |
| `logos/logo-sm.png` | Small/collapsed sidebar icon |
| `logos/favicon.ico` | Browser favicon |

## SVG assets

| File | Usage |
|---|---|
| `svg/water-tank.svg` | Animated water tank (CSS keyframe waves) — dashboard gauge |
| `svg/tank.svg` | Public copy of water-tank.svg (kept in sync) |

---

## Theme colors (Bootstrap theme map)

| Role | Variable | Hex |
|---|---|---|
| Primary | `$primary` (= `$teal`) | `#1ab394` |
| Secondary | `$secondary` (= `$blue`) | `#1c84c6` |
| Success | `$success` (= `$green`) | `#0acf97` |
| Info | `$info` (= `$cyan`) | `#23c6c8` |
| Warning | `$warning` (= `$yellow`) | `#f8ac59` |
| Danger | `$danger` (= `$red`) | `#ed5565` |
| Purple | `$purple` | `#7b70ef` |
| Light | `$light` (= `$gray-200`) | `#eef2f7` |
| Dark | `$dark` (= `$gray-900`) | `#313a46` |

## Base palette

| Variable | Hex |
|---|---|
| `$blue` | `#1c84c6` |
| `$indigo` | `#6b5eae` |
| `$purple` | `#7b70ef` |
| `$pink` | `#ff679b` |
| `$red` | `#ed5565` |
| `$orange` | `#fd7e14` |
| `$yellow` | `#f8ac59` |
| `$green` | `#0acf97` |
| `$teal` | `#1ab394` |
| `$cyan` | `#23c6c8` |
| `$gray-200` | `#eef2f7` |
| `$gray-900` | `#313a46` |

---

## Dashboard chart colors (thresholds)

Applied consistently across TankGauge, LevelTimeSeries, FlowTimeSeries:

| Level | Color | Hex |
|---|---|---|
| < 50% (Critical) | Red | `#e84040` |
| 50–80% (Alert) | Orange | `#f58b06` (gauge) / `#f4954e` (line/dot) |
| > 80% (OK) | Green | `#37872d` (gauge) / `#73bf69` (line) |
| Water fill | Blue | `#178BCA` — always, regardless of level |
| Wave text | Light blue | `#A4DBf8` — always |

**Threshold dashed lines (LevelTimeSeries):** 25% `#e84040` · 50% `#f4954e` · 75% `#73bf69` · 100% `#73bf69` (dash `6,3`)

**FlowTimeSeries line colors:** PTP_01 `#fade2a` · PTP_02 `#ff9830` · PTP_03 `#5794f2` · PTP_04 `#73bf69` · PTP_07 `#f2495c`

**Water tank SVG waves:** wave A `#1a6aa0` · wave B `#3a9ad4` · wave C `#70c8f0`
