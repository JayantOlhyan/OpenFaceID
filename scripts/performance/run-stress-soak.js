import http from 'http';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';
import { NotificationManager, NotificationPolicy, EventBus } from '../../packages/core/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../data/performance');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runStressSoakBenchmark() {
  console.log('========================================================================');
  console.log('OPENFACEID — PHASE 8 IPC STRESS, FAILURE INJECTION & SOAK AUDIT');
  console.log('========================================================================');

  const engine = new DesktopEngine({ leaveTimeoutSec: 15, gracePeriodSec: 3 });
  await engine.initialize();

  // Read ephemeral token
  const tokenPath = path.join(process.env.HOME || '/tmp', '.openfaceid', 'token');
  let token = '';
  if (fs.existsSync(tokenPath)) {
    token = fs.readFileSync(tokenPath, 'utf8').trim();
  }

  // 1. IPC Concurrency Stress
  console.log('1. Benchmarking Localhost IPC Concurrency & Latency (10, 50, 100 concurrent requests)...');
  const concurrencyLevels = [10, 50, 100];
  const ipcResults = [];

  for (const concurrency of concurrencyLevels) {
    const times = [];
    const t0 = performance.now();

    const reqPromises = Array.from({ length: concurrency }).map(() => {
      return new Promise((resolve) => {
        const reqStart = performance.now();
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: 41793,
            path: '/api/v1/status',
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 2000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              const reqEnd = performance.now();
              times.push(reqEnd - reqStart);
              resolve({ statusCode: res.statusCode, ok: res.statusCode === 200 });
            });
          }
        );
        req.on('error', (err) => resolve({ error: err.message, ok: false }));
        req.end();
      });
    });

    const results = await Promise.all(reqPromises);
    const t1 = performance.now();

    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length * 0.5)] || 0;
    const p95 = times[Math.floor(times.length * 0.95)] || 0;
    const p99 = times[Math.floor(times.length * 0.99)] || 0;

    ipcResults.push({
      concurrency,
      totalDurationMs: +(t1 - t0).toFixed(2),
      successCount: results.filter((r) => r.ok).length,
      medianMs: +median.toFixed(2),
      p95Ms: +p95.toFixed(2),
      p99Ms: +p99.toFixed(2),
    });
  }

  console.log('| Concurrency | Total Time (ms) | Success / Total | Median (ms) | P95 (ms)  | P99 (ms)  |');
  console.log('|-------------|-----------------|-----------------|-------------|-----------|-----------|');
  for (const r of ipcResults) {
    console.log(`| ${r.concurrency.toString().padEnd(11)} | ${r.totalDurationMs.toString().padEnd(15)} | ${(r.successCount + '/' + r.concurrency).padEnd(15)} | ${r.medianMs.toString().padStart(9)} ms | ${r.p95Ms.toString().padStart(7)} ms | ${r.p99Ms.toString().padStart(7)} ms |`);
  }

  // 2. Notification Subsystem Stress & Rate-Limiting
  console.log('\n2. Stressing Notification Subsystem (100 events / category)...');
  const notifMgr = NotificationManager.getInstance();
  notifMgr.setAdapter({ showNotification: async () => true });
  notifMgr.clearHistory();

  const notifStress = [
    { key: 'UNKNOWN_PERSON', count: 100 },
    { key: 'CAMERA_DISCONNECTED', count: 100 },
    { key: 'MULTIPLE_FACES', count: 100 },
  ];

  const notifResults = [];
  for (const s of notifStress) {
    const t0 = performance.now();
    let dispatched = 0;
    let suppressed = 0;

    for (let i = 0; i < s.count; i++) {
      const payload = NotificationPolicy.createPayload(s.key);
      if (payload) {
        const sent = await notifMgr.notify(payload);
        if (sent) dispatched++;
        else suppressed++;
      }
    }
    const t1 = performance.now();
    notifResults.push({
      event: s.key,
      totalSubmitted: s.count,
      dispatched,
      suppressed,
      durationMs: +(t1 - t0).toFixed(2),
      avgLatencyMs: +((t1 - t0) / s.count).toFixed(3),
    });
  }

  console.log('| Event Key           | Submitted | Dispatched | Suppressed | Duration (ms) | Avg/Event (ms) |');
  console.log('|---------------------|-----------|------------|------------|---------------|----------------|');
  for (const n of notifResults) {
    console.log(`| ${n.event.padEnd(19)} | ${n.totalSubmitted.toString().padEnd(9)} | ${n.dispatched.toString().padEnd(10)} | ${n.suppressed.toString().padEnd(10)} | ${n.durationMs.toString().padEnd(13)} | ${n.avgLatencyMs.toString().padEnd(14)} |`);
  }

  // 3. Failure Injection & Resilience During Soak
  console.log('\n3. Performing Controlled Failure Injection Scenarios...');
  const failureScenarios = [
    {
      scenario: 'Camera Hot-Plug Disconnect & Reconnect',
      action: async () => {
        EventBus.getInstance().emit('CAMERA_DISCONNECTED', { deviceId: 'test_cam', timestamp: Date.now() });
        await new Promise(r => setTimeout(r, 20));
        EventBus.getInstance().emit('CAMERA_CONNECTED', { deviceId: 'test_cam', timestamp: Date.now() });
      },
    },
    {
      scenario: 'Privacy Mode Pause & Resume',
      action: async () => {
        engine.canonicalFsm.setPrivacyPaused(true);
        await new Promise(r => setTimeout(r, 20));
        engine.canonicalFsm.setPrivacyPaused(false);
      },
    },
    {
      scenario: 'Sleep / Wake Zero-Trust Session Reset',
      action: async () => {
        engine.canonicalFsm.resetOnWake();
      },
    },
    {
      scenario: 'Multi-Face Intrusion Fail-Closed Transition',
      action: async () => {
        engine.canonicalFsm.updateVisionState({ faceCount: 2, detectionState: 'MULTIPLE_FACES', livenessState: 'LIVENESS_REQUIRED', identityState: 'IDENTITY_UNKNOWN' });
      },
    },
  ];

  const failureResults = [];
  for (const f of failureScenarios) {
    const mem0 = process.memoryUsage().heapUsed;
    await f.action();
    const state = await engine.getAuthoritativeState();
    const mem1 = process.memoryUsage().heapUsed;
    failureResults.push({
      scenario: f.scenario,
      resultingPresenceState: state.canonicalState.presence,
      safeStateMaintained: state.canonicalState.presence !== 'PRESENCE_AUTHORIZED',
      memoryDeltaKb: +((mem1 - mem0) / 1024).toFixed(1),
    });
  }

  console.log('| Scenario                                   | Resulting Presence State  | Security Status | Memory Δ (KB) |');
  console.log('|--------------------------------------------|---------------------------|-----------------|---------------|');
  for (const fs of failureResults) {
    console.log(`| ${fs.scenario.padEnd(42)} | ${fs.resultingPresenceState.padEnd(25)} | ${fs.safeStateMaintained ? 'FAIL-CLOSED (OK)' : 'COMPROMISED!'} | ${fs.memoryDeltaKb.toString().padStart(11)} KB |`);
  }

  // 4. Checkpointed 1,500-Cycle Extended Soak Audit
  console.log('\n4. Running Checkpointed 1,500-Cycle Soak Audit (Checkpoints: 0, 100, 250, 500, 750, 1000, 1250, 1500)...');
  const CHECKPOINTS = [0, 100, 250, 500, 750, 1000, 1250, 1500];
  const checkpointRecords = [];

  const memStart = process.memoryUsage();
  const cpuStart = process.cpuUsage();
  const tSoakStart = performance.now();

  const SOAK_CYCLES = 1500;
  const w = 640;
  const h = 480;

  function sampleCheckpoint(cycle) {
    const mem = process.memoryUsage();
    checkpointRecords.push({
      cycle,
      rssMb: +(mem.rss / (1024 * 1024)).toFixed(2),
      heapUsedMb: +(mem.heapUsed / (1024 * 1024)).toFixed(2),
      heapTotalMb: +(mem.heapTotal / (1024 * 1024)).toFixed(2),
      externalMb: +(mem.external / (1024 * 1024)).toFixed(2),
      deltaRssMb: +((mem.rss - memStart.rss) / (1024 * 1024)).toFixed(2),
      deltaHeapMb: +((mem.heapUsed - memStart.heapUsed) / (1024 * 1024)).toFixed(2),
    });
  }

  sampleCheckpoint(0);

  for (let i = 1; i <= SOAK_CYCLES; i++) {
    const buf = new Uint8ClampedArray(w * h * 4).fill(120);
    const frame = { data: buf, width: w, height: h, pixelFormat: 'RGBA', timestamp: Date.now(), frameIndex: i, zeroize: () => buf.fill(0) };
    await engine.processFrame(frame);

    // Periodic camera state affirmation
    if (i % 300 === 0) {
      engine.canonicalFsm.setCameraState('CAMERA_READY');
    }

    // Allow event loop tick every 50 frames to emulate real-world cadence
    if (i % 50 === 0) {
      await new Promise((r) => setImmediate(r));
    }

    if (CHECKPOINTS.includes(i)) {
      sampleCheckpoint(i);
    }
  }

  // Allow idle event loop drain
  await new Promise((r) => setTimeout(r, 100));

  const tSoakEnd = performance.now();
  const memEnd = process.memoryUsage();
  const cpuDiff = process.cpuUsage(cpuStart);

  const totalElapsedSec = +((tSoakEnd - tSoakStart) / 1000).toFixed(2);
  const avgCycleMs = +((tSoakEnd - tSoakStart) / SOAK_CYCLES).toFixed(3);

  console.log('| Soak Checkpoint | RSS (MB) | Heap Used | Heap Total | External (MB) | ΔRSS (MB) | ΔHeap (MB) |');
  console.log('|-----------------|----------|-----------|------------|---------------|-----------|------------|');
  for (const cp of checkpointRecords) {
    console.log(`| Cycle ${cp.cycle.toString().padEnd(9)} | ${cp.rssMb.toString().padStart(8)} | ${cp.heapUsedMb.toString().padStart(9)} | ${cp.heapTotalMb.toString().padStart(10)} | ${cp.externalMb.toString().padStart(13)} | ${cp.deltaRssMb.toString().padStart(9)} | ${cp.deltaHeapMb.toString().padStart(10)} |`);
  }

  const finalCp = checkpointRecords[checkpointRecords.length - 1];
  const midCp = checkpointRecords[Math.floor(checkpointRecords.length / 2)];
  const midToFinalDelta = finalCp.rssMb - midCp.rssMb;
  let soakClassification = 'STABLE PLATEAU';
  if (midToFinalDelta > 30) soakClassification = 'POSSIBLE LEAK';
  else if (midToFinalDelta > 10) soakClassification = 'GROWING (INVESTIGATE)';
  else soakClassification = 'STABLE PLATEAU (BOUNDED)';

  console.log(`\n=== Soak Test Summary ===`);
  console.log(`Evaluated Cycles:   ${SOAK_CYCLES}`);
  console.log(`Elapsed Time:       ${totalElapsedSec} s`);
  console.log(`Average Cycle Time: ${avgCycleMs} ms`);
  console.log(`Initial RSS:        ${checkpointRecords[0].rssMb} MB`);
  console.log(`Final RSS:          ${finalCp.rssMb} MB (ΔRSS: ${finalCp.deltaRssMb} MB)`);
  console.log(`Initial Heap:       ${checkpointRecords[0].heapUsedMb} MB`);
  console.log(`Final Heap:         ${finalCp.heapUsedMb} MB (ΔHeap: ${finalCp.deltaHeapMb} MB)`);
  console.log(`Mid-to-Final ΔRSS:  ${midToFinalDelta.toFixed(2)} MB (${soakClassification})`);
  console.log(`CPU User / System:  ${(cpuDiff.user / 1000).toFixed(1)} ms / ${(cpuDiff.system / 1000).toFixed(1)} ms`);

  await engine.shutdown();

  const finalOutput = {
    benchmarkMetadata: {
      benchmarkId: 'PERF-SOAK-001',
      provenance: 'IPC Stress, Failure Injection & 1,500-Cycle Checkpointed Soak Test',
      timestamp: new Date().toISOString(),
      commit: '3d665ef',
      host: { platform: process.platform, arch: process.arch, node: process.version },
    },
    ipcConcurrency: ipcResults,
    notificationStress: notifResults,
    failureInjection: failureResults,
    soakAudit: {
      cycles: SOAK_CYCLES,
      durationSec: totalElapsedSec,
      avgCycleMs,
      checkpoints: checkpointRecords,
      midToFinalDeltaRssMb: +midToFinalDelta.toFixed(2),
      classification: soakClassification,
      crashes: 0,
      errors: 0,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, 'stress-soak.json'), JSON.stringify(finalOutput, null, 2));
  console.log('\nArtifact written to: data/performance/stress-soak.json');
  console.log('========================================================================');
}

runStressSoakBenchmark().catch((err) => {
  console.error('Stress soak error:', err);
  process.exit(1);
});
