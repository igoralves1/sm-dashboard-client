# CLAUDE.md — sm-dashboard-client
# ⚡ READ THIS FIRST — avoids scanning the codebase to find things

---

## 0. MANDATORY BEHAVIOR — ALWAYS FOLLOW THIS

### Before doing ANYTHING, show this block:

```
📋 PLAN
═══════════════════════════════════════════════
GOAL        : <one sentence summary of what user asked>
─────────────────────────────────────────────
STEPS       :
  1. <step description>
  2. <step description>
  ...
─────────────────────────────────────────────
FILES TO READ (tokens loaded):
  • path/to/file.ts          ← reason why
  • path/to/component.vue    ← reason why
─────────────────────────────────────────────
FILES TO EDIT:
  • path/to/file.ts          ← what will change
─────────────────────────────────────────────
FILES ALREADY IN CONTEXT (no reload needed):
  • path/to/file.ts
─────────────────────────────────────────────
TOKEN COST ESTIMATE:
  Input  : ~X,XXX tokens  (files read + conversation history)
  Output : ~X,XXX tokens  (response + code generated)
  Total  : ~X,XXX tokens
  Budget : Sonnet has ~200k context window. This session used ~XX%
═══════════════════════════════════════════════
Proceed? (or type corrections before I start)
```

**Then wait for user confirmation OR proceed immediately if the user said "do it" / "yes" / "go".**

### Rules:
- NEVER read a file that is already in context — say "already in context" instead
- NEVER read a file just to verify — trust the plan
- NEVER read a file that is fully described in this CLAUDE.md — use the description here
- If a task needs 0 file reads → say "no files to load, all info from CLAUDE.md"
- Always say which section of CLAUDE.md answered the question (e.g. "→ see §5 PTP formulas")

---

## 1. PROJECT IDENTITY

| Key | Value |
|---|---|
| App name | SM Dashboard Client |
| Project | HidroForte — real-time IoT water monitoring |
| Stack | Vue 3 + TypeScript + Vite + D3.js v7 |
| Auth | AWS Cognito User Pool |
| Data | AWS Timestream (direct browser queries, no backend) |
| Deploy | GitHub Pages via GitHub Actions |
| Live URL | https://igoralves1.github.io/sm-dashboard-client/ |
| Local URL | http://localhost:5173/sm-dashboard-client/ |
| Repo | https://github.com/igoralves1/sm-dashboard-client |

---

## 2. AWS RESOURCES

| Resource | ID |
|---|---|
| Account | `650254791912` (dev-sm) |
| Region | `us-east-2` |
| CLI Profile | `dev-sm` (SSO via `https://simemapdevices.awsapps.com/start`) |
| Cognito User Pool | `<USER_POOL_ID>` |
| Cognito App Client | `539e63bnkpnnbvjfsq3fan44mc` |
| Cognito Identity Pool | `us-east-2:b6dd06c9-347f-4287-a77b-838592d05fb7` |
| Timestream DB | `HidroForte` |
| Timestream Table (realtime) | `<TABLE_RT>` |
| Timestream Table (hourly) | `<TABLE_HOURLY>` |
| Timestream Table (daily) | `<TABLE_DAILY>` |

**AWS CLI commands:**
```bash
aws sso login --profile dev-sm           # login (every 4h)
aws sts get-caller-identity --profile dev-sm  # verify
```

---

## 3. FILE MAP — go directly to these, never scan

### Core App
```
index.html                        ← window.global = window polyfill (MUST NOT REMOVE)
vite.config.ts                    ← define:{global:'globalThis'} + optimizeDeps for AWS SDK
src/main.ts                       ← app entry
src/router/index.ts               ← routes, silent token refresh, redirect /login → /dashboard
src/stores/auth.ts                ← Cognito auth (Pinia). login/logout/refresh/newPassword
```

### Dashboard
```
src/views/dashboards/dashboard-sm/index.vue   ← MAIN dashboard (Silvanópolis + Miranorte)
src/views/auth/auth-1/sign-in/index.vue       ← Login page → redirects to /dashboard
src/views/auth/auth-1/set-new-password/index.vue  ← First-login password change
src/layouts/components/data.ts                ← Sidebar menu (only Dashboard v.2 + HidroForte SM)
```

