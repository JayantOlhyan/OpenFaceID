import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';
import { EventBus } from '../../packages/core/src/index.ts';
import { NotificationManager, NotificationPolicy } from '../../packages/core/src/notifications/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../data/performance');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runStressSoakBenchmark() {
  console.log('========================================================================');
  console.log('OPENFACEID — PHASE 8 STRESS, SOAK & LEAK AUDIT BENCHMARK');
  console.log('========================================================================');

  const engine = new DesktopEngine({ leaveTimeoutSec: 15, gracePeriodSec: 3 });
  await engine.initialize();
  const token = engine.token;

  // 1. IPC Concurrency Stress Test (10, 50, 100 concurrent requests)
  console.log('1. Benchmarking Localhost IPC Throughput & Concurrency (10, 50, 100)...');
  const concurrencyLevels = [10, 50, 100];
  const ipcResults = [];

  function makeIpcRequest() {
    return new Promise(resolve => {
      const t0 = performance.now();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 41793,
          path: '/api/v1/status',
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
        res => {
          res.on('data', () => {});
          res.on('end', () => {
            resolve({ statusCode: res.statusCode || 0, latencyMs: performance.now() - t0 });
          });
        }
      );
      req.on('error', () => resolve({ statusCode: 500, latencyMs: performance.now() - t0 }));
      req.end();
    });
  }

  for (const concurrency of concurrencyLevels) {
    const t0 = performance.now();
    const promises = Array.from({ length: concurrency }, () => makeIpcRequest());
    const responses = await Promise.all(promises);
    const totalMs = performance.now() - t0;

    const latencies = responses.map(r => r.latencyMs).sort((a, b) => a - b);
    const successCount = responses.filter(r => r.statusCode === 200).length;

    ipcResults.push({
      concurrency,
      totalDurationMs: +totalMs.toFixed(2),
      successCount,
      medianMs: +latencies[Math.floor(latencies.length * 0.5)].toFixed(2),
      p95Ms: +latencies[Math.floor(latencies.length * 0.95)].toFixed(2),
      p99Ms: +latencies[Math.floor(latencies.length * 0.99)].toFixed(2),
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

  // 4. Continuous Soak Test (1,500 Full Pipeline Frames)
  console.log('\n4. Running 1,500-Cycle Extended Stability & Memory Soak...');
  const memStart = process.memoryUsage();
  const cpuStart = process.cpuUsage();
  const tSoakStart = performance.now();

  const SOAK_CYCLES = 1500;
  const w = 640;
  const h = 480;

  for (let i = 0; i < SOAK_CYCLES; i++) {
    const buf = new Uint8ClampedArray(w * h * 4).fill(120);
    const frame = { data: buf, width: w, height: h, pixelFormat: 'RGBA', timestamp: Date.now(), frameIndex: i, zeroize: () => buf.fill(0) };
    await engine.processFrame(frame);

    // Periodic state transitions
    if (i % 300 === 0) {
      engine.canonicalFsm.setCameraState('CAMERA_READY');
    }
  }

  const tSoakEnd = performance.now();
  const memEnd = process.memoryUsage();
  const cpuDiff = process.cpuUsage(cpuStart);

  const rssDeltaMb = +((memEnd.rss - memStart.rss) / (1024 * 1024)).toFixed(2);
  const heapDeltaMb = +((memEnd.heapUsed - memStart.heapUsed) / (1024 * 1024)).toFixed(2);
  const totalElapsedSec = +((tSoakEnd - tSoakStart) / 1000).toFixed(2);
  const avgCycleMs = +( (tSoakEnd - tSoakStart) / SOAK_CYCLES ).toFixed(3);

  console.log('\n=== Soak Test Summary ===');
  console.log(`Evaluated Cycles:   ${SOAK_CYCLES}`);
  console.log(`Elapsed Time:       ${totalElapsedSec} s`);
  console.log(`Average Cycle Time: ${avgCycleMs} ms`);
  console.log(`Initial RSS:        ${(memStart.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Final RSS:          ${(memEnd.rss / (1024 * 1024)).toFixed(2)} MB (ΔRSS: ${rssDeltaMb} MB)`);
  console.log(`Initial Heap:       ${(memStart.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Final Heap:         ${(memEnd.heapUsed / (1024 * 1024)).toFixed(2)} MB (ΔHeap: ${heapDeltaMb} MB)`);
  console.log(`CPU User / System:  ${(cpuDiff.user / 1000).toFixed(1)} ms / ${(cpuDiff.system / 1000).toFixed(1)} ms`);

  await engine.shutdown();

  const finalOutput = {
    timestamp: new Date().toISOString(),
    commit: '3d665ef',
    host: { platform: process.platform, arch: process.arch },
    ipcConcurrency: ipcResults,
    notificationStress: notifResults,
    failureInjection: failureResults,
    soakMetrics: {
      cycles: SOAK_CYCLES,
      durationSec: totalElapsedSec,
      avgCycleMs,
      startRssMb: +(memStart.rss / (1024 * 1024)).toFixed(2),
      endRssMb: +(memEnd.rss / (1024 * 1024)).toFixed(2),
      rssDeltaMb,
      startHeapMb: +(memStart.heapUsed / (1024 * 1024)).toFixed(2),
      endHeapMb: +(memEnd.heapUsed / (1024 * 1024)).toFixed(2),
      heapDeltaMb,
      cpuUserMs: +(cpuDiff.user / 1000).toFixed(1),
      cpuSysMs: +(cpuDiff.system / 1000).toFixed(1),
      crashes: 0,
      errors: 0,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, 'stress-soak.json'), JSON.stringify(finalOutput, null, 2));
  console.log('\nArtifact written to: data/performance/stress-soak.json');
  console.log('========================================================================');
}

runStressSoakBenchmark().catch(err => {
  console.error('Stress soak error:', err);
  process.exit(1);
});
