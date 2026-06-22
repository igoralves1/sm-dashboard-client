<template>
  <MainLayout>
    <div class="container-fluid px-4 py-3">

      <!-- ── Header ─────────────────────────────────────────────────────────── -->
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 class="mb-0 fw-semibold d-flex align-items-center gap-2">
            <span :class="['live-dot', !serverError ? 'pulse-server' : 'dot-offline']"></span>
            SPC Fine-Tuning Monitor
          </h4>
          <div class="d-flex align-items-center gap-2 mt-1">
            <span :class="['server-status-label', !serverError ? 'server-online' : 'server-offline']">
              {{ !serverError ? '● Server online' : '○ Server offline' }}
            </span>
            <span class="text-muted" style="font-size:12px;">· Llama-3.2-3B · LoRA adapter · RTX 5080 (17 GB VRAM) · CUDA 12.8</span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-3">
          <span :class="['status-pill', statusBadgeClass]">
            <span class="status-pill-dot"></span>{{ (metrics.status || 'idle').toUpperCase() }}
          </span>
          <button
            v-if="!isActive"
            :disabled="serverError || trainLaunching"
            :class="['btn-train-start', trainLaunching ? 'launching' : '']"
            @click="startTraining"
            :title="serverError ? 'Start metrics server first: python metrics_server.py' : ''"
          >
            <span v-if="trainLaunching" class="spin-icon">⟳</span>
            <span v-else>▶</span>
            {{ trainLaunching ? 'Starting…' : 'Start Training' }}
          </button>
          <button
            v-if="isActive"
            class="btn-train-stop"
            @click="stopTraining"
          >
            ■ Stop Training
          </button>
        </div>
      </div>

      <!-- ── Train action error ────────────────────────────────────────────── -->
      <div v-if="trainMessage" class="alert alert-danger mb-3 d-flex align-items-center justify-content-between py-2">
        <span>⚠ {{ trainMessage }}</span>
        <button class="btn-close btn-sm" @click="trainMessage = ''"></button>
      </div>

      <!-- ── Server status banner ──────────────────────────────────────────── -->
      <div v-if="serverError" class="alert alert-warning mb-4">
        <i class="tabler-alert-triangle me-2"></i>
        Cannot reach metrics server at <code>http://localhost:8765</code> —
        start training with <code>py run_training.py</code>
      </div>
      <div v-else-if="!isActive" class="alert alert-idle mb-4 d-flex align-items-center gap-3">
        <span class="idle-dot-pulse"></span>
        <div>
          <strong>Metrics server is online</strong> — no training in progress.
          <span class="ms-2 text-muted">Run <code>py run_training.py</code> in <code>books/statistics-process-control/spc-training/</code> to start a new training run. Dashboard will update automatically within 1 second.</span>
        </div>
      </div>

      <!-- ── Pipeline Stepper ───────────────────────────────────────────────── -->
      <div class="card mb-4">
        <div class="card-body pb-2">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="card-title text-uppercase text-muted mb-0" style="font-size:11px; letter-spacing:.07em;">
              Training Pipeline
            </h6>
            <span class="text-muted" style="font-size:11px;">{{ pipelineUpdatedAt }}</span>
          </div>

          <!-- Step pills -->
          <div class="pipeline-scroll-wrap"><div class="pipeline-strip">
            <template v-for="(step, idx) in pipelineSteps" :key="step.id">
              <div
                :class="['pipeline-step', `step-${step.status}`, currentStep?.id === step.id ? 'step-current' : '']"
                @click="selectedStep = step"
                :title="step.description"
              >
                <div class="step-ring">
                  <div class="step-circle">
                    <span v-if="step.status === 'done'">✓</span>
                    <span v-else-if="step.status === 'running'" class="spin-icon">⟳</span>
                    <span v-else-if="step.status === 'error'">✕</span>
                    <span v-else>{{ idx + 1 }}</span>
                  </div>
                </div>
                <div class="step-label">{{ step.label }}</div>
                <div v-if="step.status === 'running'" class="step-pulse-bar"></div>
              </div>
              <div v-if="idx < pipelineSteps.length - 1" :class="['step-connector', idx < currentStepIndex ? 'connector-done' : '']"></div>
            </template>
          </div></div><!-- /pipeline-strip + scroll-wrap -->
        </div>
      </div>

      <!-- ── Pipeline Step Cards ───────────────────────────────────────────────── -->
      <div class="mb-4">
        <div class="d-flex align-items-center gap-2 mb-3">
          <h6 class="text-uppercase text-muted mb-0" style="font-size:11px; letter-spacing:.07em;">What each step does</h6>
          <span class="text-muted" style="font-size:11px;">— click a step above to highlight it below</span>
        </div>
        <div class="step-cards-grid">
          <div
            v-for="card in STEP_CARDS" :key="card.id"
            :class="['step-exp-card', stepCardStatus(card.id)]"
            @click="selectedStep = pipelineSteps.find(s => s.id === card.id) ?? null"
          >
            <!-- Header -->
            <div class="sec-header">
              <span class="sec-icon">{{ card.icon }}</span>
              <div class="sec-meta">
                <div class="sec-num">Step {{ STEP_CARDS.indexOf(card) + 1 }}</div>
                <div class="sec-label">{{ pipelineSteps.find(s => s.id === card.id)?.label ?? card.id }}</div>
              </div>
              <span :class="['sec-badge', `sec-badge-${stepStatus(card.id)}`]">{{ stepStatus(card.id).toUpperCase() }}</span>
            </div>

            <!-- Timing row -->
            <div class="sec-timing">
              <template v-if="pipelineSteps.find(s => s.id === card.id)?.started_at">
                <span class="sec-time-pill sec-time-start">▶ {{ fmtTs(pipelineSteps.find(s => s.id === card.id)!.started_at!) }}</span>
              </template>
              <template v-else>
                <span class="sec-time-pill sec-time-none">▶ Not started</span>
              </template>
              <template v-if="pipelineSteps.find(s => s.id === card.id)?.completed_at">
                <span class="sec-time-arrow">→</span>
                <span class="sec-time-pill sec-time-end">■ {{ fmtTs(pipelineSteps.find(s => s.id === card.id)!.completed_at!) }}</span>
              </template>
            </div>

            <!-- Executor + Tools -->
            <div class="sec-exec-row">
              <div class="sec-exec-item">
                <span class="sec-exec-label">Runs on</span>
                <span class="sec-exec-val">{{ card.executor }}</span>
              </div>
              <div class="sec-exec-item">
                <span class="sec-exec-label">Tools</span>
                <span class="sec-exec-val">{{ card.tools }}</span>
              </div>
            </div>

            <!-- ── Live runtime panel (only when this step is running) ──────── -->
            <div v-if="stepStatus(card.id) === 'running'" class="sec-live-panel">
              <div class="sec-live-title">
                <span class="sec-live-pulse"></span> LIVE — Running now
              </div>

              <!-- Docker Build details -->
              <template v-if="card.id === 'docker_build'">
                <div class="sec-live-row">
                  <span class="sec-live-key">Elapsed</span>
                  <span class="sec-live-val">{{ fmtElapsed(pipelineSteps.find(s=>s.id===card.id)?.started_at) }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Status</span>
                  <span class="sec-live-val sec-live-accent">Building layers — using cache where possible</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Expected</span>
                  <span class="sec-live-val">~30s if cached · 10–20 min on first run</span>
                </div>
                <div class="sec-live-mini-log">
                  <div class="sec-live-log-title">Last output</div>
                  <div v-for="(l, i) in buildLog.lines.slice(-6)" :key="i" class="sec-live-log-line">{{ l }}</div>
                  <div v-if="logStaleSecs > 10" class="sec-live-stale">⏸ No new output for {{ logStaleSecs }}s — large file download in progress</div>
                </div>
              </template>

              <!-- PDF Extraction details -->
              <template v-else-if="card.id === 'extract'">
                <div class="sec-live-row">
                  <span class="sec-live-key">Elapsed</span>
                  <span class="sec-live-val">{{ fmtElapsed(pipelineSteps.find(s=>s.id===card.id)?.started_at) }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Dataset</span>
                  <span class="sec-live-val sec-live-accent">{{ metrics.dataset_pairs ?? '...' }} Q&amp;A pairs so far</span>
                </div>
                <div class="sec-live-mini-log">
                  <div class="sec-live-log-title">Last output</div>
                  <div v-for="(l, i) in buildLog.lines.slice(-4)" :key="i" class="sec-live-log-line">{{ l }}</div>
                </div>
              </template>

              <!-- LLM Download details -->
              <template v-else-if="card.id === 'llm_download'">
                <div class="sec-live-row">
                  <span class="sec-live-key">Elapsed</span>
                  <span class="sec-live-val">{{ fmtElapsed(pipelineSteps.find(s=>s.id===card.id)?.started_at) }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Status</span>
                  <span class="sec-live-val sec-live-accent">Downloading Llama-3.2-3B (~6 GB) from HuggingFace</span>
                </div>
                <div class="sec-live-mini-log">
                  <div class="sec-live-log-title">Last output</div>
                  <div v-for="(l, i) in buildLog.lines.slice(-4)" :key="i" class="sec-live-log-line">{{ l }}</div>
                </div>
              </template>

              <!-- LoRA Training details -->
              <template v-else-if="card.id === 'training'">
                <div class="sec-live-row">
                  <span class="sec-live-key">Elapsed</span>
                  <span class="sec-live-val">{{ fmtSec(metrics.elapsed_seconds) }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Progress</span>
                  <span class="sec-live-val sec-live-accent">Step {{ metrics.step ?? 0 }} / {{ metrics.total_steps ?? '?' }} · Epoch {{ epochDisplay }} / {{ metrics.total_epochs ?? '?' }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Loss</span>
                  <span :class="['sec-live-val', 'fw-bold', lossSignalColor(metrics.loss)]">{{ metrics.loss != null ? metrics.loss.toFixed(4) : '—' }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Learning rate</span>
                  <span class="sec-live-val">{{ metrics.learning_rate != null ? metrics.learning_rate.toExponential(2) : '—' }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Grad norm</span>
                  <span class="sec-live-val">{{ metrics.grad_norm != null ? metrics.grad_norm.toFixed(3) : '—' }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Throughput</span>
                  <span class="sec-live-val">{{ metrics.samples_per_sec != null ? metrics.samples_per_sec.toFixed(2) + ' spl/s' : '—' }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">ETA</span>
                  <span class="sec-live-val sec-live-accent">{{ fmtSec(metrics.eta_seconds) }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">GPU VRAM</span>
                  <span class="sec-live-val">{{ metrics.gpu?.vram_used_gb != null ? metrics.gpu.vram_used_gb.toFixed(1) + ' / ' + metrics.gpu.vram_total_gb?.toFixed(1) + ' GB' : '—' }}</span>
                </div>
                <div class="sec-live-progress">
                  <div class="sec-live-prog-bar" :style="{width: progressPct + '%'}"></div>
                </div>
              </template>

              <!-- GGUF Export details -->
              <template v-else-if="card.id === 'export_gguf'">
                <div class="sec-live-row">
                  <span class="sec-live-key">Elapsed</span>
                  <span class="sec-live-val">{{ fmtElapsed(pipelineSteps.find(s=>s.id===card.id)?.started_at) }}</span>
                </div>
                <div class="sec-live-row">
                  <span class="sec-live-key">Status</span>
                  <span class="sec-live-val sec-live-accent">Merging LoRA + quantizing to q4_k_m…</span>
                </div>
                <div class="sec-live-mini-log">
                  <div class="sec-live-log-title">Last output</div>
                  <div v-for="(l, i) in buildLog.lines.slice(-4)" :key="i" class="sec-live-log-line">{{ l }}</div>
                </div>
              </template>

              <!-- Generic fallback -->
              <template v-else>
                <div class="sec-live-row">
                  <span class="sec-live-key">Elapsed</span>
                  <span class="sec-live-val">{{ fmtElapsed(pipelineSteps.find(s=>s.id===card.id)?.started_at) }}</span>
                </div>
                <div class="sec-live-mini-log">
                  <div class="sec-live-log-title">Last output</div>
                  <div v-for="(l, i) in buildLog.lines.slice(-4)" :key="i" class="sec-live-log-line">{{ l }}</div>
                </div>
              </template>
            </div>

            <!-- What -->
            <div class="sec-what">{{ card.what }}</div>

            <div class="sec-section-title">How it works</div>
            <div class="sec-body">{{ card.how }}</div>

            <div class="sec-section-title">Why this matters</div>
            <div class="sec-body">{{ card.why }}</div>

            <!-- Output file block (PDF Extraction + GGUF Export) -->
            <template v-if="card.output">
              <div class="sec-section-title">Output file</div>
              <div class="sec-output-block">
                <div class="sec-output-row">
                  <span class="sec-out-key">📁 File</span>
                  <code class="sec-out-file">{{ card.output.file }}</code>
                </div>
                <div class="sec-output-row">
                  <span class="sec-out-key">📋 Format</span>
                  <span class="sec-out-val">{{ card.output.format }}</span>
                </div>
                <div class="sec-output-row">
                  <span class="sec-out-key">🔍 Structure</span>
                  <code class="sec-out-struct">{{ card.output.structure }}</code>
                </div>
                <div class="sec-output-row">
                  <span class="sec-out-key">💾 Size</span>
                  <span class="sec-out-val">{{ card.output.size }}</span>
                </div>
                <div class="sec-output-importance">{{ card.output.importance }}</div>
              </div>
            </template>

            <!-- Footer -->
            <div class="sec-footer">
              <div class="sec-row"><span class="sec-key">⏱ Typical time</span><span class="sec-val">{{ card.duration }}</span></div>
              <div class="sec-row sec-row-good"><span class="sec-key">✓ Good sign</span><span class="sec-val">{{ card.good }}</span></div>
              <div class="sec-row sec-row-bad"><span class="sec-key">⚠ Watch out</span><span class="sec-val">{{ card.bad }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Live Backend Log ───────────────────────────────────────────────── -->
      <div class="card mb-4">
        <div class="card-body p-0">
          <div class="d-flex align-items-center justify-content-between px-3 pt-3 pb-2 flex-wrap gap-2">
            <h6 class="mb-0 text-uppercase text-muted d-flex align-items-center gap-2" style="font-size:11px; letter-spacing:.07em;">
              <span :class="isActive ? 'log-live-dot' : 'log-idle-dot'"></span>
              Backend Log
              <span v-if="isActive" style="color:#3fb950; font-weight:700;">LIVE</span>
              <span v-else class="text-muted" style="font-weight:400;">— idle</span>
            </h6>
            <div class="d-flex align-items-center gap-3 flex-wrap">
              <span v-if="isActive && logStaleSecs > 10" class="log-stale-warning">
                ⏸ No new output for {{ logStaleSecs }}s — process is running but silent (e.g. large download in progress)
              </span>
              <span v-else-if="isActive && logStaleSecs > 0" class="text-muted" style="font-size:10px;">
                Last output {{ logStaleSecs }}s ago
              </span>
              <span class="text-muted" style="font-size:10px;">
                {{ showAllLog ? buildLog.total : Math.min(buildLog.total, 300) }} / {{ buildLog.total }} lines
              </span>
              <button class="log-toggle-btn" @click="showAllLog = !showAllLog">
                {{ showAllLog ? 'Show last 300' : 'Show all' }}
              </button>
              <label class="d-flex align-items-center gap-1 text-muted" style="font-size:11px; cursor:pointer;">
                <input type="checkbox" v-model="autoScroll" style="accent-color:#0d6efd;" /> Auto-scroll
              </label>
            </div>
          </div>
          <div class="terminal-box font-monospace" ref="terminalRef">
            <div v-if="buildLog.lines.length === 0" class="text-muted px-3 py-2" style="font-size:12px;">
              <span v-if="isActive">⟳ Process started — waiting for first output…</span>
              <span v-else>No log yet — start training to see output here.</span>
            </div>
            <div v-for="(line, i) in buildLog.lines" :key="i" :class="['term-line', termLineClass(line)]">{{ line || ' ' }}</div>
          </div>
        </div>
      </div>

      <!-- ── Current Step Detail + Docker Info ──────────────────────────────── -->
      <div class="row g-3 mb-4">

        <!-- Current/Selected Step Detail -->
        <div class="col-12 col-lg-7">
          <div class="card h-100" v-if="displayStep">
            <div class="card-body">
              <div class="d-flex align-items-start gap-3 mb-3">
                <div :class="['step-detail-badge', `badge-${displayStep.status}`]">
                  <span v-if="displayStep.status === 'done'">✓</span>
                  <span v-else-if="displayStep.status === 'running'" class="spin-icon">⟳</span>
                  <span v-else-if="displayStep.status === 'error'">✕</span>
                  <span v-else>#</span>
                </div>
                <div class="flex-grow-1">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <h5 class="mb-0 fw-semibold">{{ displayStep.label }}</h5>
                    <span :class="['badge', stepBadgeClass(displayStep.status)]" style="font-size:10px;">
                      {{ displayStep.status.toUpperCase() }}
                    </span>
                  </div>
                  <div class="text-muted" style="font-size:13px;">{{ displayStep.description }}</div>
                </div>
              </div>

              <!-- Explanation -->
              <div class="explanation-box mb-3">
                <div class="text-muted" style="font-size:12px; line-height:1.6;">
                  {{ displayStep.explanation }}
                </div>
              </div>

              <!-- Detail / progress note -->
              <div v-if="displayStep.detail" class="d-flex align-items-center gap-2 text-muted" style="font-size:12px;">
                <i class="tabler-info-circle"></i>
                {{ displayStep.detail }}
              </div>
              <div v-if="displayStep.error" class="d-flex align-items-center gap-2 text-danger mt-1" style="font-size:12px;">
                <i class="tabler-alert-triangle"></i>
                {{ displayStep.error }}
              </div>
              <div class="d-flex align-items-center gap-2 text-muted mt-2" style="font-size:11px;">
                <span v-if="displayStep.started_at">Started: {{ fmtTs(displayStep.started_at) }}</span>
                <span v-if="displayStep.completed_at"> · Completed: {{ fmtTs(displayStep.completed_at) }}</span>
              </div>

              <!-- Running step progress bar -->
              <div v-if="displayStep.status === 'running' && displayStep.id === 'training'" class="mt-3">
                <div class="d-flex justify-content-between mb-1" style="font-size:12px;">
                  <span class="text-muted">{{ phaseLabel }}</span>
                  <span class="fw-bold text-primary">{{ progressPct }}%</span>
                </div>
                <div class="progress" style="height:8px;">
                  <div class="progress-bar" :style="{ width: progressPct + '%', background: 'linear-gradient(90deg,#58a6ff,#bc8cff)', transition:'width 1s ease' }"></div>
                </div>
                <div class="d-flex gap-4 text-muted mt-1" style="font-size:11px;">
                  <span>Step <strong>{{ metrics.step ?? '—' }}</strong> / <strong>{{ metrics.total_steps ?? '—' }}</strong></span>
                  <span>Epoch <strong>{{ epochDisplay }}</strong> / <strong>{{ metrics.total_epochs ?? '—' }}</strong></span>
                  <span>ETA <strong>{{ fmtSec(metrics.eta_seconds) }}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Docker Info -->
        <div class="col-12 col-lg-5">
          <div class="card h-100">
            <div class="card-body d-flex flex-column" style="min-height:0;">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <h6 class="card-title text-uppercase text-muted mb-0" style="font-size:11px; letter-spacing:.07em;">
                  Docker — Images &amp; Containers
                </h6>
                <span class="text-muted" style="font-size:10px;">{{ docker.images.length }} images · {{ docker.containers.length }} containers</span>
              </div>

              <!-- Images (scrollable) -->
              <div class="mb-3">
                <div class="docker-section-label">Images</div>
                <div class="docker-scroll-list">
                  <div v-if="docker.images.length === 0" class="text-muted px-1 py-2" style="font-size:12px;">
                    No images found
                  </div>
                  <div v-for="img in docker.images" :key="img.id"
                       :class="['docker-row', img.repo?.includes('spc-training') ? 'docker-row-highlight' : '']">
                    <div class="docker-icon">🐳</div>
                    <div class="flex-grow-1 overflow-hidden">
                      <div class="fw-semibold text-truncate" style="font-size:12px;">
                        {{ img.repo === '&lt;none&gt;' || !img.repo ? '&lt;none&gt;' : img.repo }}:{{ img.tag }}
                      </div>
                      <div class="text-muted" style="font-size:11px;">{{ img.size }} · {{ img.created }}</div>
                    </div>
                    <span v-if="img.repo?.includes('spc-training')" class="badge bg-primary-subtle text-primary ms-1" style="font-size:10px; flex-shrink:0;">SPC</span>
                  </div>
                </div>
              </div>

              <!-- Containers (scrollable) -->
              <div>
                <div class="docker-section-label">Containers</div>
                <div class="docker-scroll-list">
                  <div v-if="docker.containers.length === 0" class="text-muted px-1 py-2" style="font-size:12px;">
                    No containers found
                  </div>
                  <div v-for="ctr in docker.containers" :key="ctr.id"
                       :class="['docker-row', ctr.image?.includes('spc-training') ? 'docker-row-highlight' : '']">
                    <div class="docker-icon">📦</div>
                    <div class="flex-grow-1 overflow-hidden">
                      <div class="fw-semibold text-truncate" style="font-size:12px;">{{ ctr.name }}</div>
                      <div class="text-muted text-truncate" style="font-size:11px;">{{ ctr.image }}</div>
                    </div>
                    <span :class="['badge ms-1', ctr.status?.startsWith('Up') ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary']"
                          style="font-size:10px; flex-shrink:0;">
                      {{ ctr.status?.startsWith('Up') ? 'RUNNING' : 'STOPPED' }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="text-muted mt-2" style="font-size:10px;">Refreshes every 10 s</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Training Metrics ──────────────────────────────────────────────── -->
      <div>

        <!-- KPI Row -->
        <div class="row g-2 mb-3">
          <div class="col-6 col-sm-4 col-lg-2" v-for="kpi in kpiCards" :key="kpi.label">
            <div :class="['card kpi-card h-100', kpi.cardBorder]">
              <div class="card-body d-flex flex-column py-3 px-3">
                <div class="kpi-label">{{ kpi.label }}</div>
                <div :class="['kpi-value', kpi.valueColor || '']">
                  {{ kpi.value }}<span v-if="kpi.unit" class="kpi-unit">{{ kpi.unit }}</span>
                </div>
                <div v-if="kpi.sub" class="kpi-trend">{{ kpi.sub }}</div>
                <div class="kpi-divider"></div>
                <div class="kpi-desc">{{ kpi.desc }}</div>

                <!-- Range bar -->
                <div v-if="kpi.rangePct != null" class="mt-2">
                  <div class="kpi-range-track">
                    <div class="kpi-range-fill" :style="{ width: kpi.rangePct + '%', background: kpi.rangeColor }"></div>
                    <div v-if="kpi.targetPct != null" class="kpi-range-target" :style="{ left: kpi.targetPct + '%' }"></div>
                  </div>
                  <div class="d-flex justify-content-between mt-1" style="font-size:9px; color:var(--bs-secondary-color);">
                    <span>{{ kpi.rangeMin }}</span><span>{{ kpi.rangeMax }}</span>
                  </div>
                </div>

                <div v-if="kpi.hint" :class="['kpi-hint mt-2', kpi.hintColor || 'text-muted']">
                  {{ kpi.hint }}
                </div>
                <div v-if="kpi.improve" class="kpi-improve mt-1">💡 {{ kpi.improve }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- GPU + Chart + Config -->
        <div class="row g-3 mb-3">

          <!-- GPU Panel -->
          <div class="col-12 col-lg-3">
            <div class="card h-100">
              <div class="card-body">
                <h6 class="card-title text-muted text-uppercase mb-3" style="font-size:11px; letter-spacing:.06em;">GPU — RTX 5080</h6>
                <div class="mb-3" v-for="bar in gpuBars" :key="bar.label">
                  <div class="d-flex justify-content-between mb-1">
                    <span class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.06em;">{{ bar.label }}</span>
                    <span class="fw-semibold" style="font-size:12px; font-variant-numeric:tabular-nums;">{{ bar.value }}</span>
                  </div>
                  <div class="progress" style="height:7px; border-radius:4px; background:#e9ecef;">
                    <div class="progress-bar" :style="{ width: bar.pct + '%', background: bar.color, transition:'width 1s ease' }"></div>
                  </div>
                  <div class="text-muted mt-1" style="font-size:10px;">{{ bar.desc }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Loss Chart -->
          <div class="col-12 col-lg-5">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <h6 class="card-title text-muted text-uppercase mb-0" style="font-size:11px; letter-spacing:.06em;">Training Loss Curve</h6>
                  <div class="d-flex gap-3" style="font-size:10px;">
                    <span class="text-success">● Target &lt;0.3</span>
                    <span class="text-warning">● Good &lt;0.7</span>
                    <span class="text-danger">● High &gt;1.5</span>
                  </div>
                </div>
                <VueApexCharts type="area" :height="190" :options="chartOptions" :series="chartSeries" />
                <div class="text-muted mt-1" style="font-size:10px; line-height:1.4;">
                  Loss measures prediction error — lower = better. A smooth downward curve means the model is learning.
                  Sudden spikes indicate gradient instability (check Grad Norm). Plateau means learning rate is too low.
                </div>
              </div>
            </div>
          </div>

          <!-- Training Config Panel -->
          <div class="col-12 col-lg-4">
            <div class="card h-100">
              <div class="card-body">
                <h6 class="card-title text-muted text-uppercase mb-3" style="font-size:11px; letter-spacing:.06em;">Training Config &amp; Impact</h6>
                <div class="config-table">
                  <div class="config-row" v-for="cfg in configRows" :key="cfg.param">
                    <div class="config-param">{{ cfg.param }}</div>
                    <div class="config-val">{{ cfg.value }}</div>
                    <div class="config-impact">{{ cfg.impact }}</div>
                  </div>
                </div>
                <div class="mt-3 p-2 rounded" style="background:var(--bs-tertiary-bg,#f8f9fa); font-size:10px; line-height:1.5; color:var(--bs-secondary-color);">
                  <strong style="color:var(--bs-body-color);">Expected after this run:</strong><br>
                  6 epochs × 1059 pairs = ~402 steps · Loss target <strong>0.25–0.35</strong> · Time ~16 min
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Training Step Log + Interpretation -->
        <div class="row g-3 mb-3">
          <div class="col-12 col-lg-8">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex align-items-center justify-content-between mb-3">
                  <h6 class="card-title text-muted text-uppercase mb-0" style="font-size:11px; letter-spacing:.06em;">Training Steps Log</h6>
                  <span class="text-muted" style="font-size:10px;">
                    {{ stepHistory.length }} entries · every 10 steps
                  </span>
                </div>

                <div v-if="stepHistory.length === 0" class="text-center py-4">
                  <div class="text-muted" style="font-size:13px;">Waiting for first log event…</div>
                  <div class="text-muted mt-1" style="font-size:11px;">
                    Logs fire every 10 steps · Step {{ metrics.step ?? 0 }} / {{ metrics.total_steps ?? '?' }} in progress
                  </div>
                </div>

                <div v-else class="step-log-table">
                  <div class="step-log-row step-log-header">
                    <span class="slt-step">Step</span>
                    <span class="slt-epoch">Ep.</span>
                    <span class="slt-loss">Loss</span>
                    <span class="slt-lr">LR</span>
                    <span class="slt-bar">Progress</span>
                    <span class="slt-signal">Signal</span>
                    <span class="slt-ts">Time</span>
                  </div>
                  <div v-for="(entry, i) in [...stepHistory].reverse()" :key="entry.step"
                       :class="['step-log-row', i === 0 ? 'step-log-latest' : '']">
                    <span class="slt-step fw-semibold">{{ entry.step }}</span>
                    <span class="slt-epoch text-muted">{{ entry.epoch != null ? Number(entry.epoch).toFixed(1) : '—' }}</span>
                    <span :class="['slt-loss fw-semibold', lossColor(entry.loss)]">{{ entry.loss != null ? entry.loss.toFixed(4) : '—' }}</span>
                    <span class="slt-lr text-muted font-monospace" style="font-size:10px;">{{ fmtLr(entry.lr) }}</span>
                    <span class="slt-bar">
                      <div class="mini-progress">
                        <div class="mini-progress-fill" :style="{ width: (metrics.total_steps ? Math.round(entry.step / metrics.total_steps * 100) : 0) + '%' }"></div>
                      </div>
                    </span>
                    <span :class="['slt-signal', lossSignalColor(entry.loss)]" style="font-size:10px; font-weight:600;">{{ lossSignal(entry.loss) }}</span>
                    <span class="slt-ts text-muted" style="font-size:10px;">{{ fmtTs(entry.ts) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- What's Happening Panel -->
          <div class="col-12 col-lg-4">
            <div class="card h-100">
              <div class="card-body">
                <h6 class="card-title text-muted text-uppercase mb-3" style="font-size:11px; letter-spacing:.06em;">What's Happening</h6>

                <div class="insight-block mb-3" v-for="insight in insights" :key="insight.title">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span :class="['insight-dot', insight.color]"></span>
                    <span class="fw-semibold" style="font-size:12px;">{{ insight.title }}</span>
                  </div>
                  <div class="text-muted" style="font-size:11px; line-height:1.5;">{{ insight.body }}</div>
                </div>

                <!-- Loss scale reference -->
                <div class="loss-scale mt-3">
                  <div class="loss-scale-title">Loss Reference Scale</div>
                  <div class="loss-scale-row" v-for="r in lossScale" :key="r.label">
                    <div :class="['loss-scale-dot', r.cls]"></div>
                    <span class="loss-scale-range">{{ r.range }}</span>
                    <span class="loss-scale-desc">{{ r.desc }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ── Raw Data Panel ─────────────────────────────────────────────────── -->
      <div class="raw-data-panel mt-4">
        <button class="raw-data-toggle" @click="showRawData = !showRawData">
          <span>{{ showRawData ? '▾' : '▸' }} Raw API Data</span>
          <span class="raw-data-sub">pipeline.json + metrics.json · localhost:8765 · polling every 1s</span>
        </button>
        <div v-if="showRawData" class="raw-data-body">
          <div class="raw-data-cols">
            <div class="raw-data-col">
              <div class="raw-data-col-title">
                📋 Pipeline State
                <a href="http://localhost:8765/api/pipeline" target="_blank" class="raw-link">open ↗</a>
              </div>
              <pre class="raw-pre">{{ JSON.stringify({ steps: pipelineSteps }, null, 2) }}</pre>
            </div>
            <div class="raw-data-col">
              <div class="raw-data-col-title">
                📊 Training Metrics
                <a href="http://localhost:8765/api/metrics" target="_blank" class="raw-link">open ↗</a>
              </div>
              <pre class="raw-pre">{{ JSON.stringify(metrics, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

    </div>
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import MainLayout from '@/layouts/MainLayout.vue'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string
  label: string
  description: string
  explanation: string
  status: 'done' | 'running' | 'pending' | 'error'
  detail?: string
  error?: string
  started_at?: string
  completed_at?: string
}

interface Metrics {
  status?: string
  epoch?: number
  total_epochs?: number
  step?: number
  total_steps?: number
  progress_pct?: number
  loss?: number
  learning_rate?: number
  grad_norm?: number
  samples_per_sec?: number
  elapsed_seconds?: number
  eta_seconds?: number
  gpu?: { vram_used_gb?: number; vram_total_gb?: number; vram_pct?: number; temperature_c?: number; utilization_pct?: number }
  history?: { step: number; loss: number }[]
  dataset_pairs?: number
  updated_at?: string
}

interface DockerInfo { images: any[]; containers: any[] }
interface LogEntry { ts: string; step: number; loss?: number; lr?: number }

// ── State ──────────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:8765'
const POLL_MS = 1000
const DOCKER_MS = 10000

// Static fallback — shown immediately while waiting for pipeline.json
const STATIC_STEPS: PipelineStep[] = [
  { id: 'preflight',      label: 'Pre-flight',       description: 'Docker + GPU verified',                           explanation: 'Checks that Docker Desktop is running, the NVIDIA Container Toolkit is installed, and your RTX 5080 is accessible inside containers via GPU passthrough.', status: 'pending' },
  { id: 'metrics_server', label: 'Metrics Server',   description: 'Live monitoring on port 8765',                    explanation: 'Starts a FastAPI server on your Windows machine that reads metrics.json written by the training container and serves them to this dashboard in real time.', status: 'pending' },
  { id: 'docker_build',   label: 'Docker Build',     description: 'Build CUDA 12.8 + Miniforge + PyTorch 2.7 image', explanation: 'Builds the training Docker image: Ubuntu 22.04, CUDA 12.8, Miniforge, Python 3.11, PyTorch 2.7+cu128, Unsloth, and the full HuggingFace stack. First run: 10–20 min, subsequent runs use layer cache (~30s).', status: 'pending' },
  { id: 'extract',        label: 'PDF Extraction',   description: 'Parse SPC textbooks → JSONL dataset',             explanation: 'Parses 2 SPC textbooks using PyMuPDF and pdfminer, then generates question-answer pairs formatted for instruction fine-tuning. Output: /output/spc-qa-pairs.jsonl.', status: 'pending' },
  { id: 'llm_download',   label: 'LLM Download',     description: 'Download Llama-3.2-3B from HuggingFace (~6 GB)',  explanation: 'Downloads the Llama-3.2-3B base model (~6 GB). Only on the first run — subsequent runs load from the spc_training_hf_cache Docker volume.', status: 'pending' },
  { id: 'lora_apply',     label: 'Apply LoRA',       description: 'Inject LoRA adapter layers into the model',       explanation: 'Applies LoRA (Low-Rank Adaptation) to the attention layers of Llama-3.2-3B, adding ~4M trainable parameters on top of the frozen 3B base.', status: 'pending' },
  { id: 'training',       label: 'LoRA Training',    description: 'Fine-tune on RTX 5080 (17 GB VRAM)',              explanation: 'Fine-tunes the model using SFTTrainer. Watch the Loss curve drop — lower is better. Training completes in ~20–60 minutes depending on dataset size.', status: 'pending' },
  { id: 'export_gguf',    label: 'GGUF Export',      description: 'Export merged model → spc-model-q4km.gguf',       explanation: 'Merges the LoRA adapter into the base model and quantizes to 4-bit (q4_k_m). The resulting ~1.9 GB GGUF file runs on the Jetson without needing the base model separately.', status: 'pending' },
  { id: 'complete',       label: 'Ready for Jetson', description: 'Adapter ready — commit and deploy',               explanation: 'The SPC specialist model is ready. Commit it to git via Git LFS and pull on the Jetson Orin Nano 8GB, which loads it via llama-server as a fully self-contained model.', status: 'pending' },
]

const STEP_CARDS = [
  {
    id: 'preflight',
    icon: '🔍',
    what: 'Sanity checks before anything starts. Verifies your machine is ready for GPU-accelerated training inside Docker.',
    how: 'run_training.py (Python, Windows host) calls docker info and docker run --gpus all to verify Docker Desktop is running and the RTX 5080 is visible inside containers via NVIDIA Container Toolkit.',
    why: 'Without GPU access inside Docker, training falls back to CPU and would take weeks instead of minutes. Catching this in 5 seconds saves hours of confusion later.',
    duration: '~5 seconds',
    good: 'All checks pass → green circle. GPU detected → training can use CUDA 12.8.',
    bad: 'NVIDIA Container Toolkit missing → install nvidia-container-toolkit and restart Docker Desktop.',
    executor: 'Windows host · run_training.py',
    tools: 'Python 3.x · Docker CLI · nvidia-container-toolkit',
    output: null,
  },
  {
    id: 'metrics_server',
    icon: '📡',
    what: 'Starts the live data bridge between the training container and this browser dashboard.',
    how: 'run_training.py spawns metrics_server.py as a background process on your Windows PC. The server (FastAPI + uvicorn) listens on port 8765. Every second this dashboard polls /api/metrics, /api/pipeline, and /api/docker from that server.',
    why: 'Docker containers are isolated — they have no access to your browser. This server reads output/metrics.json (written every 5s by the training container) and makes it available to the browser in real time.',
    duration: '~2 seconds to start',
    good: 'Green pulsing dot in the header + "Server online" banner. All dashboard panels become live.',
    bad: 'Port 8765 already in use → run: netstat -ano | findstr 8765 to find and kill the blocking process.',
    executor: 'Windows host · metrics_server.py',
    tools: 'Python · FastAPI · uvicorn · CORS middleware',
    output: null,
  },
  {
    id: 'docker_build',
    icon: '🐳',
    what: 'Builds the isolated, reproducible AI training environment as a Docker image (~31 GB).',
    how: 'docker compose build reads the Dockerfile and layers: Ubuntu 22.04 → CUDA 12.8 base (nvidia/cuda) → Miniforge Python 3.11 → PyTorch 2.7+cu128 → Unsloth (LoRA speed library) → HuggingFace Transformers, PEFT, TRL, Accelerate → training scripts.',
    why: 'Guarantees the exact same CUDA version, Python version, and library versions every single run — on any Windows PC. Eliminates "it works on my machine" issues caused by version mismatches.',
    duration: '10–20 min first run · ~30s on re-runs (Docker layer cache)',
    good: 'Image spc-training:latest appears in the Docker panel → ~31 GB. Re-runs rebuild only changed layers (seconds).',
    bad: 'Build fails mid-way → usually a network timeout. Re-run: Docker resumes from the last cached layer automatically.',
    executor: 'Docker Desktop · BuildKit',
    tools: 'docker compose · Dockerfile · nvidia/cuda:12.8.1-base-ubuntu22.04 base image',
    output: null,
  },
  {
    id: 'extract',
    icon: '📄',
    what: 'Parses SPC textbooks and converts them into structured AI training data — the "curriculum" the model will study.',
    how: 'The training container runs scripts/1_extract.py using PyMuPDF + pdfminer to read both PDF books page by page. It cleans the text, then generates Q&A pairs in Alpaca instruction format using heuristics and keyword matching for SPC concepts (control limits, Cpk, Western Electric rules, etc.).',
    why: 'AI models learn from examples, not raw text. The model needs thousands of (question → expert answer) pairs to learn SPC behavior. The quality and quantity of these pairs directly determines model quality.',
    duration: '1–3 minutes',
    good: '1000+ Q&A pairs generated. More diverse pairs → better model coverage of SPC topics.',
    bad: 'Fewer than 100 pairs → PDF parsing failed. Verify the PDF files exist in books/statistics-process-control/.',
    executor: 'Docker container · spc-training:latest',
    tools: 'Python · PyMuPDF (fitz) · pdfminer · scripts/1_extract.py',
    output: {
      file: 'output/spc-qa-pairs.jsonl',
      format: 'JSONL — one JSON object per line',
      structure: '{ "instruction": "What is a control chart?", "input": "", "output": "A control chart is..." }',
      size: '~2 MB · ~1059 pairs',
      importance: 'This is the entire training dataset. Every answer the model learns comes from this file. Better pairs = smarter model. This file is committed to git for reproducibility.',
    },
  },
  {
    id: 'llm_download',
    icon: '⬇️',
    what: 'Downloads Meta\'s Llama-3.2-3B-Instruct base model — the pre-trained brain we will specialize for SPC.',
    how: 'HuggingFace Hub CLI downloads ~6 GB of model weights (safetensors shards) + tokenizer into the Docker volume spc_training_hf_cache. The volume persists between runs so the download only happens once.',
    why: 'We start from a model that already understands language, grammar, logic, and general knowledge from trillions of tokens. Fine-tuning specializes it for SPC in minutes. Training from scratch would require months and petabytes of data.',
    duration: '5–15 min first run (depends on internet) · ~10s on re-runs (cached volume)',
    good: 'Volume spc_training_hf_cache exists → step is skipped. "Loading model from cache" appears in the log.',
    bad: 'HuggingFace rate limit or slow connection → just wait. The download is resumable. Alternatively set HF_TOKEN in the environment.',
    executor: 'Docker container · spc-training:latest',
    tools: 'Python · HuggingFace Hub · huggingface_hub.snapshot_download · Docker volume: spc_training_hf_cache',
    output: null,
  },
  {
    id: 'lora_apply',
    icon: '🔧',
    what: 'Injects tiny trainable "learning patches" (LoRA adapters) into the frozen base model.',
    how: 'Unsloth\'s FastLanguageModel.get_peft_model() wraps Llama-3.2-3B with LoRA matrices (rank r=32, alpha=64) injected into 7 attention layers: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj. All 3B base weights are frozen — only the ~4M new LoRA parameters are trainable.',
    why: 'Training all 3 billion parameters would need 80+ GB VRAM and days of compute. LoRA adds only 0.13% extra parameters but captures 95%+ of the fine-tuning benefit. This makes training feasible on a single RTX 5080 (16 GB VRAM) in ~20 minutes.',
    duration: '~30 seconds',
    good: 'r=32 → ~4M trainable params. alpha=64 (2×r) → good scaling. Unsloth applies 2× memory optimizations automatically.',
    bad: 'OOM error → lower r (try r=16) or reduce batch_size in training_config.yaml. Each r-step ≈ 128 MB extra VRAM.',
    executor: 'Docker container · spc-training:latest',
    tools: 'Python · Unsloth · PEFT (HuggingFace) · scripts/2_train.py',
    output: null,
  },
  {
    id: 'training',
    icon: '🧠',
    what: 'The actual learning — the model reads every SPC Q&A pair 6 times and adjusts its weights to answer correctly.',
    how: 'SFTTrainer feeds batches of Q&A pairs to the model. For each batch: (1) model predicts the answer token by token, (2) cross-entropy loss measures how wrong each token prediction was, (3) AdamW optimizer back-propagates the error and nudges the LoRA weights. Repeats for 6 epochs × 1059 pairs = 402 total steps. Output metrics written to output/metrics.json every 10 steps.',
    why: 'This is where the knowledge transfer happens. Step by step, the LoRA weights learn to steer Llama away from generic answers toward expert SPC reasoning — interpreting control charts, detecting Western Electric rule violations, computing Cpk implications, recommending corrective actions.',
    duration: '~15–20 min (6 epochs · RTX 5080 · batch 2×8=16)',
    good: 'Loss drops steadily: 1.5 (start) → 0.7 (epoch 1) → 0.4 (epoch 3) → ~0.3 (epoch 6). Smooth curve = stable learning.',
    bad: 'Loss stuck >1.0 after epoch 3 → add more epochs. Spiking loss → lower learning_rate. OOM → reduce batch_size or max_seq_length.',
    executor: 'Docker container · spc-training:latest · RTX 5080 GPU',
    tools: 'Python · Unsloth · TRL SFTTrainer · PyTorch 2.7+cu128 · CUDA 12.8 · scripts/2_train.py',
    output: null,
  },
  {
    id: 'export_gguf',
    icon: '📦',
    what: 'Merges the LoRA adapter back into the base model and compresses it into a single deployable file.',
    how: 'Unsloth\'s model.save_pretrained_gguf() merges the 4M LoRA weights into the 3B base weights (dequantize → add → re-quantize) then applies q4_k_m quantization: each weight stored in 4 bits instead of 16 bits using K-means clustering per block. Output is a single .gguf file readable by llama.cpp and llama-server.',
    why: 'The Jetson Orin Nano has 8 GB RAM. The merged full-precision model would need ~12 GB. 4-bit quantization shrinks it to ~1.9 GB with only ~2–3% accuracy loss — it fits easily and runs at real-time inference speed.',
    duration: '5–8 min (merge 3B params + quantize to 4-bit)',
    good: 'output/adapter_gguf/llama-3.2-3b-instruct.Q4_K_M.gguf created · ~1.9 GB · loads in llama-server in <10s on Jetson.',
    bad: 'VRAM error during merge → close other GPU apps and re-run. The merge temporarily needs ~8 GB VRAM.',
    executor: 'Docker container · spc-training:latest · RTX 5080 GPU',
    tools: 'Python · Unsloth · llama.cpp quantize · scripts/2_train.py',
    output: {
      file: 'output/adapter_gguf/llama-3.2-3b-instruct.Q4_K_M.gguf',
      format: 'GGUF — llama.cpp binary format',
      structure: 'Self-contained: base model weights + LoRA merged + 4-bit quantized. No separate adapter file needed.',
      size: '~1.9 GB',
      importance: 'This is the final deployable model. Tracked by Git LFS. Pull it on the Jetson and it runs immediately — no Python, no HuggingFace, no GPU required for inference.',
    },
  },
  {
    id: 'complete',
    icon: '🚀',
    what: 'The SPC expert model is ready. Commit it to git and deploy to the Jetson factory device.',
    how: 'git lfs track *.gguf ensures the 1.9 GB file is handled by Git Large File Storage (not regular git). git add + git commit + git push uploads it to GitHub. On the Jetson: git pull downloads it, then llama-server --model spc-model-q4km.gguf starts the local inference API. The spc_agent sends POST requests to it for SPC analysis.',
    why: 'The whole point: a private, offline, sub-second SPC expert running on a $150 Jetson Orin Nano on the factory floor — no cloud subscription, no data leaving the plant, no internet dependency.',
    duration: 'git push: ~5 min (1.9 GB via LFS) · git pull on Jetson: ~2 min · llama-server load: ~8s',
    good: 'Loss ~0.25–0.35 → model gives accurate SPC answers. Test: ask "Is a process with Cpk=1.1 capable?" — should explain 1.33 target.',
    bad: 'Loss >0.7 → re-train with more epochs (try 8–10) or extract more Q&A pairs from additional SPC reference books.',
    executor: 'Windows host (git push) · Jetson Orin Nano (inference)',
    tools: 'git · git-lfs · llama-server (llama.cpp) · spc_agent',
    output: null,
  },
]

const metrics = ref<Metrics>({})
const pipelineSteps = ref<PipelineStep[]>(STATIC_STEPS)
const pipelineUpdatedAt = ref('')
const docker = ref<DockerInfo>({ images: [], containers: [] })
const buildLog = ref<{ lines: string[]; total: number }>({ lines: [], total: 0 })
const logLastChangedAt = ref(Date.now())
const logStaleSecs = ref(0)
const showAllLog = ref(false)
let logStaleTimer: ReturnType<typeof setInterval> | null = null
const selectedStep = ref<PipelineStep | null>(null)
const serverError = ref(false)
const showRawData = ref(false)
const trainLaunching = ref(false)
const trainMessage = ref('')
const logBuffer = ref<LogEntry[]>([])
const terminalRef = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
let lastStep = -1
let pollTimer: ReturnType<typeof setTimeout> | null = null
let dockerTimer: ReturnType<typeof setInterval> | null = null
let logTimer: ReturnType<typeof setInterval> | null = null

// ── Computed ───────────────────────────────────────────────────────────────────

const currentStep = computed(() =>
  pipelineSteps.value.find(s => s.status === 'running') ||
  pipelineSteps.value.filter(s => s.status === 'done').at(-1) ||
  pipelineSteps.value[0]
)

const currentStepIndex = computed(() =>
  pipelineSteps.value.findIndex(s => s.id === currentStep.value?.id)
)

const displayStep = computed(() => selectedStep.value || currentStep.value)

const isActive = computed(() =>
  ['training', 'extracting'].includes(metrics.value.status ?? '') ||
  pipelineSteps.value.some(s => s.status === 'running')
)

const showMetrics = computed(() =>
  ['training', 'complete'].includes(metrics.value.status || '') ||
  pipelineSteps.value.some(s => s.id === 'training' && (s.status === 'running' || s.status === 'done'))
)

const progressPct = computed(() => (metrics.value.progress_pct ?? 0).toFixed(1))
const epochDisplay = computed(() => metrics.value.epoch != null ? Number(metrics.value.epoch).toFixed(1) : '—')

const phaseLabel = computed(() => {
  const s = metrics.value.status
  if (s === 'extracting') return 'Extracting PDFs…'
  if (s === 'training') return `Training — Epoch ${metrics.value.epoch ?? '—'} / ${metrics.value.total_epochs ?? '—'}`
  if (s === 'complete') return 'Training complete ✓'
  return 'Waiting…'
})

const statusBadgeClass = computed(() => {
  const s = metrics.value.status
  if (s === 'training')   return 'bg-success text-white'
  if (s === 'extracting') return 'bg-primary text-white'
  if (s === 'complete')   return 'bg-success text-white'
  if (s === 'error')      return 'bg-danger text-white'
  return 'bg-secondary text-white'
})

const lossTrend = computed(() => {
  const h = metrics.value.history
  if (!h || h.length < 2) return ''
  const delta = h[h.length - 1].loss - h[0].loss
  return delta < 0 ? `↓ ${Math.abs(delta).toFixed(4)} from start` : `↑ ${delta.toFixed(4)} from start`
})

const kpiCards = computed(() => {
  const loss = metrics.value.loss
  const gn   = metrics.value.grad_norm
  const lr   = metrics.value.learning_rate
  const sps  = metrics.value.samples_per_sec

  // Loss range: 0 (perfect) → 3 (bad). Target < 0.3
  const lossRangePct = loss != null ? Math.min(100, (loss / 3) * 100) : null
  const lossColor_ = loss == null ? '#6c757d' : loss < 0.3 ? '#198754' : loss < 0.7 ? '#fd7e14' : loss < 1.5 ? '#ffc107' : '#dc3545'

  // Grad norm: 0 → 5 range, target < 1
  const gnRangePct = gn != null ? Math.min(100, (gn / 5) * 100) : null
  const gnColor = gn == null ? '#6c757d' : gn < 1 ? '#198754' : gn < 3 ? '#ffc107' : '#dc3545'

  // LR: 0 → 0.0002 (peak). Cosine decays to 0
  const lrRangePct = lr != null ? Math.min(100, (lr / 0.0002) * 100) : null

  return [
    {
      label: 'Loss',
      value: loss != null ? loss.toFixed(4) : '—',
      sub:   lossTrend.value,
      desc:  'Cross-entropy — how wrong predictions are. Lower = better. Starts ~2–3, target <0.3 for quality SPC answers.',
      hint:  loss == null ? 'Logged every 10 steps' : loss < 0.3 ? '✓ Excellent — target reached' : loss < 0.7 ? '✓ Good — converging well' : loss < 1.5 ? '↓ Learning — on track' : '⚠ High — warming up',
      hintColor: loss == null ? '' : loss < 0.3 ? 'text-success' : loss < 0.7 ? 'text-success' : loss < 1.5 ? 'text-primary' : 'text-warning',
      improve: loss != null && loss > 0.7 ? 'More epochs or higher LoRA rank will reduce loss further' : undefined,
      cardBorder: loss != null && loss < 0.3 ? 'border-success' : '',
      valueColor: loss != null ? (loss < 0.7 ? 'text-success' : loss < 1.5 ? 'text-primary' : 'text-warning') : '',
      rangePct: lossRangePct,
      rangeColor: lossColor_,
      targetPct: 10, // 0.3/3 = 10%
      rangeMin: '0 (perfect)',
      rangeMax: '3+ (bad)',
    },
    {
      label: 'Learning Rate',
      value: fmtLr(lr),
      desc:  'Step size for weight updates. Cosine schedule: warms up to 2e-4 then decays to ~0. Smaller = more stable but slower.',
      hint:  lr == null ? 'Starts after warmup steps' : lr > 0.00015 ? '↗ Warmup / peak phase' : lr > 0.00005 ? '↘ Decay phase — normal' : '↓ Near end of training',
      hintColor: '',
      rangePct: lrRangePct,
      rangeColor: '#0d6efd',
      rangeMin: '0 (end)',
      rangeMax: '2e-4 (peak)',
    },
    {
      label: 'Grad Norm',
      value: gn != null ? gn.toFixed(3) : '—',
      desc:  'Magnitude of weight update gradients. Measures stability. Spikes >5 = possible exploding gradients — reduce LR or batch size.',
      hint:  gn == null ? 'Appears after step 10' : gn < 0.5 ? '✓ Very stable' : gn < 1 ? '✓ Stable' : gn < 3 ? '⚠ Moderate — watch' : '⚠ High — check LR',
      hintColor: gn == null ? '' : gn < 1 ? 'text-success' : gn < 3 ? 'text-warning' : 'text-danger',
      improve: gn != null && gn > 3 ? 'Reduce learning_rate or batch_size if norm stays high' : undefined,
      rangePct: gnRangePct,
      rangeColor: gnColor,
      targetPct: 20, // 1/5 = 20%
      rangeMin: '0',
      rangeMax: '5 (unstable)',
    },
    {
      label: 'Throughput',
      value: sps != null ? sps.toFixed(1) : '—',
      unit:  'spl/s',
      desc:  'Samples processed per second. RTX 5080 at batch=2, seq=1024. Higher = better GPU utilization. Typical: 0.4–1.0 spl/s.',
      hint:  sps == null ? 'Measured once training starts' : sps > 0.8 ? '✓ Good GPU utilization' : sps > 0.4 ? '~ Normal for this config' : '⚠ Low — check VRAM',
      hintColor: sps == null ? '' : sps > 0.8 ? 'text-success' : sps > 0.4 ? '' : 'text-warning',
      improve: sps != null && sps < 0.4 ? 'Increase batch_size if VRAM allows; enable packing=True' : undefined,
    },
    {
      label: 'Elapsed',
      value: fmtSec(metrics.value.elapsed_seconds),
      desc:  'Wall-clock time since training began. 402 steps at ~2.2s each ≈ 15 min total for this 6-epoch run.',
      hint:  `${metrics.value.step ?? 0} / ${metrics.value.total_steps ?? '?'} steps done`,
      hintColor: '',
    },
    {
      label: 'ETA',
      value: (() => {
        const exportRunning = pipelineSteps.value.some(s => s.id === 'export_gguf' && s.status === 'running')
        if (exportRunning) return 'Exporting GGUF…'
        if (metrics.value.status === 'complete' || metrics.value.eta_seconds === 0) return 'Done'
        return fmtSec(metrics.value.eta_seconds)
      })(),
      desc:  'Estimated time remaining based on current step throughput. After training: GGUF export adds ~5–8 min for merge+quantize.',
      hint:  (() => {
        const exportRunning = pipelineSteps.value.some(s => s.id === 'export_gguf' && s.status === 'running')
        if (exportRunning) return '⏳ Merging LoRA + quantizing to q4_k_m…'
        if (metrics.value.status === 'complete') return '✓ Training complete!'
        return metrics.value.eta_seconds == null ? 'Calculated after first log event' : metrics.value.eta_seconds < 120 ? '✓ Almost done!' : 'Based on current throughput'
      })(),
      hintColor: metrics.value.eta_seconds != null && metrics.value.eta_seconds < 120 ? 'text-success' : '',
    },
  ]
})

const configRows = computed(() => [
  { param: 'Epochs',      value: String(metrics.value.total_epochs ?? 6),  impact: 'More passes = lower loss. 6 → target ~0.3' },
  { param: 'LoRA Rank',   value: 'r=32',                                    impact: 'Higher = more capacity. r=32 vs r=16 before' },
  { param: 'Batch Size',  value: '2 × 8 = 16 effective',                   impact: 'Larger effective batch = more stable gradients' },
  { param: 'Seq Length',  value: '1024 tokens',                             impact: 'Max tokens per sample. 2048 caused OOM on RTX 5080' },
  { param: 'LR',          value: '2e-4 cosine',                             impact: 'Warmup 50 steps → decay → ~0 at end' },
  { param: 'Dataset',     value: `${metrics.value.dataset_pairs ?? 1059} pairs`, impact: 'Q&A pairs from Oakland + Zontec SPC books' },
])

const insights = computed(() => {
  const loss = metrics.value.loss
  const gn   = metrics.value.grad_norm
  const step = metrics.value.step ?? 0
  const total = metrics.value.total_steps ?? 402
  const ep   = metrics.value.epoch ?? 0
  const pct  = total > 0 ? (step / total * 100) : 0
  const list = []

  if (metrics.value.status === 'training') {
    list.push({
      title: 'Training Active',
      body: `Step ${step}/${total} (${pct.toFixed(0)}%) · Epoch ${Number(ep).toFixed(1)} of ${metrics.value.total_epochs ?? 6}. The model is seeing each SPC Q&A pair multiple times, adjusting ~4M LoRA parameters.`,
      color: 'dot-blue',
    })
  }

  if (loss != null) {
    const lossMsg = loss < 0.3
      ? `Loss ${loss.toFixed(4)} — excellent. The model confidently predicts correct SPC answers.`
      : loss < 0.7
      ? `Loss ${loss.toFixed(4)} — good. Model understands most SPC concepts. Continue to epoch 6 for further improvement.`
      : loss < 1.5
      ? `Loss ${loss.toFixed(4)} — learning actively. Still dropping — this is normal in early epochs.`
      : `Loss ${loss.toFixed(4)} — high, but expected early in training. Will drop sharply in epochs 2–3.`
    list.push({ title: 'Loss Status', body: lossMsg, color: loss < 0.7 ? 'dot-green' : loss < 1.5 ? 'dot-blue' : 'dot-orange' })
  }

  if (gn != null && gn > 2) {
    list.push({ title: 'Grad Norm Warning', body: `Gradient norm ${gn.toFixed(3)} is elevated. Not critical yet, but if it exceeds 5 consistently, reduce learning_rate to 1e-4 in training_config.yaml.`, color: 'dot-orange' })
  } else if (gn != null) {
    list.push({ title: 'Gradients Stable', body: `Norm ${gn.toFixed(3)} — well within safe range (<1.0). Training is numerically stable. No action needed.`, color: 'dot-green' })
  }

  if (metrics.value.status === 'complete') {
    list.push({ title: 'Training Complete ✓', body: 'Model trained. GGUF export takes ~5 min to merge LoRA weights + quantize to q4_k_m. Then commit output/adapter_gguf/ to git and pull on Jetson.', color: 'dot-green' })
  }

  if (list.length === 0) {
    list.push({ title: 'Waiting for Training', body: 'Start training with `py run_training.py` from the spc-training/ directory. The metrics server must be running on port 8765.', color: 'dot-grey' })
  }

  return list
})

const lossScale = [
  { range: '< 0.1',   desc: 'Perfect — may overfit',     cls: 'ls-perfect' },
  { range: '0.1–0.3', desc: 'Excellent — target zone',   cls: 'ls-excellent' },
  { range: '0.3–0.7', desc: 'Good — model understands',  cls: 'ls-good' },
  { range: '0.7–1.5', desc: 'Learning — keep training',  cls: 'ls-ok' },
  { range: '1.5–3.0', desc: 'Early phase — normal start',cls: 'ls-warm' },
  { range: '3.0+',    desc: 'High — check data/config',  cls: 'ls-bad' },
]

function lossSignal(loss?: number): string {
  if (loss == null) return '—'
  if (loss < 0.3)  return '✓ Excellent'
  if (loss < 0.7)  return '✓ Good'
  if (loss < 1.5)  return '↓ Learning'
  if (loss < 3.0)  return '⟳ Warming'
  return '⚠ High'
}

function lossSignalColor(loss?: number): string {
  if (loss == null) return 'text-muted'
  if (loss < 0.7)  return 'text-success'
  if (loss < 1.5)  return 'text-primary'
  if (loss < 3.0)  return 'text-warning'
  return 'text-danger'
}

// History from metrics.json — persists across page reloads, always up to date
const stepHistory = computed(() => (metrics.value.history ?? []).slice(-40))

function lossColor(loss?: number): string {
  if (loss == null) return 'text-muted'
  if (loss > 2.5)  return 'text-danger'
  if (loss > 1.5)  return 'text-warning'
  return 'text-success'
}

const gpuBars = computed(() => {
  const g = metrics.value.gpu || {}
  const vramPct = g.vram_pct ?? 0
  const utilPct = g.utilization_pct ?? 0
  const tempC   = g.temperature_c ?? 0
  return [
    {
      label: 'VRAM',
      value: g.vram_used_gb != null ? `${g.vram_used_gb.toFixed(1)} / ${g.vram_total_gb?.toFixed(1)} GB (${vramPct.toFixed(0)}%)` : '—',
      pct:   vramPct,
      color: vramPct > 90 ? '#dc3545' : vramPct > 70 ? '#fd7e14' : 'linear-gradient(90deg,#bc8cff,#e879f9)',
      desc:  vramPct > 90 ? '⚠ Near limit — risk of OOM' : vramPct > 70 ? 'High — monitor closely' : 'Healthy VRAM usage',
    },
    {
      label: 'Utilization',
      value: g.utilization_pct != null ? `${utilPct}%` : 'n/a',
      pct:   utilPct,
      color: 'linear-gradient(90deg,#3fb950,#4ade80)',
      desc:  utilPct > 80 ? '✓ GPU fully engaged' : utilPct > 40 ? 'Moderate — data loading may limit' : utilPct === 0 ? 'GPU idle — not training' : 'Low utilization',
    },
    {
      label: 'Temperature',
      value: g.temperature_c != null ? `${tempC} °C` : 'n/a',
      pct:   Math.min(100, tempC * 100 / 95),
      color: tempC > 85 ? '#dc3545' : tempC > 75 ? '#fd7e14' : 'linear-gradient(90deg,#d29922,#ff7b72)',
      desc:  tempC > 85 ? '⚠ Hot — check cooling' : tempC > 75 ? 'Warm — normal under load' : tempC > 0 ? '✓ Cool — good airflow' : 'Not reported (pynvml)',
    },
  ]
})

// ── Chart ──────────────────────────────────────────────────────────────────────

const chartSeries = ref([{ name: 'Loss', data: [] as { x: number; y: number }[] }])
const chartOptions = ref<ApexOptions>({
  chart: { type: 'area', toolbar: { show: false }, animations: { enabled: true, speed: 400 }, background: 'transparent' },
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.15, opacityTo: 0.01 } },
  colors: ['#58a6ff'],
  dataLabels: { enabled: false },
  xaxis: {
    type: 'numeric',
    title: { text: 'Step', style: { fontSize: '11px' } },
    labels: { style: { fontSize: '11px' } },
    axisBorder: { show: false },
  },
  yaxis: {
    title: { text: 'Loss', style: { fontSize: '11px' } },
    labels: { style: { fontSize: '11px' }, formatter: (v: number) => v.toFixed(4) },
  },
  grid: { borderColor: '#e9ecef', strokeDashArray: 4 },
  tooltip: { y: { formatter: (v: number) => v.toFixed(4) } },
  legend: { show: false },
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtElapsed(startedAt?: string): string {
  if (!startedAt) return '—'
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  return fmtSec(diff)
}

function fmtSec(s?: number): string {
  if (s == null) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss.toString().padStart(2, '0')}s`
  return `${ss}s`
}

function fmtLr(v?: number): string {
  if (v == null) return '—'
  return v < 0.0001 ? v.toExponential(2) : v.toFixed(6)
}

function fmtTs(iso?: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString() } catch { return iso }
}

function termLineClass(line: string): string {
  if (/error|failed|ERROR|FAILED/i.test(line)) return 'term-error'
  if (/warning|WARN/i.test(line)) return 'term-warn'
  if (/done|complete|success|DONE|✓/i.test(line)) return 'term-ok'
  if (/^#\d+/.test(line)) return 'term-step'
  return ''
}

function stepBadgeClass(status: string): string {
  if (status === 'done')    return 'bg-success-subtle text-success'
  if (status === 'running') return 'bg-primary-subtle text-primary'
  if (status === 'error')   return 'bg-danger-subtle text-danger'
  return 'bg-secondary-subtle text-secondary'
}

async function startTraining() {
  trainLaunching.value = true
  trainMessage.value = ''
  try {
    const res = await fetch('http://localhost:8765/api/start-training', { method: 'POST' })
    const data = await res.json()
    if (!data.ok) trainMessage.value = data.error ?? 'Failed to start training.'
  } catch {
    trainMessage.value = 'Could not reach metrics server. Is it running?'
  } finally {
    trainLaunching.value = false
  }
}

async function stopTraining() {
  if (!confirm('Stop the training run? This will kill run_training.py and all Docker containers.')) return
  try {
    const res = await fetch('http://localhost:8765/api/stop-training', { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      trainMessage.value = `Stopped: ${data.killed?.join(', ') ?? 'process terminated'}`
    } else {
      trainMessage.value = data.error ?? 'Stop failed.'
    }
  } catch {
    trainMessage.value = 'Could not reach metrics server.'
  }
}

function stepStatus(id: string): string {
  return pipelineSteps.value.find(s => s.id === id)?.status ?? 'pending'
}

function stepCardStatus(id: string): string {
  const s = stepStatus(id)
  if (s === 'done')    return 'sec-done'
  if (s === 'running') return 'sec-running'
  if (s === 'error')   return 'sec-error'
  const idx = pipelineSteps.value.findIndex(s => s.id === id)
  const currentIdx = currentStepIndex.value
  if (idx < currentIdx) return 'sec-done'
  return 'sec-pending'
}

// ── Polling ────────────────────────────────────────────────────────────────────

async function pollAll() {
  try {
    const [mRes, pRes] = await Promise.all([
      fetch(`${BASE}/api/metrics`),
      fetch(`${BASE}/api/pipeline`),
    ])

    if (mRes.ok) {
      const m: Metrics = await mRes.json()
      metrics.value = m
      serverError.value = false

      if (m.history?.length) {
        chartSeries.value = [{ name: 'Loss', data: m.history.map(h => ({ x: h.step, y: h.loss })) }]
      }
      if (m.step && m.step !== lastStep) {
        lastStep = m.step
        logBuffer.value.push({ ts: new Date().toLocaleTimeString(), step: m.step, loss: m.loss, lr: m.learning_rate })
        if (logBuffer.value.length > 40) logBuffer.value.shift()
      }
    }

    if (pRes.ok) {
      const p = await pRes.json()
      if (p.steps?.length) pipelineSteps.value = p.steps
      if (p.updated_at) pipelineUpdatedAt.value = 'Updated ' + fmtTs(p.updated_at)
    }
  } catch {
    serverError.value = true
  }
  pollTimer = setTimeout(pollAll, POLL_MS)
}

async function pollDocker() {
  try {
    const res = await fetch(`${BASE}/api/docker`)
    if (res.ok) docker.value = await res.json()
  } catch { /* silent */ }
}

async function pollLog() {
  try {
    const res = await fetch(`${BASE}/api/log?tail=${showAllLog.value ? 9999 : 300}`)
    if (res.ok) {
      const data = await res.json()
      if (data.total !== buildLog.value.total) {
        logLastChangedAt.value = Date.now()
        logStaleSecs.value = 0
      }
      buildLog.value = data
      if (autoScroll.value) {
        await nextTick()
        if (terminalRef.value) terminalRef.value.scrollTop = terminalRef.value.scrollHeight
      }
    }
  } catch { /* silent */ }
}

onMounted(() => {
  pollAll()
  pollDocker()
  pollLog()
  dockerTimer = setInterval(pollDocker, DOCKER_MS)
  logTimer = setInterval(pollLog, 1000)
  logStaleTimer = setInterval(() => {
    if (isActive.value) logStaleSecs.value = Math.floor((Date.now() - logLastChangedAt.value) / 1000)
    else logStaleSecs.value = 0
  }, 1000)
})

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
  if (dockerTimer) clearInterval(dockerTimer)
  if (logTimer) clearInterval(logTimer)
  if (logStaleTimer) clearInterval(logStaleTimer)
})
</script>

<style scoped>
/* ── Status pill ─────────────────────────────────────────────────────────────── */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .05em;
  padding: 5px 14px;
  border-radius: 20px;
  border: 1.5px solid currentColor;
}
.status-pill.bg-primary-subtle   { color: #58a6ff; border-color: rgba(88,166,255,.4); background: rgba(88,166,255,.1) !important; }
.status-pill.bg-success-subtle   { color: #3fb950; border-color: rgba(63,185,80,.4);  background: rgba(63,185,80,.1) !important; }
.status-pill.bg-danger-subtle    { color: #f85149; border-color: rgba(248,81,73,.4);  background: rgba(248,81,73,.1) !important; }
.status-pill.bg-secondary-subtle { color: #8b949e; border-color: rgba(139,148,158,.3); background: rgba(139,148,158,.08) !important; }
.status-pill-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* ── Raw data panel ──────────────────────────────────────────────────────────── */
.raw-data-panel { border-top: 1px solid var(--bs-border-color, #e5e7eb); padding-top: 12px; }
.raw-data-toggle {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  color: var(--bs-secondary-color, #6c757d);
  font-size: 12px;
  font-weight: 600;
  width: 100%;
  text-align: left;
}
.raw-data-toggle:hover { color: var(--bs-body-color); }
.raw-data-sub { font-size: 11px; font-weight: 400; opacity: .7; }
.raw-data-body { margin-top: 10px; }
.raw-data-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 800px) { .raw-data-cols { grid-template-columns: 1fr; } }
.raw-data-col { display: flex; flex-direction: column; gap: 6px; }
.raw-data-col-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--bs-secondary-color, #6c757d);
  text-transform: uppercase;
  letter-spacing: .06em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.raw-link { font-size: 10px; font-weight: 400; color: #58a6ff; text-decoration: none; }
.raw-link:hover { text-decoration: underline; }
.raw-pre {
  background: #0d1117;
  color: #c9d1d9;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 10.5px;
  line-height: 1.5;
  overflow: auto;
  max-height: 320px;
  margin: 0;
  border: 1px solid #30363d;
}

/* ── Train action buttons ────────────────────────────────────────────────────── */
.btn-train-start {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 18px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #238636, #2ea043);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity .15s, box-shadow .15s;
  box-shadow: 0 2px 8px rgba(46,160,67,.35);
}
.btn-train-start:hover:not(:disabled) { opacity: .9; box-shadow: 0 4px 14px rgba(46,160,67,.45); }
.btn-train-start:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
.btn-train-start.launching { background: linear-gradient(135deg, #1f6feb, #388bfd); box-shadow: 0 2px 8px rgba(56,139,253,.35); }

.btn-train-stop {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 18px;
  border-radius: 8px;
  border: 1.5px solid rgba(248,81,73,.5);
  background: rgba(248,81,73,.08);
  color: #f85149;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s;
}
.btn-train-stop:hover { background: rgba(248,81,73,.18); }

/* ── Log live/idle indicators ─────────────────────────────────────────────── */
.log-live-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #3fb950;
  animation: pulse-server 1.8s ease-in-out infinite;
  flex-shrink: 0;
}
.log-idle-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #6c757d;
  flex-shrink: 0;
}
.log-stale-warning {
  font-size: 11px;
  color: #e3a520;
  font-weight: 600;
  background: rgba(227,165,32,.1);
  border: 1px solid rgba(227,165,32,.3);
  border-radius: 6px;
  padding: 2px 10px;
}

/* ── Live dot ────────────────────────────────────────────────────────────────── */
.live-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #aaa;
  flex-shrink: 0;
}
.live-dot.pulse-server {
  background: #3fb950;
  animation: pulse-server 1.8s ease-in-out infinite;
}
.live-dot.dot-offline {
  background: #aaa;
}
@keyframes pulse-server {
  0%, 100% { box-shadow: 0 0 0 0 rgba(63,185,80,0.7); opacity: 1; }
  50%       { box-shadow: 0 0 0 5px rgba(63,185,80,0); opacity: 0.85; }
}
.server-status-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.server-online  { color: #3fb950; }
.server-offline { color: #aaa; }

/* ── Idle banner ──────────────────────────────────────────────────────────── */
.alert-idle {
  background: rgba(63, 185, 80, 0.08);
  border: 1px solid rgba(63, 185, 80, 0.3);
  color: var(--bs-body-color);
  border-radius: 8px;
}
.idle-dot-pulse {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #3fb950;
  flex-shrink: 0;
  animation: pulse-server 1.8s ease-in-out infinite;
}

/* ── Pipeline strip ──────────────────────────────────────────────────────────── */

/* Outer wrapper scrolls horizontally; overflow-y visible so rings never clip */
.pipeline-scroll-wrap {
  overflow-x: auto;
  overflow-y: visible;
  /* Trick: negative margin + padding exposes vertical overflow inside scroll container */
  margin: -16px -4px;
  padding: 16px 4px;
}

.pipeline-strip {
  display: flex;
  align-items: center;
  min-width: max-content;  /* never wrap */
  gap: 0;
  padding: 4px 0 8px;
}

.pipeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  min-width: 76px;
  max-width: 92px;
  transition: transform .15s;
  position: relative;
  padding: 0 6px;
}
.pipeline-step:hover { transform: translateY(-2px); }

/* Outer ring wrapper — gives space so the ring never clips */
.step-ring {
  width: 48px; height: 48px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 7px;
  position: relative;
  /* ring drawn as border on this wrapper */
  border: 3px solid var(--bs-border-color);
  background: transparent;
  transition: border-color .25s, box-shadow .25s;
}

.step-circle {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  font-weight: 700;
  background: var(--bs-body-bg);
  color: var(--bs-secondary-color);
  transition: all .2s;
  border: none;
}

.step-label {
  font-size: 10px;
  text-align: center;
  color: var(--bs-secondary-color);
  line-height: 1.2;
  font-weight: 500;
}

/* ── Status colour variants ──── */

/* done — green ring + green fill */
.step-done .step-ring   { border-color: #198754; }
.step-done .step-circle { background: #198754; color: #fff; }
.step-done .step-label  { color: #198754; font-weight: 600; }

/* running — blue ring with pulse animation */
.step-running .step-ring {
  border-color: #0d6efd;
  animation: ring-pulse 2s ease-in-out infinite;
}
.step-running .step-circle { background: #0d6efd; color: #fff; }
.step-running .step-label  { color: #0d6efd; font-weight: 700; }

/* error — red ring */
.step-error .step-ring   { border-color: #dc3545; }
.step-error .step-circle { background: #dc3545; color: #fff; }
.step-error .step-label  { color: #dc3545; }

/* selected (clicked) step — subtle outer glow on top of existing ring */
.step-current .step-ring {
  box-shadow: 0 0 0 4px rgba(13, 110, 253, .15);
}

@keyframes ring-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(13, 110, 253, .30); border-color: #0d6efd; }
  50%       { box-shadow: 0 0 0 7px rgba(13, 110, 253, .08); border-color: #6ea8fe; }
}

.step-pulse-bar {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px; height: 3px;
  border-radius: 2px;
  background: #0d6efd;
  animation: bar-pulse 1.5s ease-in-out infinite;
}
@keyframes bar-pulse {
  0%, 100% { opacity: 1; width: 22px; }
  50%       { opacity: .3; width: 8px; }
}

.step-connector {
  flex: 1;
  height: 2px;
  background: var(--bs-border-color);
  margin-bottom: 26px;
  min-width: 10px;
  transition: background .3s;
}
.connector-done { background: #198754; }

/* ── Step detail badge ───────────────────────────────────────────────────────── */
.step-detail-badge {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}
.badge-done    { background: #d1e7dd; color: #198754; }
.badge-running { background: #cfe2ff; color: #0d6efd; }
.badge-error   { background: #f8d7da; color: #dc3545; }
.badge-pending { background: #f8f9fa; color: #6c757d; }

/* ── Explanation box ────────────────────────────────────────────────────────── */
.explanation-box {
  background: var(--bs-tertiary-bg, #f8f9fa);
  border-left: 3px solid var(--bs-border-color);
  border-radius: 0 6px 6px 0;
  padding: 10px 14px;
}

/* ── Docker rows ─────────────────────────────────────────────────────────────── */
.docker-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--bs-secondary-color);
  margin-bottom: 4px;
}

.docker-scroll-list {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 2px 0;
}

.docker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--bs-border-color);
  transition: background .15s;
}
.docker-row:last-child { border-bottom: none; }
.docker-row:hover { background: var(--bs-tertiary-bg, #f8f9fa); }
.docker-row-highlight { background: rgba(13, 110, 253, .04); }
.docker-icon { font-size: 16px; flex-shrink: 0; }

/* ── Log area ────────────────────────────────────────────────────────────────── */
.log-area {
  font-size: 12px;
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.log-entry { display: flex; gap: 10px; }
.log-ts { color: var(--bs-secondary-color); flex-shrink: 0; }

/* ── Step Log Table ──────────────────────────────────────────────────────────── */
.step-log-table {
  font-size: 12px;
  border: 1px solid var(--bs-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.step-log-row {
  display: grid;
  grid-template-columns: 60px 50px 80px 110px 1fr 90px 70px;
  align-items: center;
  padding: 7px 14px;
  border-bottom: 1px solid var(--bs-border-color);
  gap: 8px;
  transition: background .15s;
}
.step-log-row:last-child { border-bottom: none; }
.step-log-row:not(.step-log-header):hover { background: var(--bs-tertiary-bg, #f8f9fa); }

.step-log-header {
  background: var(--bs-tertiary-bg, #f8f9fa);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--bs-secondary-color);
  padding: 8px 14px;
}

.step-log-latest {
  background: rgba(13, 110, 253, .04);
  border-left: 3px solid #0d6efd;
}

/* Mini inline progress bar */
.mini-progress {
  height: 5px;
  border-radius: 3px;
  background: var(--bs-border-color);
  overflow: hidden;
}
.mini-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #58a6ff, #bc8cff);
  transition: width .4s ease;
}

/* ── KPI range bar ───────────────────────────────────────────────────────────── */
.kpi-range-track {
  height: 5px;
  border-radius: 3px;
  background: var(--bs-border-color);
  position: relative;
  overflow: visible;
}
.kpi-range-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .8s ease;
}
.kpi-range-target {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 11px;
  background: #198754;
  border-radius: 1px;
  transform: translateX(-50%);
}

/* ── KPI improve tip ─────────────────────────────────────────────────────────── */
.kpi-improve {
  font-size: 10px;
  color: #0d6efd;
  line-height: 1.4;
  font-style: italic;
}

/* ── Config table ────────────────────────────────────────────────────────────── */
.config-table { display: flex; flex-direction: column; gap: 6px; }
.config-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 4px 8px;
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bs-tertiary-bg, #f8f9fa);
}
.config-param { font-weight: 700; color: var(--bs-body-color); grid-row: 1; }
.config-val   { color: #0d6efd; font-family: monospace; font-size: 11px; grid-row: 1; }
.config-impact{ color: var(--bs-secondary-color); font-size: 10px; grid-column: 1 / -1; grid-row: 2; }

/* ── Insights ────────────────────────────────────────────────────────────────── */
.insight-block { padding: 8px 10px; border-radius: 6px; background: var(--bs-tertiary-bg, #f8f9fa); }
.insight-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.dot-blue   { background: #0d6efd; }
.dot-green  { background: #198754; }
.dot-orange { background: #fd7e14; }
.dot-grey   { background: #6c757d; }

/* ── Loss scale ──────────────────────────────────────────────────────────────── */
.loss-scale { }
.loss-scale-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--bs-secondary-color); margin-bottom: 6px;
}
.loss-scale-row {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 0; font-size: 10px;
  border-bottom: 1px solid var(--bs-border-color);
}
.loss-scale-row:last-child { border-bottom: none; }
.loss-scale-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.loss-scale-range { width: 60px; font-weight: 600; font-family: monospace; color: var(--bs-body-color); flex-shrink: 0; }
.loss-scale-desc  { color: var(--bs-secondary-color); }
.ls-perfect   .loss-scale-dot { background: #6f42c1; }
.ls-excellent .loss-scale-dot { background: #198754; }
.ls-good      .loss-scale-dot { background: #20c997; }
.ls-ok        .loss-scale-dot { background: #0d6efd; }
.ls-warm      .loss-scale-dot { background: #fd7e14; }
.ls-bad       .loss-scale-dot { background: #dc3545; }

/* ── Step log signal column ──────────────────────────────────────────────────── */
.slt-signal { width: 80px; }

/* ── Spin animation ─────────────────────────────────────────────────────────── */
.spin-icon { display: inline-block; animation: spin 1.2s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── KPI Cards ───────────────────────────────────────────────────────────────── */
.kpi-card {
  border: 1px solid var(--bs-border-color);
  transition: box-shadow .2s, border-color .2s;
}
.kpi-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,.07);
  border-color: rgba(13, 110, 253, .25);
}

.kpi-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
  margin-bottom: 6px;
}

.kpi-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--bs-body-color);
  margin-bottom: 2px;
}
.kpi-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--bs-secondary-color);
  margin-left: 4px;
}

.kpi-trend {
  font-size: 10px;
  color: var(--bs-secondary-color);
  margin-top: 3px;
}

.kpi-divider {
  height: 1px;
  background: var(--bs-border-color);
  margin: 10px 0 8px;
  opacity: .6;
}

.kpi-desc {
  font-size: 11px;
  color: var(--bs-secondary-color);
  line-height: 1.45;
  flex-grow: 1;
}

.kpi-hint {
  font-size: 10px;
  font-weight: 600;
  margin-top: 6px;
  padding: 3px 7px;
  border-radius: 20px;
  background: var(--bs-tertiary-bg, #f8f9fa);
  display: inline-block;
  line-height: 1.4;
}

/* ── Terminal log ────────────────────────────────────────────────────────────── */
.terminal-box {
  background: #0d1117;
  color: #c9d1d9;
  font-size: 11.5px;
  line-height: 1.55;
  padding: 10px 14px 14px;
  height: 480px;
  overflow-y: auto;
  border-radius: 0 0 8px 8px;
}
.log-toggle-btn {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
  border: 1px solid var(--bs-border-color, #dee2e6);
  background: transparent;
  color: var(--bs-secondary-color, #6c757d);
  cursor: pointer;
}
.log-toggle-btn:hover { background: var(--bs-secondary-bg, #f8f9fa); }
.term-line {
  white-space: pre-wrap;
  word-break: break-all;
  padding: 0.5px 0;
}
.term-error { color: #ff7b72; }
.term-warn  { color: #e3b341; }
.term-ok    { color: #3fb950; }
.term-step  { color: #79c0ff; font-weight: 600; }
/* ── Step explanation cards grid ─────────────────────────────────────────────── */
.step-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) { .step-cards-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 680px)  { .step-cards-grid { grid-template-columns: 1fr; } }

.step-exp-card {
  background: var(--bs-card-bg, #fff);
  border: 1.5px solid var(--bs-border-color, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.step-exp-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }

.step-exp-card.sec-done    { border-color: rgba(63,185,80,.4);  background: rgba(63,185,80,.03); }
.step-exp-card.sec-running { border-color: rgba(88,166,255,.6); background: rgba(88,166,255,.04); box-shadow: 0 0 0 3px rgba(88,166,255,.15); }
.step-exp-card.sec-error   { border-color: rgba(248,81,73,.5);  background: rgba(248,81,73,.03); }
.step-exp-card.sec-pending { border-color: var(--bs-border-color, #e5e7eb); }

/* Header */
.sec-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.sec-icon   { font-size: 22px; flex-shrink: 0; }
.sec-meta   { flex: 1; min-width: 0; }
.sec-num    { font-size: 10px; font-weight: 600; color: var(--bs-secondary-color, #6c757d); text-transform: uppercase; letter-spacing: .06em; }
.sec-label  { font-size: 13px; font-weight: 700; color: var(--bs-body-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sec-badge  { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; flex-shrink: 0; letter-spacing: .04em; }
.sec-badge-done    { background: rgba(63,185,80,.15);  color: #3fb950; }
.sec-badge-running { background: rgba(88,166,255,.18); color: #58a6ff; }
.sec-badge-error   { background: rgba(248,81,73,.15);  color: #f85149; }
.sec-badge-pending { background: rgba(108,117,125,.1); color: #6c757d; }

/* What / body */
.sec-what { font-size: 12px; font-weight: 600; color: var(--bs-body-color); line-height: 1.4; }
.sec-section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--bs-secondary-color, #6c757d); margin-top: 4px; }
.sec-body { font-size: 11.5px; color: var(--bs-body-color); line-height: 1.6; opacity: .85; }

/* Footer rows */
.sec-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--bs-border-color, #e5e7eb); display: flex; flex-direction: column; gap: 5px; }
.sec-row { display: flex; gap: 6px; font-size: 11px; line-height: 1.4; }
.sec-key { font-weight: 600; flex-shrink: 0; color: var(--bs-secondary-color, #6c757d); min-width: 90px; }
.sec-val { color: var(--bs-body-color); opacity: .85; }
.sec-row-good .sec-key { color: #3fb950; }
.sec-row-bad  .sec-key { color: #e3a520; }

/* Timing row */
.sec-timing {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}
.sec-time-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: .02em;
}
.sec-time-start { background: rgba(88,166,255,.12); color: #58a6ff; }
.sec-time-end   { background: rgba(63,185,80,.12);  color: #3fb950; }
.sec-time-none  { background: rgba(108,117,125,.1); color: #6c757d; }
.sec-time-arrow { font-size: 11px; color: var(--bs-secondary-color, #6c757d); }

/* Executor / Tools row */
.sec-exec-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: rgba(108,117,125,.06);
  border-radius: 6px;
  padding: 7px 10px;
  margin-bottom: 2px;
}
.sec-exec-item  { display: flex; gap: 6px; align-items: baseline; font-size: 11px; }
.sec-exec-label { font-weight: 700; color: var(--bs-secondary-color, #6c757d); min-width: 50px; flex-shrink: 0; }
.sec-exec-val   { color: var(--bs-body-color); opacity: .85; line-height: 1.4; }

/* Output file block */
.sec-output-block {
  background: rgba(88,166,255,.06);
  border: 1px solid rgba(88,166,255,.2);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sec-output-row  { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.sec-out-key     { font-size: 10px; font-weight: 700; color: #58a6ff; min-width: 78px; flex-shrink: 0; }
.sec-out-file    { font-size: 10.5px; color: #e2a53a; word-break: break-all; }
.sec-out-struct  { font-size: 10px; color: var(--bs-body-color); opacity: .75; word-break: break-all; }
.sec-out-val     { font-size: 11px; color: var(--bs-body-color); opacity: .85; }
.sec-output-importance {
  font-size: 11px;
  color: var(--bs-body-color);
  opacity: .8;
  line-height: 1.5;
  padding-top: 4px;
  border-top: 1px solid rgba(88,166,255,.15);
  margin-top: 2px;
}
/* ── Live runtime panel inside step cards ────────────────────────────────────── */
.sec-live-panel {
  background: rgba(88,166,255,.05);
  border: 1px solid rgba(88,166,255,.25);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sec-live-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: #58a6ff;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.sec-live-pulse {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #58a6ff;
  animation: pulse-server 1.4s ease-in-out infinite;
  flex-shrink: 0;
}
.sec-live-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 11.5px;
  line-height: 1.4;
}
.sec-live-key {
  font-weight: 700;
  color: var(--bs-secondary-color, #6c757d);
  min-width: 90px;
  flex-shrink: 0;
  font-size: 11px;
}
.sec-live-val { color: var(--bs-body-color); }
.sec-live-accent { color: #58a6ff; font-weight: 600; }
.sec-live-stale { font-size: 10.5px; color: #e3a520; margin-top: 3px; }

.sec-live-progress {
  height: 5px;
  background: rgba(88,166,255,.15);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}
.sec-live-prog-bar {
  height: 100%;
  background: linear-gradient(90deg, #58a6ff, #bc8cff);
  border-radius: 3px;
  transition: width 1s ease;
}

.sec-live-mini-log {
  margin-top: 4px;
  background: #0d1117;
  border-radius: 6px;
  padding: 6px 8px;
}
.sec-live-log-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: #58a6ff;
  margin-bottom: 4px;
}
.sec-live-log-line {
  font-family: monospace;
  font-size: 10px;
  color: #c9d1d9;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