### Chart Components (`src/components/charts/`)
```
TankGauge.vue          ← D3 liquid fill gauge with wave animation
LevelTimeSeries.vue    ← Time series with threshold lines + crosshair tooltip
FlowTimeSeries.vue     ← Multi-line PTP flow chart + tooltip
ProductionBar.vue      ← Grouped bar chart (24h / daily) + hover tooltip
SiteMap.vue            ← Leaflet + OpenStreetMap map widget
RefreshCountdown.vue   ← D3 arc countdown timer (60s cycle)
```

### Data & Logic
```
src/composables/useTimestreamDashboard.ts   ← ALL Timestream queries + PTP formulas + refresh
src/composables/useDashboardLogger.ts       ← Snapshot logger + JSON export button
```

### Assets
```
src/assets/images/water-tank.svg   ← Animated SVG water tank (CSS keyframe waves)
public/tank.svg                    ← Copy of water-tank.svg (keep in sync)
public/tank-preview.html           ← Standalone browser preview for SVG tank
```

### CI/CD
```
.github/workflows/deploy.yml       ← GitHub Actions: build + deploy to gh-pages
.envrc                             ← direnv: export AWS_PROFILE=dev-sm
.claude/settings.json              ← per-project: AWS_PROFILE=dev-sm
.claude/hidroforte-dashboard-plan.md  ← FULL PLAN: all queries, formulas, mappings
```

---

## 4. SENSOR MAPPING (end_id values in Timestream)

| Sensor | end_id | Location | Chart |
|---|---|---|---|
| RAP_Silvanopolis | `smc01ow` | Silvanópolis — reservoir | Tank gauge, Level chart |
| PTP_01 | `smca4vh` | Silvanópolis — pump 1 | Flow, Production |
| PTP_02 | `smc9pg7` | Silvanópolis — pump 2 | Flow, Production |
| PTP_03 | `smc25ku` | Silvanópolis — pump 3 | Flow, Production |
| PTP_04 | `smc0qvb` | Silvanópolis — pump 4 | Flow, Production |
| RAP_Miranorte | `smcait1` | Miranorte — reservoir | Tank gauge, Level chart |
| PTP_07 | `smccsl0` | Miranorte — pump 7 | Flow, Production |

---

## 5. PTP CALIBRATION FORMULAS

Cutoff: `2026-05-02T18:35:00Z` → before=`pre`, after=`post`

| end_id | Sensor | pre formula | post formula |
|---|---|---|---|
| `smca4vh` | PTP_01 | `(measure_value::double)*2/1000` | `measure_value::double/(12.0*1000)` |
| `smc9pg7` | PTP_02 | `(measure_value::double)*2*12/(108*1000)` | `measure_value::double/(108.0*1000)` |
| `smc25ku` | PTP_03 | `measure_value::double/1000` | `measure_value::double/(2*12.0*1000)` |
| `smc0qvb` | PTP_04 | `measure_value::double/1000` | `measure_value::double/(2*12.0*1000)` |
| `smccsl0` | PTP_07 | `(measure_value::double)*2/1000` | `measure_value::double/(12.0*1000)` |

Level calibration cutoff (Silvanópolis only): `2026-05-05T12:15:00Z`

---

## 6. COLOR THRESHOLDS (apply EVERYWHERE consistently)

| Level | Color | Hex |
|---|---|---|
| < 50% | Red | `#e84040` (ring/line), `#e84040` (TankGauge circleColor) |
| 50–80% | Orange | `#f58b06` (TankGauge), `#f4954e` (LevelTimeSeries line/dot), `#f58b06` (FlowTimeSeries) |
| > 80% | Green | `#37872d` (TankGauge), `#73bf69` (LevelTimeSeries) |
| Water fill | Blue | `#178BCA` — ALWAYS, regardless of level |
| Wave text | Light blue | `#A4DBf8` — ALWAYS |

**Threshold dashed lines on LevelTimeSeries:**
- 25% → `#e84040` (red, dash `6,3`)
- 50% → `#f4954e` (orange, dash `6,3`)
- 75% → `#73bf69` (green, dash `6,3`)
- 100% → `#73bf69` (green, dash `6,3`)

**FlowTimeSeries line colors:**
- PTP_01 → `#fade2a`
- PTP_02 → `#ff9830`
- PTP_03 → `#5794f2`
- PTP_04 → `#73bf69`
- PTP_07 → `#f2495c`

---

## 7. AUTH FLOW

```
User visits app → /login (default)
  → enter email + password
  → Cognito authenticates
     ├─ NEW_PASSWORD_REQUIRED → /new-password (forced change, first login only)
     └─ SUCCESS → tokens stored in Pinia (persist: accessToken, idToken, refreshToken, tokenExpiry, user)
  → redirect to /dashboard (NOT /dashboard-sm)

Token expires after 30 minutes:
  → router silently calls refreshSession()
  → on failure → redirect to /login
```

