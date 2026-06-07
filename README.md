# SM Dashboard Client

<p align="center">
  <img src="https://igoralves1.github.io/sm-dashboard-client/pranalogototal.svg" width="200" alt="prana" />
</p>

<p align="center">
  <strong>Real-time IoT monitoring dashboard for water infrastructure</strong><br/>
  Built with Vue 3 · D3.js · AWS Timestream · AWS Cognito
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js&logoColor=white" />
  <img src="https://img.shields.io/badge/D3.js-v7-f9a03c?logo=d3.js&logoColor=white" />
  <img src="https://img.shields.io/badge/AWS-Timestream-FF9900?logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Auth-Cognito-FF9900?logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Deploy-GitHub%20Pages-181717?logo=github&logoColor=white" />
</p>

---

## Overview

SM Dashboard Client is a single-page application that provides real-time visibility into water level monitoring infrastructure for the **HidroForte** project. It connects directly to AWS Timestream from the browser using Cognito-authenticated credentials — no backend server required.

**Live demo:** [https://igoralves1.github.io/sm-dashboard-client/](https://igoralves1.github.io/sm-dashboard-client/)

---

## Features

- 🌊 **Animated liquid fill gauge** — D3.js water tank with wave animation and color-coded levels
- 📈 **Real-time time series** — 24h water level charts with threshold lines and interactive tooltips
- 📊 **Production bar charts** — hourly and daily pump production (m³/h and m³)
- 🗺️ **Site map** — OpenStreetMap widget showing sensor locations
- 🔐 **AWS Cognito authentication** — 30-minute session tokens, forced password change on first login
- 🔄 **Auto-refresh** — 1-minute countdown timer with live data polling
- 📤 **JSON export** — snapshot logger with export button

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 + TypeScript + Vite |
| Charts | D3.js v7 |
| Map | Leaflet + OpenStreetMap |
| Auth | AWS Cognito User Pool (`amazon-cognito-identity-js`) |
| Data | AWS Timestream Query (`@aws-sdk/client-timestream-query`) |
| Credentials | AWS Cognito Identity Pool (`@aws-sdk/credential-provider-cognito-identity`) |
| UI | Bootstrap Vue Next |
| Deploy | GitHub Pages via GitHub Actions |

---

## Architecture

```
Browser
  │
  ├─ Cognito User Pool
  │    └─ Authenticates user, issues 30-min JWT tokens
  │
  ├─ Cognito Identity Pool
  │    └─ Exchanges JWT for temporary AWS credentials
  │
  └─ Timestream Query (direct browser → AWS, no backend needed)
```

---

## Project Structure

```
src/
├── assets/                  # Static assets (images, styles)
├── components/
│   └── charts/
│       ├── TankGauge.vue        # D3 animated liquid fill gauge
│       ├── LevelTimeSeries.vue  # Time series with thresholds & tooltip
│       ├── FlowTimeSeries.vue   # Multi-line PTP flow chart
│       ├── ProductionBar.vue    # Grouped bar chart (24h / daily)
│       ├── SiteMap.vue          # Leaflet map widget
│       └── RefreshCountdown.vue # D3 countdown arc timer
├── composables/
│   ├── useTimestreamDashboard.ts  # All Timestream queries & data fetching
│   └── useDashboardLogger.ts      # Snapshot logger & JSON export
├── stores/
│   └── auth.ts              # Pinia auth store (Cognito integration)
├── views/
│   ├── auth/                # Login & set-new-password pages
│   └── dashboards/
│       └── dashboard-sm/    # HidroForte SM main dashboard
└── router/
    └── routes.ts            # Route definitions
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- AWS account with Cognito User Pool and Timestream configured

### Install & Run

```bash
git clone https://github.com/igoralves1/sm-dashboard-client.git
cd sm-dashboard-client
npm install
npm run dev
```

Open [http://localhost:5173/sm-dashboard-client/](http://localhost:5173/sm-dashboard-client/)

### AWS Profile Setup

This project uses the `dev-sm` AWS profile. Configure your credentials in `.env` (see `.env.example`).

```bash
# Configure SSO (one-time setup)
aws configure sso --profile dev-sm

# Login when credentials expire (every 4h)
aws sso login --profile dev-sm
```

The profile auto-loads when you `cd` into this directory (via [direnv](https://direnv.net/) + `.envrc`).

---

## CI/CD Pipeline

The project uses **GitHub Actions** for automated build and deployment to GitHub Pages.

### Workflow file: `.github/workflows/deploy.yml`

```
Push to main
     │
     ▼
┌─────────────────┐
│   CI — Build    │  Runs on: ubuntu-latest
│                 │
│ 1. Checkout     │  git checkout
│ 2. Setup Node   │  Node.js 20
│ 3. Install deps │  npm ci
│ 4. Type check   │  vue-tsc --build
│ 5. Vite build   │  npm run build-only
└────────┬────────┘
         │ Build artifacts in /dist
         ▼
┌─────────────────┐
│  CD — Deploy    │
│                 │
│ 6. Upload dist  │  actions/upload-pages-artifact
│ 7. Deploy       │  actions/deploy-pages → gh-pages branch
└─────────────────┘
         │
         ▼
  https://igoralves1.github.io/sm-dashboard-client/
```

### CI Steps (Continuous Integration)

| Step | What it does |
|---|---|
| **Checkout** | Pulls the latest code from the `main` branch |
| **Node.js setup** | Installs Node.js 20 with npm cache enabled |
| **npm ci** | Clean install of all dependencies from `package-lock.json` |
| **Type check** | Runs `vue-tsc --build` to catch TypeScript errors before building |
| **Vite build** | Compiles and bundles the app for production into `/dist` |

### CD Steps (Continuous Deployment)

| Step | What it does |
|---|---|
| **Upload artifact** | Packages the `/dist` folder as a GitHub Pages artifact |
| **Deploy to Pages** | Publishes the artifact to the `gh-pages` branch |
| **Live** | App is served at `https://igoralves1.github.io/sm-dashboard-client/` |

### SPA Routing Fix

GitHub Pages serves static files only. A `404.html` redirect trick is used to support Vue Router's history mode — any unmatched URL redirects back to `index.html` with the path encoded as a query parameter, then a script in `index.html` restores the original URL.

---

## Authentication Flow

```
1. User visits /login
2. Enters email + password
3. Cognito User Pool authenticates
   ├─ First login → redirect to /new-password (forced password change)
   └─ Success → JWT tokens stored (access + id + refresh)
4. Access token valid for 30 minutes
5. On expiry → silent refresh via refresh token
6. On full expiry → redirect to /login
```

---

## Data Sources (AWS Timestream)

| Panel | Env Var | Measure |
|---|---|---|
| Tank gauge + Level chart | `VITE_TIMESTREAM_TABLE_RT` | `water_level` |
| Flow PTPs | `VITE_TIMESTREAM_TABLE_RT` | `flux` |
| Production 24h | `VITE_TIMESTREAM_TABLE_HOURLY` | `L_acc` |
| Production daily | `VITE_TIMESTREAM_TABLE_DAILY` | `L_acc` |

---

## Sensor Mapping

Sensor `end_id` values are configured via environment variables.
See `.env.example` for the full list of `VITE_SENSOR_*` variable names.

---

## License

This is an open source project licensed under the **Apache 2.0 License**, developed by **Dr. Igor Lemos Alves**.
Free to be used by anyone.

The `alle` branch is a customization requested by **Prana** to adapt the project to its specific needs.


---

## References

- [biovisualize.com](https://www.biovisualize.com/) — D3.js visualization patterns and examples
- [Observable](https://observablehq.com/?utm_source=d3js-org&utm_medium=promo&utm_campaign=try-observable) — Interactive D3.js notebooks and chart examples
- [Observable — Trending](https://observablehq.com/trending) — Most popular notebooks right now
- [Observable — Recent](https://observablehq.com/recent) — Latest published notebooks
- [Observable — Top (recent)](https://observablehq.com/top?type=recent) — Top notebooks filtered by recent activity
- [Observable — Top](https://observablehq.com/top) — All-time top notebooks
- [Observable — Resource Center](https://observablehq.com/resource-center) — Tutorials, guides, and learning resources
- [Qualium Systems — Showcase](https://www.qualium-systems.com/showcase/) — Vue.js and frontend showcase examples
- [Piktochart — Big Data Visualization](https://piktochart.com/blog/big-data-visualization/) — Best practices and examples for visualizing large datasets
