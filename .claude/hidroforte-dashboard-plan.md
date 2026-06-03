# HidroForte Dashboard SM — Implementation Plan

**Status:** Pending — waiting for Grafana queries (PTPs flow + production panels)  
**Last updated:** 2026-06-03

---

## Goal
Reproduce the Grafana HidroForte Silvanópolis dashboard at `/dashboard-sm` in the sm-dashboard-client Vue app using D3.js, querying AWS Timestream directly from the browser (no Lambda, no API Gateway).

---

## Architecture
```
Vue App (browser)
  ↓ AWS SDK v3 (@aws-sdk/client-timestream-query)
  ↓ Cognito Identity Pool (unauthenticated/guest)
  ↓ Temp IAM credentials (read-only, HidroForte only)
  ↓ Timestream → HidroForte database (us-east-2, account 650254791912)
```

---

## AWS Resources to Create (all isolated, prefixed `hidroforte-dashboard-`)

| # | Resource | Name | Status |
|---|---|---|---|
| 1 | Cognito Identity Pool | `hidroforte-dashboard-identity-pool` | ✅ `us-east-2:b6dd06c9-347f-4287-a77b-838592d05fb7` |
| 2 | IAM Role | `hidroforte-dashboard-unauth-role` | ✅ created & attached |
| 3 | IAM Policy | `hidroforte-dashboard-timestream-ro` | ✅ created & attached |

### IAM Policy (minimum permissions)
```json
{
  "Effect": "Allow",
  "Action": [
    "timestream:Select",
    "timestream:DescribeEndpoints"
  ],
  "Resource": "arn:aws:timestream:us-east-2:650254791912:database/HidroForte/*"
}
```

---

## Timestream Data Map

- **Database:** `HidroForte` (us-east-2)
- **Main table:** `<TABLE_RT>`
- **Hourly table:** `<TABLE_HOURLY>`
- **Daily table:** `<TABLE_DAILY>`

### Known end_id mapping (confirmed)
| end_id | Name | Location |
|---|---|---|
| `smc01ow` | RAP_Silvanopolis | Silvanópolis — main reservoir level |
| `smc0hez` | RAP_gw | Silvanópolis — groundwater |
| `smc0q29` | PTP_3_4_gw | Silvanópolis — PTP 3&4 groundwater |
| `smca4vh` | PTP_1 | Silvanópolis — pump flow |
| `smc9pg7` | PTP_2 | Silvanópolis — pump flow |
| `smc25ku` | PTP_3 | Silvanópolis — pump flow |
| `smc0qvb` | PTP_4 | Silvanópolis — pump flow |
| `smcait1` | RAP_Miranorte | Miranorte — main reservoir level |
| `smcde2w` | RAP500gwMiranorte | Miranorte — 500 groundwater |
| `smccsl0` | PTP_6 | Miranorte — pump flow |
| `smccz8b` | PTP_1_gw | Miranorte — PTP 1 groundwater |

### Vazao PTPs query (confirmed from Grafana)
- Table: `<TABLE_RT>`
- Measure: `flux` → converted to m³/h via `cast(flux as double)*60/(12*1000)`
- One query per PTP, each with its own `end_id`
### Confirmed PTP calibration formulas (post 2026-05-02T18:35:00Z)
| PTP | end_id | pre formula | post formula |
|---|---|---|---|
| PTP_01 | smca4vh | `value*2/1000` | `value/(12.0*1000)` |
| PTP_02 | smc9pg7 | `value*2*12/(108*1000)` | `value/(108.0*1000)` |
| PTP_03 | smc25ku | `value/1000` | `value/(2*12.0*1000)` |
| PTP_04 | smc0qvb | `value/1000` | `value/(2*12.0*1000)` |
| PTP_07 | smccsl0 | `value*2/1000` | `value/(12.0*1000)` |

```sql
-- Pattern (repeat per PTP with its end_id):
SELECT 
  cast(flux as double)*60/(12*1000) as PTP_01,
  time
FROM "HidroForte"."<TABLE_RT>"
WHERE time BETWEEN from_milliseconds(:from) AND from_milliseconds(:to)
AND (end_id = 'smca4vh')   -- change per PTP
ORDER BY time ASC
```