**Cognito logins key for Identity Pool:**
`cognito-idp.us-east-2.amazonaws.com/<USER_POOL_ID>`

---

## 8. DASHBOARD LAYOUT (dashboard-sm/index.vue)

### Silvanópolis section
```
Row 1: [col-lg-3 TankGauge] [col-lg-6 LevelTimeSeries] [col-lg-3 SiteMap]
Row 2: [col-12 FlowTimeSeries (all 5 PTPs)]
Row 3: [col-lg-6 ProductionBar 24h] [col-lg-6 ProductionBar daily]
```

### Miranorte section
```
Row 1: [col-lg-3 TankGauge] [col-lg-9 LevelTimeSeries]
```

Map marker: lat `-11.15430944152578`, lng `-48.172973779141344`, label `RAP01 Silvanópolis`

Auto-refresh: every 60 seconds (`REFRESH_SECS = 60`), countdown via `secondsLeft` ref

---

## 9. KNOWN ISSUES & POLYFILLS

| Issue | Fix | File |
|---|---|---|
| `global is not defined` (amazon-cognito-identity-js) | `window.global = window` script tag | `index.html` |
| Build fails with `@aws-sdk/credential-providers` | That package is Node-only. Use `@aws-sdk/credential-provider-cognito-identity` instead | — |
| Vite build fails for AWS SDK | `define: { global: 'globalThis' }` + `optimizeDeps.include` | `vite.config.ts` |
| TankGauge color not updating | `colorBand()` detects threshold cross (50, 80) → full `loadGauge()` redraw | `TankGauge.vue` |
| clipPath collision on multiple TankGauge instances | unique `gaugeId` per instance: `liquid-gauge-N-xxxxx` | `TankGauge.vue` |

---

## 10. WATER TANK SVG STRUCTURE (water-tank.svg)

Layers from bottom to top:
1. Ground ellipse (`#groundGrad`)
2. Drop shadow (black ellipse)
3. Body cylinder (`#bodyGrad`) — flat sides + curved bottom via `<path>`
4. Bottom ellipse cap
5. Water fill rect (50% height) — `#waterFillGrad` horizontal
6. Water depth darkening — `#waterDepthGrad` vertical overlay
7. Wave A (dark, 4s, `#1a6aa0`)
8. Wave B (lighter, 3s, `#3a9ad4`)
9. Wave C (bright crest, 2.2s, `#70c8f0`)
10. Caustic light patches (3 animated ellipses)
11. Water surface ellipse (`#waterSurfaceGrad`, class `surface` — bobs 3.5s)
12. Highlight streak (class `streak` — shifts 4s)
13. Body reflection (white ellipse, opacity 0.035)
14. Top surface flat concrete (`#topGrad`)
15. Top surface texture rings (4 concentric ellipses)
16. Top rim stroke (`#rimGrad`)
17. Gold outer railing ellipse
18. Gold inner railing ellipse
19. Railing vertical posts (9 lines)
20. Rail highlight
21. Body specular rect

CSS animations: `waveA`, `waveB`, `waveC`, `surfaceBob`, `streakShift`, `causticA/B/C`

---

## 11. DEV COMMANDS

```bash
npm run dev          # start dev server → localhost:5173/sm-dashboard-client/
npm run build        # production build → /dist
npm run type-check   # vue-tsc --build

git add src/ index.html vite.config.ts  # stage relevant files
git push origin main                     # triggers GH Actions deploy
```

**Preview SVG tank:**
http://localhost:5173/sm-dashboard-client/tank-preview.html

---

## 12. TOKEN REFERENCE — COST ESTIMATES PER ACTION

### How tokens work
- **1 token ≈ 4 characters** of English text
- Every message sends the ENTIRE conversation history + system prompt to the model
- MCPs inject their full instructions on EVERY turn (even if you never use them)
- Claude Sonnet context window: ~200,000 tokens (~800KB of text)

### Cost per file in this project (approximate)

