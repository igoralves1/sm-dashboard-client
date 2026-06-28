<template>
  <MainLayout>
    <div class="container-fluid px-4 py-3">

      <!-- ── Header ──────────────────────────────────────────────────────────── -->
      <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 class="mb-0 fw-semibold d-flex align-items-center gap-2">
            <span :class="['live-dot', wsReady ? 'pulse-server' : 'dot-offline']"></span>
            X-8G2T Node Monitor
          </h4>
          <div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
            <span :class="['server-status-label', wsReady ? 'server-online' : 'server-offline']">
              {{ wsReady ? '● Connected' : '○ Disconnected' }}
            </span>
            <span class="text-muted" style="font-size:12px;">
              · Jetson Orin Nano 8GB · 1024-core Ampere GPU · CUDA sm_87
            </span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <span v-if="board.tegrastats_available" class="obs-pill obs-pill-green">
            <span class="obs-pill-dot" style="background:#3fb950;"></span>tegrastats LIVE
          </span>
          <span v-else class="obs-pill obs-pill-grey">
            <span class="obs-pill-dot" style="background:#6c757d;"></span>tegrastats N/A
          </span>
          <span class="text-muted" style="font-size:12px; font-variant-numeric:tabular-nums;">
            {{ wsReady ? `Updated ${lastUpdateAgo}s ago` : 'Waiting…' }}
          </span>
          <span class="text-muted" style="font-size:12px;">
            Uptime: <strong>{{ fmtUptime(board.uptime_seconds) }}</strong>
          </span>
        </div>
      </div>

      <!-- ── Disconnected banner ──────────────────────────────────────────────── -->
      <div v-if="!wsReady" class="alert alert-warning mb-4 d-flex align-items-center gap-3">
        <span class="spin-icon" style="font-size:18px;">⟳</span>
        <div>
          Connecting to <code>{{ WS_URL }}</code> —
          make sure the <code>observability</code> container is running:
          <code>docker compose up -d --profile core</code>
        </div>
      </div>

      <!-- ── KPI Row ──────────────────────────────────────────────────────────── -->
      <div class="row g-2 mb-3">
        <div class="col-6 col-sm-4 col-lg-2" v-for="kpi in kpiCards" :key="kpi.label">
          <div :class="['card kpi-card h-100', kpi.border ?? '']">
            <div class="card-body d-flex flex-column py-3 px-3">
              <div class="kpi-label">{{ kpi.label }}</div>
              <div :class="['kpi-value', kpi.valueColor ?? '']">
                {{ kpi.value }}<span v-if="kpi.unit" class="kpi-unit">{{ kpi.unit }}</span>
              </div>
              <div v-if="kpi.sub" class="kpi-trend">{{ kpi.sub }}</div>
              <div class="kpi-divider"></div>
              <div class="kpi-desc">{{ kpi.desc }}</div>
              <div v-if="kpi.pct != null" class="mt-2">
                <div class="kpi-range-track">
                  <div class="kpi-range-fill" :style="{ width: kpi.pct + '%', background: kpi.barColor ?? '#0d6efd' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── CPU + GPU + Memory ──────────────────────────────────────────────── -->
      <div class="row g-3 mb-3">

        <!-- CPU -->
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h6 class="obs-section-title">CPU — 6× Cortex-A78AE</h6>
              <div class="d-flex justify-content-between mb-3" style="font-size:11px;">
                <span class="text-muted">Overall: <strong :class="cpuUtilColor(board.cpu?.util_percent)">{{ fmt1(board.cpu?.util_percent) }}%</strong></span>
                <span class="text-muted">Load: {{ board.cpu?.load_avg?.map((x:number) => x.toFixed(2)).join(' / ') ?? '—' }}</span>
              </div>
              <div v-for="(core, i) in (board.cpu?.cores ?? [])" :key="i" class="mb-2">
                <div class="d-flex justify-content-between mb-1">
                  <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:.05em;">
                    Core {{ core.core }} <span class="text-muted">· {{ core.governor ?? '' }}</span>
                  </span>
                  <span style="font-size:11px; font-variant-numeric:tabular-nums;">
                    <strong :class="cpuUtilColor(core.util_percent)">{{ core.util_percent ?? 0 }}%</strong>
                    <span class="text-muted"> · {{ fmt0(core.freq_mhz) }} MHz</span>
                  </span>
                </div>
                <div class="progress" style="height:5px; border-radius:3px;">
                  <div class="progress-bar" :style="{
                    width: (core.util_percent ?? 0) + '%',
                    background: cpuBarColor(core.util_percent),
                    transition: 'width .6s ease'
                  }"></div>
                </div>
              </div>
              <div class="d-flex justify-content-between mt-3" style="font-size:10px; color:var(--bs-secondary-color);">
                <span>Max freq: {{ fmt0(board.cpu?.freq_max_mhz) }} MHz</span>
                <span>Cores: {{ board.cpu?.count_logical ?? '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- GPU -->
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h6 class="obs-section-title">GPU — Ampere 1024 CUDA · 32 Tensor</h6>
              <div class="mb-3" v-for="bar in gpuBars" :key="bar.label">
                <div class="d-flex justify-content-between mb-1">
                  <span class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.05em;">{{ bar.label }}</span>
                  <span class="fw-semibold" style="font-size:12px; font-variant-numeric:tabular-nums;">{{ bar.value }}</span>
                </div>
                <div class="progress" style="height:7px; border-radius:4px;">
                  <div class="progress-bar" :style="{ width: bar.pct + '%', background: bar.color, transition:'width .8s ease' }"></div>
                </div>
                <div class="text-muted mt-1" style="font-size:10px;">{{ bar.desc }}</div>
              </div>
              <!-- Available freq chips -->
              <div class="d-flex flex-wrap gap-1 mt-2">
                <span
                  v-for="f in (board.gpu?.available_freqs ?? [])" :key="f"
                  :class="['freq-chip', f === board.gpu?.freq_mhz ? 'freq-chip-active' : '']"
                >{{ f }}</span>
              </div>
              <div class="text-muted mt-2" style="font-size:10px;">
                Governor: <strong>{{ board.gpu?.governor ?? '—' }}</strong>
                · Memory: unified (shared LPDDR5)
              </div>
            </div>
          </div>
        </div>

        <!-- Memory -->
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h6 class="obs-section-title">Memory — 8 GB LPDDR5 Unified</h6>
              <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                  <span class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.05em;">RAM Used</span>
                  <span class="fw-semibold" style="font-size:12px;">
                    <strong :class="memColor(board.memory?.percent)">{{ fmt1(board.memory?.percent) }}%</strong>
                    <span class="text-muted"> · {{ fmtBytes(board.memory?.used) }} / {{ fmtBytes(board.memory?.total) }}</span>
                  </span>
                </div>
                <div class="progress" style="height:10px; border-radius:5px;">
                  <div class="progress-bar" :style="{
                    width: (board.memory?.percent ?? 0) + '%',
                    background: memBarColor(board.memory?.percent),
                    transition: 'width .8s ease'
                  }"></div>
                </div>
              </div>

              <div class="obs-info-grid mb-3">
                <div class="obs-info-row">
                  <span class="obs-info-key">Available</span>
                  <span class="obs-info-val">{{ fmtBytes(board.memory?.available) }}</span>
                </div>
                <div class="obs-info-row">
                  <span class="obs-info-key">Cached</span>
                  <span class="obs-info-val">{{ fmtBytes(board.memory?.cached) }}</span>
                </div>
                <div class="obs-info-row">
                  <span class="obs-info-key">Buffers</span>
                  <span class="obs-info-val">{{ fmtBytes(board.memory?.buffers) }}</span>
                </div>
                <div class="obs-info-row">
                  <span class="obs-info-key">Swap used</span>
                  <span class="obs-info-val">{{ fmtBytes(board.swap?.used) }} / {{ fmtBytes(board.swap?.total) }}</span>
                </div>
              </div>

              <!-- Tegrastats unified view -->
              <div v-if="board.memory?.tegra_used_mb" class="tegra-mem-block">
                <div class="tegra-mem-title">
                  <span class="obs-pulse-dot"></span>
                  tegrastats unified view
                </div>
                <div class="d-flex justify-content-between mb-1" style="font-size:11px;">
                  <span class="text-muted">{{ board.memory?.tegra_used_mb }} / {{ board.memory?.tegra_total_mb }} MB</span>
                  <span :class="memColor(lfbPct)" style="font-size:10px;">
                    LFB: {{ board.memory?.tegra_lfb_blocks }}× {{ board.memory?.tegra_lfb_mb }} MB
                  </span>
                </div>
                <div class="progress" style="height:5px; border-radius:3px;">
                  <div class="progress-bar" :style="{
                    width: tegraMemPct + '%',
                    background: memBarColor(tegraMemPct),
                    transition: 'width .8s ease'
                  }"></div>
                </div>
                <div class="text-muted mt-1" style="font-size:10px;">
                  LFB = largest free block (lower = fragmented GPU allocs)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Power + Temperatures ────────────────────────────────────────────── -->
      <div class="row g-3 mb-3">

        <!-- Power (INA3221) -->
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <h6 class="obs-section-title mb-0">Power — INA3221</h6>
                <span class="fw-bold" style="font-size:14px; color:#f59e0b;">
                  {{ fmt1(board.power?.total_mw ? board.power.total_mw / 1000 : null) }} W
                  <span class="text-muted fw-normal" style="font-size:10px;">total</span>
                </span>
              </div>

              <div v-for="(rail, name) in (board.power?.rails ?? {})" :key="name" class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                  <span class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.04em;">{{ name }}</span>
                  <span class="fw-semibold" style="font-size:12px; font-variant-numeric:tabular-nums;">
                    {{ fmt0(rail.power_mw) }} mW
                  </span>
                </div>
                <div class="progress" style="height:7px; border-radius:4px;">
                  <div class="progress-bar" :style="{
                    width: Math.min(100, (rail.power_mw / 6000) * 100) + '%',
                    background: powerBarColor(name as string),
                    transition: 'width .8s ease'
                  }"></div>
                </div>
                <div class="d-flex justify-content-between mt-1" style="font-size:10px; color:var(--bs-secondary-color);">
                  <span>{{ fmt0(rail.current_ma) }} mA</span>
                  <span>{{ fmt0(rail.voltage_mv) }} mV</span>
                </div>
              </div>

              <!-- Fan -->
              <div v-if="Object.keys(board.fan ?? {}).length" class="mt-3 pt-3" style="border-top:1px solid var(--bs-border-color);">
                <div class="d-flex align-items-center justify-content-between">
                  <span class="obs-section-title mb-0" style="font-size:10px;">Fan PWM</span>
                  <span v-for="(fan, key) in board.fan" :key="key as string" class="fw-semibold" style="font-size:12px;">
                    {{ fan.pwm ?? fan.rpm ?? '—' }}
                    <span class="text-muted fw-normal" style="font-size:10px;">{{ fan.rpm != null ? ' RPM' : ' / 255' }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Temperatures -->
        <div class="col-12 col-lg-8">
          <div class="card h-100">
            <div class="card-body">
              <h6 class="obs-section-title">Temperatures</h6>
              <div class="temp-grid">
                <div
                  v-for="(val, zone) in filteredTemps" :key="zone as string"
                  :class="['temp-card', tempLevel(val as number)]"
                >
                  <div class="temp-zone">{{ zoneName(zone as string) }}</div>
                  <div :class="['temp-val', tempTextColor(val as number)]">
                    {{ (val as number).toFixed(1) }}<span class="temp-unit">°C</span>
                  </div>
                  <div class="temp-bar-track">
                    <div class="temp-bar-fill"
                      :style="{ width: Math.min(100, ((val as number) / 100) * 100) + '%', background: tempBarColor(val as number) }">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Disk ────────────────────────────────────────────────────────────── -->
      <div class="row g-3 mb-3">
        <div class="col-12 col-lg-4" v-for="(disk, key) in (board.disk ?? {})" :key="key as string">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <h6 class="obs-section-title mb-0">
                  {{ disk.type?.toUpperCase() ?? key }}
                  <span class="text-muted fw-normal" style="font-size:10px;"> · {{ disk.size_gb }} GB</span>
                </h6>
                <code style="font-size:10px; color:var(--bs-secondary-color);">{{ disk.device }}</code>
              </div>
              <div v-if="disk.model" class="text-muted mb-2" style="font-size:11px;">{{ disk.model }}</div>

              <!-- Usage bar (if mounted) -->
              <template v-if="disk.usage">
                <div class="d-flex justify-content-between mb-1" style="font-size:11px;">
                  <span class="text-muted">Used</span>
                  <span :class="diskUsageColor(disk.usage.percent)">
                    <strong>{{ disk.usage.percent }}%</strong>
                    · {{ fmtBytes(disk.usage.used) }} / {{ fmtBytes(disk.usage.total) }}
                  </span>
                </div>
                <div class="progress mb-3" style="height:8px; border-radius:4px;">
                  <div class="progress-bar" :style="{
                    width: disk.usage.percent + '%',
                    background: diskBarColor(disk.usage.percent),
                    transition: 'width .8s ease'
                  }"></div>
                </div>
              </template>

              <!-- I/O counters -->
              <div class="obs-info-grid">
                <div class="obs-info-row">
                  <span class="obs-info-key">Reads</span>
                  <span class="obs-info-val">{{ fmtCount(disk.io?.reads_completed) }} ops · {{ fmtBytes(disk.io?.bytes_read) }}</span>
                </div>
                <div class="obs-info-row">
                  <span class="obs-info-key">Writes</span>
                  <span class="obs-info-val">{{ fmtCount(disk.io?.writes_completed) }} ops · {{ fmtBytes(disk.io?.bytes_written) }}</span>
                </div>
                <div class="obs-info-row">
                  <span class="obs-info-key">In-flight</span>
                  <span class="obs-info-val">{{ disk.io?.ios_in_progress ?? 0 }} I/Os</span>
                </div>
                <div v-if="disk.mountpoint" class="obs-info-row">
                  <span class="obs-info-key">Mount</span>
                  <span class="obs-info-val">{{ disk.mountpoint }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Network ─────────────────────────────────────────────────────────── -->
      <div class="card mb-3">
        <div class="card-body p-0">
          <div class="d-flex align-items-center justify-content-between px-3 pt-3 pb-2">
            <h6 class="obs-section-title mb-0">Network Interfaces</h6>
            <span class="text-muted" style="font-size:10px;">{{ Object.keys(board.net ?? {}).length }} interfaces · host namespace</span>
          </div>
          <div class="net-table-wrap">
            <table class="net-table">
              <thead>
                <tr>
                  <th>Interface</th>
                  <th>Recv</th>
                  <th class="d-none d-md-table-cell">Recv pkts</th>
                  <th>Sent</th>
                  <th class="d-none d-md-table-cell">Sent pkts</th>
                  <th class="d-none d-lg-table-cell">Errors in</th>
                  <th class="d-none d-lg-table-cell">Errors out</th>
                  <th class="d-none d-xl-table-cell">Drops in</th>
                  <th class="d-none d-xl-table-cell">Drops out</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(iface, name) in (board.net ?? {})" :key="name as string" :class="netRowClass(name as string)">
                  <td>
                    <span class="net-iface-name">{{ name }}</span>
                    <span v-if="isWifi(name as string)" class="net-badge net-badge-wifi">WiFi</span>
                    <span v-else-if="isEth(name as string)" class="net-badge net-badge-eth">ETH</span>
                    <span v-else-if="isDocker(name as string)" class="net-badge net-badge-docker">Docker</span>
                  </td>
                  <td class="fw-semibold">{{ fmtBytes(iface.bytes_recv) }}</td>
                  <td class="text-muted d-none d-md-table-cell">{{ fmtCount(iface.packets_recv) }}</td>
                  <td class="fw-semibold">{{ fmtBytes(iface.bytes_sent) }}</td>
                  <td class="text-muted d-none d-md-table-cell">{{ fmtCount(iface.packets_sent) }}</td>
                  <td class="d-none d-lg-table-cell" :class="iface.errin ? 'text-danger' : 'text-muted'">{{ iface.errin }}</td>
                  <td class="d-none d-lg-table-cell" :class="iface.errout ? 'text-danger' : 'text-muted'">{{ iface.errout }}</td>
                  <td class="d-none d-xl-table-cell text-muted">{{ iface.dropin }}</td>
                  <td class="d-none d-xl-table-cell text-muted">{{ iface.dropout }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ── Containers ──────────────────────────────────────────────────────── -->
      <div class="card mb-3">
        <div class="card-body p-0">
          <div class="d-flex align-items-center justify-content-between px-3 pt-3 pb-2 flex-wrap gap-2">
            <h6 class="obs-section-title mb-0">
              <span :class="['log-live-dot me-2', wsReady ? 'log-live-dot-active' : '']"></span>
              Containers
            </h6>
            <div class="d-flex gap-3" style="font-size:11px;">
              <span class="text-success">{{ containers.filter(c => c.status === 'running').length }} running</span>
              <span class="text-warning">{{ containers.filter(c => c.status === 'restarting').length }} restarting</span>
              <span class="text-muted">{{ containers.filter(c => c.status === 'exited').length }} exited</span>
            </div>
          </div>
          <div class="ctr-table-wrap">
            <table class="ctr-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th class="d-none d-sm-table-cell">Health</th>
                  <th class="text-end">CPU%</th>
                  <th class="text-end">Memory</th>
                  <th class="text-end d-none d-lg-table-cell">Net RX</th>
                  <th class="text-end d-none d-lg-table-cell">Net TX</th>
                  <th class="text-end d-none d-xl-table-cell">Blk R</th>
                  <th class="text-end d-none d-xl-table-cell">Blk W</th>
                  <th class="d-none d-md-table-cell">Restarts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in sortedContainers" :key="c.id"
                  :class="['ctr-row', selectedContainer?.id === c.id ? 'ctr-row-selected' : '', ctrRowClass(c)]"
                  @click="toggleLogs(c)"
                >
                  <td>
                    <span class="ctr-name">{{ c.name }}</span>
                  </td>
                  <td>
                    <span :class="['ctr-status-badge', statusClass(c.status)]">
                      {{ c.status }}
                    </span>
                  </td>
                  <td class="d-none d-sm-table-cell">
                    <span :class="['ctr-health-badge', healthClass(c.health)]">
                      {{ c.health }}
                    </span>
                  </td>
                  <td class="text-end fw-semibold" :style="{ color: cpuColor(c.cpu_percent) }">
                    {{ c.status === 'running' ? fmt1(c.cpu_percent) + '%' : '—' }}
                  </td>
                  <td class="text-end">
                    <span :style="{ color: memColor2(c.memory_percent) }">{{ c.status === 'running' ? fmt1(c.memory_percent) + '%' : '—' }}</span>
                    <span class="d-none d-xl-table-cell text-muted" style="font-size:10px;"> · {{ fmtBytes(c.memory_usage) }}</span>
                  </td>
                  <td class="text-end text-muted d-none d-lg-table-cell" style="font-size:11px;">{{ fmtBytes(c.net_rx_bytes) }}</td>
                  <td class="text-end text-muted d-none d-lg-table-cell" style="font-size:11px;">{{ fmtBytes(c.net_tx_bytes) }}</td>
                  <td class="text-end text-muted d-none d-xl-table-cell" style="font-size:11px;">{{ fmtBytes(c.block_read_bytes) }}</td>
                  <td class="text-end text-muted d-none d-xl-table-cell" style="font-size:11px;">{{ fmtBytes(c.block_write_bytes) }}</td>
                  <td class="d-none d-md-table-cell">
                    <span :class="['restart-badge', c.restart_count > 0 ? 'restart-warn' : 'restart-ok']">
                      {{ c.restart_count }}
                    </span>
                  </td>
                  <td>
                    <span class="logs-btn" :class="{ 'logs-btn-open': selectedContainer?.id === c.id }">
                      {{ selectedContainer?.id === c.id ? '▲' : '▼' }} logs
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Log panel -->
          <div v-if="selectedContainer" class="px-3 pb-3">
            <div class="d-flex align-items-center justify-content-between pt-2 pb-2">
              <span class="text-muted" style="font-size:11px; font-weight:600;">
                {{ selectedContainer.name }} — last {{ selectedContainer.logs?.length ?? 0 }} lines
              </span>
              <button class="log-toggle-btn" @click="selectedContainer = null">✕ close</button>
            </div>
            <div class="terminal-box font-monospace" ref="terminalRef">
              <div v-if="!selectedContainer.logs?.length" class="text-muted" style="font-size:12px; padding:8px 0;">
                No logs available.
              </div>
              <div v-for="(line, i) in selectedContainer.logs" :key="i"
                   :class="['term-line', termLineClass(line)]">{{ line || ' ' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Service Topology & Data Flow ────────────────────────────────────── -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <h6 class="obs-section-title mb-0">Service Topology &amp; Data Flow</h6>
            <div class="topo-legend">
              <span class="topo-leg"><span class="topo-leg-sw" style="background:#3fb950;"></span>healthy</span>
              <span class="topo-leg"><span class="topo-leg-sw" style="background:#58a6ff;"></span>running</span>
              <span class="topo-leg"><span class="topo-leg-sw" style="background:#fd7e14;"></span>restarting</span>
              <span class="topo-leg"><span class="topo-leg-sw" style="background:#dc3545;"></span>unhealthy</span>
              <span class="topo-leg"><span class="topo-leg-sw" style="background:#6c757d;"></span>stopped</span>
              <span class="topo-leg"><span class="topo-leg-sw topo-leg-sw-dashed"></span>offline</span>
            </div>
          </div>
          <ServiceTopology :containers="containers" :ws-ready="wsReady" />
          <div class="text-muted mt-2" style="font-size:10px; line-height:1.5;">
            Border colour = container health from the observability API · flowing dots show data direction between
            running services · dashed boxes are services not currently deployed on this board.
          </div>
        </div>
      </div>

      <!-- ── Raw Data Panel ──────────────────────────────────────────────────── -->
      <div class="raw-data-panel mt-4">
        <button class="raw-data-toggle" @click="showRaw = !showRaw">
          <span>{{ showRaw ? '▾' : '▸' }} Raw WebSocket Data</span>
          <span class="raw-data-sub">board + containers · ws://{{ wsHost }}:8001/ws · 1-second push</span>
        </button>
        <div v-if="showRaw" class="raw-data-body">
          <div class="raw-data-cols">
            <div class="raw-data-col">
              <div class="raw-data-col-title">
                📋 Board Metrics
                <a :href="`http://${wsHost}:8001/api/board`" target="_blank" class="raw-link">open ↗</a>
              </div>
              <pre class="raw-pre">{{ JSON.stringify(board, null, 2) }}</pre>
            </div>
            <div class="raw-data-col">
              <div class="raw-data-col-title">
                📦 Containers
                <a :href="`http://${wsHost}:8001/api/containers`" target="_blank" class="raw-link">open ↗</a>
              </div>
              <pre class="raw-pre">{{ JSON.stringify(containers.map(c => ({ ...c, logs: undefined })), null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

    </div>
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import MainLayout from '@/layouts/MainLayout.vue'
import ServiceTopology from '@/components/charts/ServiceTopology.vue'

// ── Types ───────────────────────────────────────────────────────────────────────

interface BoardMetrics {
  cpu?: { util_percent?: number; util_per_core?: number[]; count_logical?: number; freq_max_mhz?: number; load_avg?: number[]; cores?: any[] }
  gpu?: { util_percent?: number; freq_mhz?: number; freq_max_mhz?: number; governor?: string; available_freqs?: number[]; emc_util_percent?: number; emc_freq_mhz?: number; vic_util_percent?: number }
  memory?: { total?: number; available?: number; used?: number; percent?: number; buffers?: number; cached?: number; tegra_used_mb?: number; tegra_total_mb?: number; tegra_lfb_blocks?: number; tegra_lfb_mb?: number }
  swap?: { total?: number; used?: number; free?: number; percent?: number }
  disk?: Record<string, any>
  net?: Record<string, any>
  power?: { rails?: Record<string, any>; total_mw?: number }
  temperatures?: Record<string, number>
  fan?: Record<string, any>
  uptime_seconds?: number
  boot_time?: number
  tegrastats_available?: boolean
}

interface Container {
  id: string; name: string; status: string; image: string; health: string
  restart_count: number; cpu_percent: number; memory_usage: number; memory_limit: number
  memory_percent: number; net_rx_bytes: number; net_tx_bytes: number
  block_read_bytes: number; block_write_bytes: number; logs?: string[]
}

// ── WebSocket ────────────────────────────────────────────────────────────────────

const wsHost = window.location.hostname
const WS_URL = `ws://${wsHost}:8001/ws`

const wsReady = ref(false)
const lastUpdated = ref(0)
const lastUpdateAgo = ref(0)
const board = ref<BoardMetrics>({})
const containers = ref<Container[]>([])
const selectedContainer = ref<Container | null>(null)
const showRaw = ref(false)
const terminalRef = ref<HTMLElement | null>(null)

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let agoTimer: ReturnType<typeof setInterval> | null = null

function connect() {
  if (ws) { ws.onclose = null; ws.close() }
  ws = new WebSocket(WS_URL)
  ws.onopen  = () => { wsReady.value = true }
  ws.onclose = () => { wsReady.value = false; reconnectTimer = setTimeout(connect, 3000) }
  ws.onerror = () => { ws?.close() }
  ws.onmessage = ({ data }) => {
    try {
      const msg = JSON.parse(data)
      board.value      = msg.board ?? {}
      containers.value = msg.containers ?? []
      lastUpdated.value = Date.now()
      lastUpdateAgo.value = 0
      // Update selected container logs from the new snapshot
      if (selectedContainer.value) {
        const fresh = containers.value.find(c => c.id === selectedContainer.value!.id)
        if (fresh) {
          selectedContainer.value = fresh
          nextTick(() => {
            if (terminalRef.value) terminalRef.value.scrollTop = terminalRef.value.scrollHeight
          })
        }
      }
    } catch {}
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────────

onMounted(() => {
  connect()
  agoTimer = setInterval(() => {
    if (lastUpdated.value) lastUpdateAgo.value = Math.round((Date.now() - lastUpdated.value) / 1000)
  }, 1000)
})

onUnmounted(() => {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (agoTimer) clearInterval(agoTimer)
  if (ws) { ws.onclose = null; ws.close() }
})

// ── Formatters ───────────────────────────────────────────────────────────────────

function fmt0(v: number | null | undefined): string {
  return v == null ? '—' : Math.round(v).toString()
}
function fmt1(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(1)
}
function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  let i = 0; let b = bytes
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return b.toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}
function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toString()
}
function fmtUptime(sec: number | undefined): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Color helpers ────────────────────────────────────────────────────────────────

function cpuUtilColor(p?: number): string {
  if (p == null) return 'text-muted'
  return p > 80 ? 'text-danger' : p > 50 ? 'text-warning' : 'text-success'
}
function cpuBarColor(p?: number): string {
  if (p == null) return '#198754'
  return p > 80 ? '#dc3545' : p > 50 ? '#fd7e14' : '#198754'
}
function memColor(p?: number): string {
  if (p == null) return 'text-muted'
  return p > 85 ? 'text-danger' : p > 65 ? 'text-warning' : 'text-success'
}
function memColor2(p?: number): string {
  if (p == null) return 'var(--bs-secondary-color)'
  return p > 85 ? '#dc3545' : p > 65 ? '#fd7e14' : 'var(--bs-body-color)'
}
function memBarColor(p?: number): string {
  if (p == null) return '#198754'
  return p > 85 ? '#dc3545' : p > 65 ? '#fd7e14' : '#198754'
}
function diskUsageColor(p?: number): string {
  if (p == null) return 'text-muted'
  return p > 85 ? 'text-danger' : p > 70 ? 'text-warning' : 'text-success'
}
function diskBarColor(p?: number): string {
  if (p == null) return '#198754'
  return p > 85 ? '#dc3545' : p > 70 ? '#fd7e14' : '#198754'
}
function cpuColor(p?: number): string {
  if (p == null || p === 0) return 'var(--bs-secondary-color)'
  return p > 80 ? '#dc3545' : p > 40 ? '#fd7e14' : 'var(--bs-body-color)'
}
function powerBarColor(name: string): string {
  if (name === 'VDD_IN')          return '#f59e0b'
  if (name === 'VDD_CPU_GPU_CV')  return '#76b900'
  if (name === 'VDD_SOC')         return '#0ea5e9'
  return '#6c757d'
}
function tempBarColor(t: number): string {
  return t > 80 ? '#dc3545' : t > 65 ? '#fd7e14' : t > 50 ? '#f59e0b' : '#198754'
}
function tempTextColor(t: number): string {
  return t > 80 ? 'text-danger' : t > 65 ? 'text-warning' : ''
}
function tempLevel(t: number): string {
  return t > 80 ? 'temp-card-hot' : t > 65 ? 'temp-card-warm' : ''
}

// ── KPI cards ────────────────────────────────────────────────────────────────────

const kpiCards = computed(() => {
  const cpu  = board.value.cpu
  const gpu  = board.value.gpu
  const mem  = board.value.memory
  const pwr  = board.value.power
  const temps = board.value.temperatures ?? {}
  const tjTemp = temps['tj-thermal'] ?? temps['tegrastats/tj'] ?? Object.values(temps)[0]
  const gpuUtil = gpu?.util_percent

  return [
    {
      label: 'CPU', value: fmt1(cpu?.util_percent), unit: '%',
      sub: `Load: ${cpu?.load_avg?.[0]?.toFixed(2) ?? '—'}`,
      desc: `${cpu?.count_logical ?? '—'} cores · max ${fmt0(cpu?.freq_max_mhz)} MHz`,
      pct: cpu?.util_percent, barColor: cpuBarColor(cpu?.util_percent),
      valueColor: cpuUtilColor(cpu?.util_percent),
    },
    {
      label: 'GPU', value: gpuUtil != null ? fmt0(gpuUtil) : '—', unit: '%',
      sub: `${fmt0(gpu?.freq_mhz)} / ${fmt0(gpu?.freq_max_mhz)} MHz`,
      desc: 'Ampere · 1024 CUDA · 32 Tensor cores',
      pct: gpuUtil, barColor: cpuBarColor(gpuUtil),
      valueColor: gpuUtil != null && gpuUtil > 50 ? 'text-warning' : '',
    },
    {
      label: 'RAM', value: fmt1(mem?.percent), unit: '%',
      sub: `${fmtBytes(mem?.used)} / ${fmtBytes(mem?.total)}`,
      desc: 'Unified LPDDR5 (CPU + GPU share)',
      pct: mem?.percent, barColor: memBarColor(mem?.percent),
      valueColor: memColor(mem?.percent),
    },
    {
      label: 'Power', value: fmt1(pwr?.total_mw != null ? pwr.total_mw / 1000 : null), unit: ' W',
      sub: `VDD_IN · INA3221`,
      desc: 'Total board power from 5V rail',
      pct: pwr?.total_mw != null ? Math.min(100, (pwr.total_mw / 10000) * 100) : null,
      barColor: '#f59e0b', valueColor: '',
    },
    {
      label: 'Temp', value: fmt1(tjTemp), unit: '°C',
      sub: 'tj-thermal (junction)',
      desc: 'Max of all SoC thermal zones',
      pct: tjTemp != null ? Math.min(100, (tjTemp / 100) * 100) : null,
      barColor: tempBarColor(tjTemp ?? 0), valueColor: tempTextColor(tjTemp ?? 0),
    },
    {
      label: 'Uptime', value: fmtUptime(board.value.uptime_seconds), unit: '',
      sub: board.value.boot_time ? new Date(board.value.boot_time * 1000).toLocaleDateString() : '',
      desc: 'Time since last boot',
      pct: null, barColor: '', valueColor: '',
    },
  ]
})

// ── GPU bars ─────────────────────────────────────────────────────────────────────

const gpuBars = computed(() => {
  const gpu = board.value.gpu ?? {}
  return [
    {
      label: 'GR3D Utilisation',
      value: gpu.util_percent != null ? gpu.util_percent + '%' : (board.value.tegrastats_available ? '0%' : 'N/A'),
      pct: gpu.util_percent ?? 0,
      color: cpuBarColor(gpu.util_percent),
      desc: 'GPU engine load · from tegrastats GR3D_FREQ',
    },
    {
      label: 'Frequency',
      value: gpu.freq_mhz != null ? fmt0(gpu.freq_mhz) + ' MHz' : '—',
      pct: gpu.freq_mhz != null && gpu.freq_max_mhz ? (gpu.freq_mhz / gpu.freq_max_mhz) * 100 : 0,
      color: '#76b900',
      desc: `devfreq · max ${gpu.freq_max_mhz ?? '?'} MHz`,
    },
    {
      label: 'EMC (Mem Controller)',
      value: gpu.emc_util_percent != null ? gpu.emc_util_percent + '%' : '—',
      pct: gpu.emc_util_percent ?? 0,
      color: '#0ea5e9',
      desc: `External memory controller · ${gpu.emc_freq_mhz ?? '—'} MHz`,
    },
  ]
})

// ── Temperature ──────────────────────────────────────────────────────────────────

const filteredTemps = computed(() => {
  const t = board.value.temperatures ?? {}
  // Prefer sysfs zones; exclude tegrastats duplicates if sysfs already has them
  const sysfsThermal = Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith('tegrastats/')))
  return Object.keys(sysfsThermal).length ? sysfsThermal : t
})

function zoneName(z: string): string {
  return z.replace('-thermal', '').replace('tegrastats/', '').toUpperCase()
}

// ── Network helpers ───────────────────────────────────────────────────────────────

function isWifi(name: string)   { return /wl/i.test(name) }
function isEth(name: string)    { return /^en/i.test(name) }
function isDocker(name: string) { return /^docker|^br-|^veth/i.test(name) }
function netRowClass(name: string): string {
  if (isWifi(name)) return 'net-row-wifi'
  if (isEth(name))  return 'net-row-eth'
  return ''
}

// ── Container helpers ─────────────────────────────────────────────────────────────

const sortedContainers = computed(() =>
  [...containers.value].sort((a, b) => {
    const order = { running: 0, restarting: 1, exited: 2 }
    return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3)
  })
)

function statusClass(s: string): string {
  if (s === 'running')    return 'ctr-running'
  if (s === 'restarting') return 'ctr-restarting'
  return 'ctr-stopped'
}
function healthClass(h: string): string {
  if (h === 'healthy')   return 'ctr-health-ok'
  if (h === 'unhealthy') return 'ctr-health-bad'
  return 'ctr-health-none'
}
function ctrRowClass(c: Container): string {
  if (c.status === 'restarting') return 'ctr-row-warn'
  if (c.restart_count > 10)      return 'ctr-row-alert'
  return ''
}

function toggleLogs(c: Container): void {
  selectedContainer.value = selectedContainer.value?.id === c.id ? null : c
  nextTick(() => {
    if (terminalRef.value) terminalRef.value.scrollTop = terminalRef.value.scrollHeight
  })
}

function termLineClass(line: string): string {
  if (!line) return ''
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes('fatal') || l.includes('exception')) return 'term-error'
  if (l.includes('warn'))  return 'term-warn'
  if (l.includes('start') || l.includes('ready') || l.includes('healthy')) return 'term-ok'
  return ''
}

// ── Memory computed ───────────────────────────────────────────────────────────────

const tegraMemPct = computed(() => {
  const m = board.value.memory
  if (!m?.tegra_used_mb || !m?.tegra_total_mb) return 0
  return Math.round((m.tegra_used_mb / m.tegra_total_mb) * 100)
})

const lfbPct = computed(() => {
  const m = board.value.memory
  if (!m?.tegra_lfb_blocks || !m?.tegra_lfb_mb) return 0
  // LFB fragmentation: lower LFB = worse. Use total lfb free as pct of total.
  const freeViaLfb = (m.tegra_lfb_blocks ?? 0) * (m.tegra_lfb_mb ?? 0)
  const total = m.tegra_total_mb ?? 1
  return Math.round((freeViaLfb / total) * 100)
})
</script>

<style>
/* ── Shared layout atoms ─────────────────────────────────────────────────────── */
.obs-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--bs-secondary-color, #6c757d);
  margin-bottom: 12px;
}
.obs-info-grid { display: flex; flex-direction: column; gap: 4px; }
.obs-info-row  { display: flex; gap: 8px; font-size: 11px; align-items: baseline; }
.obs-info-key  { font-weight: 600; color: var(--bs-secondary-color); min-width: 80px; flex-shrink: 0; }
.obs-info-val  { color: var(--bs-body-color); }

.obs-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
}
.obs-pill-green { background: rgba(63,185,80,.12); color: #3fb950; border: 1px solid rgba(63,185,80,.25); }
.obs-pill-grey  { background: rgba(108,117,125,.1); color: #6c757d; border: 1px solid rgba(108,117,125,.2); }
.obs-pill-dot   { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

.obs-pulse-dot {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #3fb950; flex-shrink: 0;
  animation: pulse-server 1.8s ease-in-out infinite;
}

/* ── Live dot ──────────────────────────────────────────────────────────────────── */
.live-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #aaa; flex-shrink: 0;
}
.live-dot.pulse-server {
  background: #3fb950;
  animation: pulse-server 1.8s ease-in-out infinite;
}
.live-dot.dot-offline { background: #aaa; }

@keyframes pulse-server {
  0%, 100% { box-shadow: 0 0 0 0 rgba(63,185,80,.7); opacity: 1; }
  50%       { box-shadow: 0 0 0 5px rgba(63,185,80,0); opacity: 0.85; }
}
.server-status-label { font-size: 11px; font-weight: 600; letter-spacing: .02em; }
.server-online  { color: #3fb950; }
.server-offline { color: #aaa; }

.log-live-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #6c757d; flex-shrink: 0; vertical-align: middle;
}
.log-live-dot-active { background: #3fb950; animation: pulse-server 1.8s ease-in-out infinite; }

.spin-icon { display: inline-block; animation: spin 1.2s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── KPI cards ───────────────────────────────────────────────────────────────── */
.kpi-card {
  border: 1px solid var(--bs-border-color);
  transition: box-shadow .2s, border-color .2s;
}
.kpi-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.07); border-color: rgba(13,110,253,.25); }
.kpi-label {
  font-size: 10px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--bs-secondary-color); margin-bottom: 6px;
}
.kpi-value {
  font-size: 24px; font-weight: 700; line-height: 1;
  font-variant-numeric: tabular-nums; color: var(--bs-body-color); margin-bottom: 2px;
}
.kpi-unit  { font-size: 12px; font-weight: 400; color: var(--bs-secondary-color); margin-left: 3px; }
.kpi-trend { font-size: 10px; color: var(--bs-secondary-color); margin-top: 3px; }
.kpi-divider { height: 1px; background: var(--bs-border-color); margin: 10px 0 8px; opacity: .6; }
.kpi-desc  { font-size: 11px; color: var(--bs-secondary-color); line-height: 1.45; flex-grow: 1; }
.kpi-range-track {
  height: 5px; border-radius: 3px; background: var(--bs-border-color); position: relative; overflow: hidden;
}
.kpi-range-fill { height: 100%; border-radius: 3px; transition: width .8s ease; }

/* ── GPU frequency chips ────────────────────────────────────────────────────── */
.freq-chip {
  padding: 1px 7px; border-radius: 20px; font-size: 9px; font-weight: 600;
  border: 1px solid var(--bs-border-color); color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg, #f8f9fa);
  font-variant-numeric: tabular-nums;
}
.freq-chip-active {
  background: rgba(118,185,0,.15); color: #76b900; border-color: rgba(118,185,0,.4);
}

/* ── Tegrastats memory block ────────────────────────────────────────────────── */
.tegra-mem-block {
  background: rgba(88,166,255,.05); border: 1px solid rgba(88,166,255,.2);
  border-radius: 8px; padding: 10px 12px;
}
.tegra-mem-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: #58a6ff; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;
}

/* ── Temperature grid ───────────────────────────────────────────────────────── */
.temp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}
.temp-card {
  background: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px solid var(--bs-border-color);
  border-radius: 8px; padding: 8px 10px;
  transition: border-color .2s;
}
.temp-card-warm { border-color: rgba(253,126,20,.4); background: rgba(253,126,20,.04); }
.temp-card-hot  { border-color: rgba(220,53,69,.4);  background: rgba(220,53,69,.04); }
.temp-zone { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--bs-secondary-color); margin-bottom: 3px; }
.temp-val  { font-size: 18px; font-weight: 700; line-height: 1; margin-bottom: 5px; color: var(--bs-body-color); }
.temp-unit { font-size: 11px; font-weight: 400; color: var(--bs-secondary-color); }
.temp-bar-track { height: 4px; border-radius: 2px; background: var(--bs-border-color); overflow: hidden; }
.temp-bar-fill  { height: 100%; border-radius: 2px; transition: width .8s ease; }

/* ── Network table ──────────────────────────────────────────────────────────── */
.net-table-wrap { overflow-x: auto; }
.net-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.net-table th {
  padding: 7px 12px; background: var(--bs-tertiary-bg, #f8f9fa);
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--bs-secondary-color); border-bottom: 1px solid var(--bs-border-color);
  white-space: nowrap;
}
.net-table td {
  padding: 7px 12px; border-bottom: 1px solid var(--bs-border-color);
  font-variant-numeric: tabular-nums;
}
.net-table tr:last-child td { border-bottom: none; }
.net-table tr:hover td { background: var(--bs-tertiary-bg, #f8f9fa); }
.net-row-wifi td:first-child { border-left: 3px solid #76b900; }
.net-row-eth  td:first-child { border-left: 3px solid #0ea5e9; }
.net-iface-name { font-weight: 600; font-family: monospace; font-size: 12px; }
.net-badge {
  display: inline-block; margin-left: 5px; padding: 1px 6px; border-radius: 10px;
  font-size: 9px; font-weight: 700; vertical-align: middle;
}
.net-badge-wifi   { background: rgba(118,185,0,.15); color: #76b900; }
.net-badge-eth    { background: rgba(14,165,233,.15); color: #0ea5e9; }
.net-badge-docker { background: rgba(13,110,253,.12); color: #0d6efd; }

/* ── Container table ────────────────────────────────────────────────────────── */
.ctr-table-wrap { overflow-x: auto; }
.ctr-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.ctr-table th {
  padding: 7px 12px; background: var(--bs-tertiary-bg, #f8f9fa);
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--bs-secondary-color); border-bottom: 1px solid var(--bs-border-color);
  white-space: nowrap;
}
.ctr-table td { padding: 8px 12px; border-bottom: 1px solid var(--bs-border-color); }
.ctr-row { cursor: pointer; transition: background .15s; }
.ctr-row:hover td { background: var(--bs-tertiary-bg, #f8f9fa); }
.ctr-row-selected td { background: rgba(13,110,253,.04) !important; border-left: 3px solid #0d6efd; }
.ctr-row-warn td { background: rgba(253,126,20,.04); }
.ctr-row-alert td { background: rgba(220,53,69,.04); }

.ctr-name { font-weight: 600; font-size: 12px; }

.ctr-status-badge {
  font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; letter-spacing: .04em;
}
.ctr-running    { background: rgba(63,185,80,.15);  color: #3fb950; }
.ctr-restarting { background: rgba(253,126,20,.15); color: #fd7e14; }
.ctr-stopped    { background: rgba(108,117,125,.12); color: #6c757d; }

.ctr-health-badge {
  font-size: 9px; font-weight: 600; padding: 2px 7px; border-radius: 20px;
}
.ctr-health-ok   { background: rgba(63,185,80,.12);  color: #3fb950; }
.ctr-health-bad  { background: rgba(220,53,69,.12);  color: #dc3545; }
.ctr-health-none { background: rgba(108,117,125,.08); color: #6c757d; }

.restart-badge {
  display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 10px; font-weight: 700;
}
.restart-ok   { background: rgba(108,117,125,.08); color: #6c757d; }
.restart-warn { background: rgba(220,53,69,.12);   color: #dc3545; }

.logs-btn {
  font-size: 10px; font-weight: 600; color: var(--bs-secondary-color);
  padding: 2px 8px; border-radius: 20px; border: 1px solid var(--bs-border-color);
  background: transparent; cursor: pointer; white-space: nowrap;
  transition: background .15s, color .15s;
}
.logs-btn:hover, .logs-btn-open {
  background: rgba(13,110,253,.08); color: #0d6efd; border-color: rgba(13,110,253,.3);
}

/* ── Terminal log ───────────────────────────────────────────────────────────── */
.terminal-box {
  background: #0d1117; color: #c9d1d9; font-size: 11.5px; line-height: 1.55;
  padding: 10px 14px 14px; height: 300px; overflow-y: auto;
  border-radius: 8px; border: 1px solid #30363d;
}
.log-toggle-btn {
  font-size: 10px; font-weight: 600; padding: 2px 10px; border-radius: 20px;
  border: 1px solid var(--bs-border-color); background: transparent;
  color: var(--bs-secondary-color); cursor: pointer;
}
.log-toggle-btn:hover { background: var(--bs-secondary-bg, #f8f9fa); }
.term-line  { white-space: pre-wrap; word-break: break-all; padding: 0.5px 0; }
.term-error { color: #ff7b72; }
.term-warn  { color: #e3b341; }
.term-ok    { color: #3fb950; }

/* ── Topology legend ────────────────────────────────────────────────────────── */
.topo-legend { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.topo-leg {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 600; color: var(--bs-secondary-color);
  text-transform: uppercase; letter-spacing: .04em;
}
.topo-leg-sw { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.topo-leg-sw-dashed {
  background: transparent;
  border: 1.5px dashed #cbd5e1;
}

/* ── Raw data panel ─────────────────────────────────────────────────────────── */
.raw-data-panel { }
.raw-data-toggle {
  display: flex; align-items: center; gap: 10px; background: none; border: none;
  font-size: 12px; font-weight: 600; color: var(--bs-secondary-color); cursor: pointer; padding: 0;
}
.raw-data-toggle:hover { color: var(--bs-body-color); }
.raw-data-sub { font-size: 10px; font-weight: 400; opacity: .7; }
.raw-data-body { margin-top: 10px; }
.raw-data-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 800px) { .raw-data-cols { grid-template-columns: 1fr; } }
.raw-data-col { display: flex; flex-direction: column; gap: 6px; }
.raw-data-col-title {
  font-size: 11px; font-weight: 700; color: var(--bs-secondary-color);
  text-transform: uppercase; letter-spacing: .06em;
  display: flex; align-items: center; gap: 8px;
}
.raw-link { font-size: 10px; font-weight: 400; color: #58a6ff; text-decoration: none; }
.raw-link:hover { text-decoration: underline; }
.raw-pre {
  background: #0d1117; color: #c9d1d9; border-radius: 8px; padding: 12px 14px;
  font-size: 10.5px; line-height: 1.5; overflow: auto; max-height: 320px;
  margin: 0; border: 1px solid #30363d;
}
</style>