### PTPs Produção m³/h - 24h (bar chart, confirmed from Grafana)
- Table: `<TABLE_HOURLY>`
- Measure: `L_acc` (accumulated liters per hour)
- Groups by `hour`, LIMIT 24 (last 24 hours)
- Formula differs per PTP due to sensor calibration change on 2026-05-02T18:35:00Z
- Chart settings: Classic palette, Min=0, Max=auto, Threshold red@80/green@base

```sql
-- PTP_01 (smca4vh)
SELECT 
  "hour", time,
  CASE
    WHEN time < from_iso8601_timestamp('2026-05-02T18:35:00Z')
      THEN (measure_value::double)*2/1000
    ELSE
      measure_value::double / (12.0*1000)
  END AS PTP_01
FROM "HidroForte"."<TABLE_HOURLY>"
WHERE "time" >= AGO(1d)
AND end_id = 'smca4vh'
AND measure_name = 'L_acc'
ORDER BY time DESC LIMIT 24

-- PTP_03 (smc25ku)
SELECT 
  "hour", time,
  CASE
    WHEN time < from_iso8601_timestamp('2026-05-02T18:35:00Z')
      THEN measure_value::double / 1000
    ELSE
      measure_value::double / (2*12.0*1000)
  END AS PTP_03
FROM "HidroForte"."<TABLE_HOURLY>"
WHERE "time" >= AGO(1d)
AND end_id = 'smc25ku'
AND measure_name = 'L_acc'
ORDER BY time DESC LIMIT 24

-- Same pattern for PTP_02(smc0qvb), PTP_04(smc0qvb?), PTP_07(smccsl0)
-- Need to confirm calibration formula per PTP
```

### PTPs Produção m³ diária (bar chart, confirmed from Grafana)
- Table: `<TABLE_DAILY>`
- Measure: `L_acc`
- Groups by `day`, LIMIT 7 (last 7 days), WHERE time >= AGO(7d)
- Same calibration formula as hourly (breakpoint: 2026-05-02T18:35:00Z)
- Chart settings: Classic palette, Fill opacity=80, Bar radius=0.05, Group width=0.41, Bar width=0.87

```sql
-- PTP_01 (smca4vh) — same formula applies to all PTPs
SELECT 
  day, time,
  CASE
    WHEN time < from_iso8601_timestamp('2026-05-02T18:35:00Z')
      THEN (measure_value::double)*2/1000
    ELSE
      measure_value::double / (12.0*1000)
  END AS PTP_01
FROM "HidroForte"."<TABLE_DAILY>"
WHERE "time" >= AGO(7d)
AND end_id = 'smca4vh'
AND measure_name = 'L_acc'
ORDER BY time DESC LIMIT 7
```

### Tank Gauge — D3.js animated (replaces Grafana Dynamic Image Panel)
- Grafana uses static PNG images from S3: `rap_${w_level}.png` — we replace with animated D3.js liquid fill
- Reference: https://gist.github.com/brattonc/5e5ce9beee483220e2f6
- Query returns latest single value (LIMIT 1) → feeds directly into gauge as percentage (0-100)
- Silvanópolis query:
```sql
SELECT 
  CASE
    WHEN time < from_iso8601_timestamp('2026-05-05T12:15:00Z')
      THEN (cast(water_level as double) - 600)*100/(2650-600)
    ELSE
      (cast(water_level as double) - 100)*100/(4050-440)
  END AS water_level,
  time
FROM "HidroForte"."<TABLE_RT>"
WHERE end_id = 'smc01ow'
ORDER BY time DESC LIMIT 1
```
- Miranorte: same pattern with `end_id = 'smcait1'` and its formula
- D3 gauge config: animated wave, color changes by threshold (red < 25, orange < 50, green >= 75)

### Level time series chart settings (both Silvanópolis & Miranorte)
- Style: Lines, Line width=2, Fill opacity=0, Gradient mode=Scheme
- Line interpolation: Linear
- Show thresholds: As lines (dashed)
- Thresholds (absolute):
  - 🔴 Base (< 25)
  - 🟠 25
  - 🟡 50
  - 🟢 75
  - 🟢 100