| File | Tokens | Notes |
|---|---|---|
| `useTimestreamDashboard.ts` | ~1,800 | biggest file — avoid re-reading |
| `TankGauge.vue` | ~1,200 | complex D3 code |
| `dashboard-sm/index.vue` | ~900 | dashboard layout |
| `LevelTimeSeries.vue` | ~750 | chart component |
| `FlowTimeSeries.vue` | ~700 | chart component |
| `water-tank.svg` | ~650 | SVG with CSS animations |
| `auth.ts` | ~600 | auth store |
| `ProductionBar.vue` | ~500 | chart component |
| `SiteMap.vue` | ~300 | map component |
| `RefreshCountdown.vue` | ~250 | countdown |
| `router/index.ts` | ~400 | router |
| `README.md` | ~1,500 | long doc |
| `CLAUDE.md` (this file) | ~2,500 | always in context once read |

### Cost per session source (approximate)

| Source | Tokens per turn | Can eliminate? |
|---|---|---|
| Conversation history (after 10 turns) | ~8,000–40,000 | ✅ `/compact` or new session |
| System prompt (Claude Code base) | ~3,000 | ❌ fixed |
| MCP `aws-documentation` instructions | ~4,500 | ✅ disable when not needed |
| MCP `timestream-influxdb` instructions | ~3,000 | ✅ disable (not used here) |
| MCP `aws-msk` instructions | ~2,500 | ✅ disable (not used here) |
| MCP `aws-location` instructions | ~2,000 | ✅ disable (not used here) |
| CLAUDE.md (once read, stays in context) | ~2,500 | ❌ fixed, but saves file reads |
| Each file read | ~300–1,800 | ✅ avoid re-reading |
| Each tool call (bash, edit, etc.) | ~200–500 | ✅ batch commands |

### Token budget examples

| Task | Approx. total tokens | Notes |
|---|---|---|
| Simple fix (1 file already in context) | ~15,000–25,000 | cheap |
| Fix with 2 file reads | ~20,000–35,000 | medium |
| New feature (3–5 file reads) | ~35,000–60,000 | medium-high |
| Full session after 20+ turns | ~60,000–120,000 | run `/compact` |
| Session with all 4 MCPs active | +12,000 per turn | disable MCPs |

### Warning thresholds
- **> 50k tokens in session** → run `/compact` now
- **> 100k tokens** → start a new session
- **Same file read twice** → wasted tokens, always check "already in context"
- **4 MCPs active + no AWS work** → wasting ~12k tokens per turn

## 12b. TOKEN SAVING RULES

**Top 10 ways to waste tokens (avoid these):**
1. Re-reading a file already in context this session
2. Reading a file just to "verify" a change — Edit tool guarantees success
3. Running `find`/`ls` to discover structure — use §3 FILE MAP above
4. All 4 MCPs active when doing code-only work → +12k tokens per turn
5. Long sessions without `/compact` — history compounds every turn
6. Asking "explain the whole project" — ask specific questions instead
7. Reading CLAUDE.md again — once read, it stays in context
8. Reading README.md for project info — everything is in CLAUDE.md
9. Starting a new session without saying "read CLAUDE.md first"
10. Running bash `cat` on files — use the Read tool only when truly needed

**Top 5 ways to save tokens:**
1. `/compact` every ~15–20 turns → summarizes history, resets context accumulation
2. New session for an unrelated task → starts clean
3. Disable all MCPs when coding → saves ~12k tokens per turn
4. Say "don't read X, it hasn't changed" → skips the file read
5. Reference §sections of CLAUDE.md directly → "use §5 formulas, skip reading the composable"

---

## 13. MCP MANAGEMENT (save tokens)

MCP servers inject their full instructions into EVERY message (~2–5k tokens each).
**Disable all when just coding. Enable only when you need AWS lookups.**

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json`

Toggle script: `~/scripts/mcp-toggle.sh`

```bash
# Check status
~/scripts/mcp-toggle.sh status

# Disable ALL MCPs (saves ~10–20k tokens per session)
~/scripts/mcp-toggle.sh off

# Re-enable ALL MCPs
~/scripts/mcp-toggle.sh on

# Disable/enable a single MCP
~/scripts/mcp-toggle.sh off aws-msk
~/scripts/mcp-toggle.sh on  timestream-influxdb
```

**After any change: restart Claude Desktop.**

### Current MCPs and when to use them

| MCP | When useful | When to disable |
|---|---|---|
| `aws-documentation` | Reading AWS docs | All coding sessions |
| `timestream-influxdb` | Querying InfluxDB instances | This project uses Timestream Query (not InfluxDB) — always off |
| `aws-msk` | Kafka/MSK work | Not used in this project — always off |
| `aws-location` | Geocoding/routing | Map already uses OpenStreetMap — always off |

**For sm-dashboard-client: disable ALL MCPs.** None are needed for coding.
