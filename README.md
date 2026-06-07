# IoT Monitoring System

<p align="center">
  <img src="https://igoralves1.github.io/sm-dashboard-client/pranalogototal.svg" width="200" alt="prana" />
</p>

<p align="center">
  <strong>To be used in Water, Energy and any other smart city context.</strong><br/>
  Real-time AIIoT dashboards powered by Vue 3 · D3.js · AWS Timestream · AWS Cognito
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js&logoColor=white" />
  <img src="https://img.shields.io/badge/D3.js-v7-f9a03c?logo=d3.js&logoColor=white" />
  <img src="https://img.shields.io/badge/AWS-Timestream-FF9900?logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Auth-Cognito-FF9900?logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Deploy-GitHub%20Pages-181717?logo=github&logoColor=white" />
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue" />
</p>

---

## Overview

**IoT Monitoring System** is an open-source, browser-native single-page application for real-time monitoring of IoT infrastructure across smart city domains — water distribution networks, energy grids, environmental sensors, and beyond.

It was designed to turn raw sensor data into actionable intelligence: live tank levels, pump flow rates, energy consumption trends, and anomaly alerts — all visualized through interactive D3.js charts without the need for a dedicated backend server.

Data flows directly from **AWS Timestream** to the browser using short-lived credentials issued by **AWS Cognito**, keeping the architecture serverless and cost-efficient.

**Live demo:** [https://igoralves1.github.io/sm-dashboard-client/](https://igoralves1.github.io/sm-dashboard-client/)

---

## Use Cases

This system is domain-agnostic. The same architecture and visualization layer can be applied to:

| Domain | Examples |
|---|---|
| 🌊 **Water** | Reservoir levels, pump flow rates, distribution pressure |
| ⚡ **Energy** | Consumption tracking, demand forecasting, grid efficiency |
| 🌡️ **Environment** | Air quality, temperature, humidity, rainfall |
| 🏙️ **Smart Cities** | Multi-sensor city dashboards, alert management |
| 🏗️ **Industrial IoT** | Equipment telemetry, predictive maintenance |

---

## Features

- **Animated liquid fill gauges** — D3.js water tanks with wave animation and color-coded threshold levels
- **Real-time time series** — 24-hour level and flow charts with threshold lines and interactive crosshair tooltips
- **Stacked area charts** — D3.js energy consumption trends with monthly projections and statistics
- **Donut charts** — Station status overview with interactive hover and SVG legends
- **Production bar charts** — Hourly and daily pump production grouped by sensor
- **Site map** — OpenStreetMap widget showing sensor locations with custom markers
- **AWS Cognito authentication** — 30-minute session tokens, silent refresh, forced password change on first login
- **Auto-refresh** — Configurable countdown timer with live data polling (default 5 min)
- **JSON snapshot export** — Timestamped logger with one-click export button
- **Fully responsive** — ResizeObserver-driven charts that adapt to any viewport

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
  │    └─ Exchanges JWT for temporary AWS credentials (STS)
  │
  └─ Timestream Query (direct browser → AWS, no backend needed)
       ├─ Real-time table  (latest sensor readings)
       ├─ Hourly table     (hourly aggregates)
       └─ Daily table      (daily aggregates)
```

No backend server. No API gateway. Sensor data goes directly from AWS to the browser.

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
│       ├── dashboard/       # Main overview dashboard (stat cards, charts)
│       └── dashboard-sm/    # HidroForte SM IoT dashboard
└── router/
    └── index.ts             # Route definitions with silent token refresh
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

### Environment Variables

Copy `.env.example` to `.env` and fill in your AWS resource identifiers:

```bash
cp .env.example .env
```

Key variables:

```
VITE_AWS_REGION=
VITE_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_IDENTITY_POOL_ID=
VITE_TIMESTREAM_DB=
VITE_TIMESTREAM_TABLE_RT=
VITE_TIMESTREAM_TABLE_HOURLY=
VITE_TIMESTREAM_TABLE_DAILY=
```

### AWS Profile Setup

```bash
# Configure SSO (one-time setup)
aws configure sso --profile dev-sm

# Login when credentials expire (every 4h)
aws sso login --profile dev-sm
```

The profile auto-loads when you `cd` into this directory via [direnv](https://direnv.net/).

---

## CI/CD Pipeline

Automated build and deployment to GitHub Pages via **GitHub Actions** on every push to the `alle` branch.

```
Push to alle
     │
     ▼
┌─────────────────┐
│   CI — Build    │  ubuntu-latest / Node.js 20
│                 │
│ 1. Checkout     │
│ 2. npm ci       │  Clean install
│ 3. Vite build   │  Output → /dist
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CD — Deploy    │
│                 │
│ 4. Upload dist  │  actions/upload-pages-artifact
│ 5. Deploy       │  actions/deploy-pages
└─────────────────┘
         │
         ▼
  https://igoralves1.github.io/sm-dashboard-client/
```

---

## Authentication Flow

```
1. User visits /login
2. Enters email + password
3. Cognito User Pool authenticates
   ├─ First login → /new-password (forced password change)
   └─ Success    → JWT tokens stored in Pinia (access + id + refresh)
4. Access token valid for 30 minutes
5. On expiry → silent refresh via refresh token
6. On full expiry → redirect to /login
```

---

## Data Sources (AWS Timestream)

| Panel | Table | Measure |
|---|---|---|
| Tank gauge + Level chart | `RT` (real-time) | `water_level` |
| Flow PTPs | `RT` (real-time) | `flux` |
| Production 24h | `HOURLY` | `L_acc` |
| Production daily | `DAILY` | `L_acc` |

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