### Silvanópolis RAP01 query (confirmed from Grafana)
```sql
SELECT 
  CASE
    WHEN time < from_iso8601_timestamp('2026-05-05T12:15:00Z')
      THEN (cast(water_level as double) - 600)*100/(2650-600)
    ELSE
      (cast(water_level as double) - 796)*100*(5/4.2)/(3760-796)
  END AS water_level,
  time
FROM "HidroForte"."<TABLE_RT>"
WHERE time BETWEEN from_milliseconds(:from) AND from_milliseconds(:to)
AND (end_id = 'smc01ow')
ORDER BY time DESC
```

### Miranorte RAP01 query (confirmed from Grafana)
- end_id: `smcait1` ✅ confirmed
- No date split — uses single formula (post-calibration only)
```sql
SELECT 
  (cast(water_level as double) - 796)*100*(5/4.2)/(3760-796) AS water_level,
  time
FROM "HidroForte"."<TABLE_RT>"
WHERE time BETWEEN from_milliseconds(:from) AND from_milliseconds(:to)
AND (end_id = 'smcait1')
ORDER BY time DESC
```

---

## Frontend Files to Create

| # | File | Purpose | Status |
|---|---|---|---|
| 1 | `src/router/routes.ts` | Add `/dashboard-sm` route | ⬜ pending |
| 2 | `src/layouts/components/data.ts` | Replace `Dashboard v.4 (soon)` with `HidroForte SM` | ⬜ pending |
| 3 | `src/views/dashboards/dashboard-sm/index.vue` | Layout: 2 sections (Silvanópolis / Miranorte) | ⬜ pending |
| 4 | `src/composables/useTimestreamDashboard.ts` | AWS SDK v3, polls every 5 min, batches all queries | ⬜ pending |
| 5 | `src/components/charts/TankGauge.vue` | D3 liquid fill gauge (ref: brattonc gist) | ⬜ pending |
| 6 | `src/components/charts/LevelTimeSeries.vue` | D3 line chart + threshold lines | ⬜ pending |
| 7 | `src/components/charts/FlowTimeSeries.vue` | D3 multi-line chart (PTPs flow) | ⬜ pending |
| 8 | `src/components/charts/ProductionBar24h.vue` | D3 grouped bar chart (24h m³/h) | ⬜ pending |
| 9 | `src/components/charts/ProductionBarDaily.vue` | D3 grouped bar chart (daily m³) | ⬜ pending |

---

## D3.js References
- Liquid fill gauge: https://gist.github.com/brattonc/5e5ce9beee483220e2f6
- D3 gallery: https://observablehq.com/@d3/gallery
- D3 docs: https://d3js.org/
- Guide: https://medium.com/@siddhantjadhav445/javascript-for-data-visualization-a-guide-to-d3-js-f7e45c3ddd67

---

## Cost Estimate
| Item | Cost/month |
|---|---|
| Cognito Identity Pool | $0.00 |
| Timestream (5 min polling, all panels batched) | ~$4.32 |
| **Total** | **~$4.32/month** |

---

## Pending — Need from Grafana
1. ✅ end_id mapping confirmed (from device table image)
2. ✅ Miranorte RAP = `smcait1` confirmed
3. ✅ Silvanópolis PTPs = PTP_1(`smca4vh`), PTP_2(`smc9pg7`), PTP_3(`smc25ku`), PTP_4(`smc0qvb`)
4. ✅ SQL query for **"Vazao PTPs Silvanópolis"** — uses `flux` measure, formula: `cast(flux as double)*60/(12*1000)`
5. ✅ SQL query for **"PTPs Produção m³/h - 24h"** — uses `<TABLE_HOURLY>`, measure `L_acc`, calibration split on 2026-05-02
6. ✅ SQL query for **"PTPs Produção m³ diária"** — uses `<TABLE_DAILY>`, same formula as hourly, LIMIT 7

---

## AWS Profile
- Profile: `dev-sm`
- Account: `650254791912`
- Region: `us-east-2`
