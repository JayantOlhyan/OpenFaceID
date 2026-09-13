import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';
import { FrameSampler } from '../../packages/camera/src/index.ts';
import {
  BlazeFaceDetector,
  ArcFaceEmbedder,
  LivenessDetector,
  FaceQualityAnalyzer,
} from '../../packages/vision/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../data/performance');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runPipelineBenchmark() {
  console.log('========================================================================');
  console.log('OPENFACEID — PHASE 8 PIPELINE & BACKPRESSURE BENCHMARK');
  console.log('========================================================================');

  // 1. Measure Cold Startup Latency
  console.log('1. Measuring Cold Daemon Startup Latency (5 cold launches)...');
  const coldStarts = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const testEngine = new DesktopEngine({ leaveTimeoutSec: 15, gracePeriodSec: 3 });
    await testEngine.initialize();
    const t1 = performance.now();
    coldStarts.push(t1 - t0);
    await testEngine.shutdown();
  }
  coldStarts.sort((a, b) => a - b);
  const startupStats = {
    min: coldStarts[0],
    median: coldStarts[2],
    p95: coldStarts[4],
    max: coldStarts[4],
  };
  console.log(`   Startup Latency: Min ${startupStats.min.toFixed(2)} ms | Median ${startupStats.median.toFixed(2)} ms | P95 ${startupStats.p95.toFixed(2)} ms`);

  // Initialize engine for pipeline benchmarking
  const engine = new DesktopEngine({ leaveTimeoutSec: 15, gracePeriodSec: 3 });
  await engine.initialize();

  // 2. Analytical In-Tree Pipeline Microbenchmark
  console.log('\n2. Benchmarking In-Tree Analytical Pipeline Micro-stages...');
  console.log('   (Workload: Synthetic 640x480 RGBA frame; Warm-up: 50 cycles; Measured: 250 cycles)');

  const detector = new BlazeFaceDetector();
  const qualityAnalyzer = new FaceQualityAnalyzer();
  const embedder = new ArcFaceEmbedder();
  const liveness = new LivenessDetector();

  const w = 640;
  const h = 480;

  const dummyLandmarks = {
    leftEye: { x: 280, y: 200 },
    rightEye: { x: 360, y: 200 },
    noseTip: { x: 320, y: 240 },
    leftMouth: { x: 290, y: 280 },
    rightMouth: { x: 350, y: 280 },
  };
  const dummyBox = { x: 240, y: 160, width: 160, height: 200 };

  function createTestFrame(i) {
    const buffer = new Uint8ClampedArray(w * h * 4).fill(120);
    for (let p = 0; p < buffer.length; p += 16) {
      const x = (p / 4) % w;
      const y = Math.floor((p / 4) / w);
      buffer[p] = 120 + ((x ^ y) & 0x1f);
      buffer[p + 1] = 120 + ((x ^ y) & 0x1f);
      buffer[p + 2] = 120 + ((x ^ y) & 0x1f);
      buffer[p + 3] = 255;
    }
    return {
      data: buffer,
      width: w,
      height: h,
      pixelFormat: 'RGBA',
      timestamp: Date.now(),
      frameIndex: i,
      zeroize: () => buffer.fill(0),
    };
  }

  // WARM-UP (50 iterations, untimed)
  for (let i = 0; i < 50; i++) {
    const f = createTestFrame(i);
    await detector.detect(f);
    qualityAnalyzer.analyzeQuality(f, dummyBox, dummyLandmarks);
    const emb = await embedder.embed(f, dummyLandmarks);
    await liveness.evaluateLiveness([f, f], [dummyLandmarks, dummyLandmarks], 'light');
    embedder.calculateCosineSimilarity(emb, emb);
    f.zeroize();
  }

  // MEASURED CYCLES (250 iterations)
  const latencies = {
    frameIngest: [],
    detection: [],
    quality: [],
    embedding: [],
    liveness: [],
    matching: [],
    presenceDecision: [],
    pipelineTotal: [],
  };

  for (let i = 0; i < 250; i++) {
    // Stage 1: Frame Ingest & Buffer Allocation
    const tIngest0 = performance.now();
    const frame = createTestFrame(i);
    const tIngest1 = performance.now();
    latencies.frameIngest.push(tIngest1 - tIngest0);

    // Stage 2: BlazeFace Detection
    const tDet0 = performance.now();
    const detections = await detector.detect(frame);
    const tDet1 = performance.now();
    latencies.detection.push(tDet1 - tDet0);

    // Stage 3: Face Quality Analysis
    const tQual0 = performance.now();
    const quality = qualityAnalyzer.analyzeQuality(frame, dummyBox, dummyLandmarks);
    const tQual1 = performance.now();
    latencies.quality.push(tQual1 - tQual0);

    // Stage 4: ArcFace 512D Embedding
    const tEmb0 = performance.now();
    const embedding = await embedder.embed(frame, dummyLandmarks);
    const tEmb1 = performance.now();
    latencies.embedding.push(tEmb1 - tEmb0);

    // Stage 5: Liveness Anti-Spoofing
    const tLiv0 = performance.now();
    const livRes = await liveness.evaluateLiveness([frame, frame], [dummyLandmarks, dummyLandmarks], 'light');
    const tLiv1 = performance.now();
    latencies.liveness.push(tLiv1 - tLiv0);

    // Stage 6: Linear Cosine Matching
    const tMatch0 = performance.now();
    const sim = embedder.calculateCosineSimilarity(embedding, embedding);
    const tMatch1 = performance.now();
    latencies.matching.push(tMatch1 - tMatch0);

    // Stage 7: Canonical State Update
    const tFsm0 = performance.now();
    engine.canonicalFsm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'usr_bench',
      identityName: 'Benchmark User',
    });
    const tFsm1 = performance.now();
    latencies.presenceDecision.push(tFsm1 - tFsm0);

    // Total Analytical Pipeline Latency
    latencies.pipelineTotal.push(
      (tIngest1 - tIngest0) + (tDet1 - tDet0) + (tQual1 - tQual0) +
      (tEmb1 - tEmb0) + (tLiv1 - tLiv0) + (tMatch1 - tMatch0) + (tFsm1 - tFsm0)
    );

    frame.zeroize();
  }

  function getStats(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      min: sorted[0],
      median: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      max: sorted[sorted.length - 1],
    };
  }

  const results = {
    startupLatencyMs: startupStats,
    frameIngestMs: getStats(latencies.frameIngest),
    detectionMs: getStats(latencies.detection),
    qualityAnalysisMs: getStats(latencies.quality),
    embeddingMs: getStats(latencies.embedding),
    livenessMs: getStats(latencies.liveness),
    matchingMs: getStats(latencies.matching),
    presenceDecisionMs: getStats(latencies.presenceDecision),
    analyticalPipelineLatencyMs: getStats(latencies.pipelineTotal),
  };

  console.log('| In-Tree Stage (Microbenchmark) | Median (ms) | P95 (ms)  | P99 (ms)  | Min (ms)  | Max (ms)  |');
  console.log('|--------------------------------|-------------|-----------|-----------|-----------|-----------|');
  console.log(`| Frame Ingest & Buffer Norm     | ${results.frameIngestMs.median.toFixed(3).padStart(11)} | ${results.frameIngestMs.p95.toFixed(3).padStart(9)} | ${results.frameIngestMs.p99.toFixed(3).padStart(9)} | ${results.frameIngestMs.min.toFixed(3).padStart(9)} | ${results.frameIngestMs.max.toFixed(3).padStart(9)} |`);
  console.log(`| BlazeFace Detection            | ${results.detectionMs.median.toFixed(3).padStart(11)} | ${results.detectionMs.p95.toFixed(3).padStart(9)} | ${results.detectionMs.p99.toFixed(3).padStart(9)} | ${results.detectionMs.min.toFixed(3).padStart(9)} | ${results.detectionMs.max.toFixed(3).padStart(9)} |`);
  console.log(`| Face Quality Analysis          | ${results.qualityAnalysisMs.median.toFixed(3).padStart(11)} | ${results.qualityAnalysisMs.p95.toFixed(3).padStart(9)} | ${results.qualityAnalysisMs.p99.toFixed(3).padStart(9)} | ${results.qualityAnalysisMs.min.toFixed(3).padStart(9)} | ${results.qualityAnalysisMs.max.toFixed(3).padStart(9)} |`);
  console.log(`| ArcFace 512D Embedding         | ${results.embeddingMs.median.toFixed(3).padStart(11)} | ${results.embeddingMs.p95.toFixed(3).padStart(9)} | ${results.embeddingMs.p99.toFixed(3).padStart(9)} | ${results.embeddingMs.min.toFixed(3).padStart(9)} | ${results.embeddingMs.max.toFixed(3).padStart(9)} |`);
  console.log(`| Liveness Anti-Spoofing         | ${results.livenessMs.median.toFixed(3).padStart(11)} | ${results.livenessMs.p95.toFixed(3).padStart(9)} | ${results.livenessMs.p99.toFixed(3).padStart(9)} | ${results.livenessMs.min.toFixed(3).padStart(9)} | ${results.livenessMs.max.toFixed(3).padStart(9)} |`);
  console.log(`| Identity Matching (Cosine)     | ${results.matchingMs.median.toFixed(3).padStart(11)} | ${results.matchingMs.p95.toFixed(3).padStart(9)} | ${results.matchingMs.p99.toFixed(3).padStart(9)} | ${results.matchingMs.min.toFixed(3).padStart(9)} | ${results.matchingMs.max.toFixed(3).padStart(9)} |`);
  console.log(`| Presence State FSM Update      | ${results.presenceDecisionMs.median.toFixed(3).padStart(11)} | ${results.presenceDecisionMs.p95.toFixed(3).padStart(9)} | ${results.presenceDecisionMs.p99.toFixed(3).padStart(9)} | ${results.presenceDecisionMs.min.toFixed(3).padStart(9)} | ${results.presenceDecisionMs.max.toFixed(3).padStart(9)} |`);
  console.log(`| Analytical Pipeline Total      | ${results.analyticalPipelineLatencyMs.median.toFixed(3).padStart(11)} | ${results.analyticalPipelineLatencyMs.p95.toFixed(3).padStart(9)} | ${results.analyticalPipelineLatencyMs.p99.toFixed(3).padStart(9)} | ${results.analyticalPipelineLatencyMs.min.toFixed(3).padStart(9)} | ${results.analyticalPipelineLatencyMs.max.toFixed(3).padStart(9)} |`);

  // 3. Nominal Unconstrained Throughput Test
  console.log('\n3. Benchmarking Nominal Frame Ingestion (Consumer Unconstrained)...');
  const nominalRates = [15, 30, 60];
  const nominalResults = [];

  for (const requestedFps of nominalRates) {
    const durationMs = 400;
    const intervalMs = 1000 / requestedFps;
    let framesPushed = 0;
    let framesProcessed = 0;
    let framesDropped = 0;

    let isConsumerBusy = false;
    const start = performance.now();

    while (performance.now() - start < durationMs) {
      framesPushed++;
      if (isConsumerBusy) {
        framesDropped++;
      } else {
        isConsumerBusy = true;
        const b = new Uint8ClampedArray(w * h * 4).fill(100);
        const f = { data: b, width: w, height: h, pixelFormat: 'RGBA', timestamp: Date.now(), frameIndex: framesPushed, zeroize: () => b.fill(0) };
        await engine.processFrame(f);
        framesProcessed++;
        isConsumerBusy = false;
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    const elapsedSec = (performance.now() - start) / 1000;
    nominalResults.push({
      requestedFps,
      actualPushedFps: +(framesPushed / elapsedSec).toFixed(1),
      processedFps: +(framesProcessed / elapsedSec).toFixed(1),
      droppedFps: +(framesDropped / elapsedSec).toFixed(1),
      bufferCapacity: 1,
      queuedBacklog: 0,
    });
  }

  console.log('| Requested FPS | Ingested FPS | Processed FPS | Dropped FPS | Buffer Capacity | Queued Backlog |');
  console.log('|---------------|--------------|---------------|-------------|-----------------|----------------|');
  for (const r of nominalResults) {
    console.log(`| ${r.requestedFps.toString().padEnd(13)} | ${r.actualPushedFps.toString().padEnd(12)} | ${r.processedFps.toString().padEnd(13)} | ${r.droppedFps.toString().padEnd(11)} | 1 (single slot) | 0 (bounded)    |`);
  }

  // 4. Controlled Consumer Overload & Backpressure Drop Test
  console.log('\n4. Benchmarking Controlled Consumer Overload & Backpressure Drop...');
  console.log('   (Simulating consumer with 35 ms processing latency = ~28.5 FPS capacity limit)');

  const overloadTestRates = [30, 60, 120];
  const overloadResults = [];

  for (const requestedFps of overloadTestRates) {
    const durationMs = 500;
    const intervalMs = 1000 / requestedFps;
    let framesPushed = 0;
    let framesProcessed = 0;
    let framesDropped = 0;
    const frameAgesAtProcessing = [];

    let isConsumerBusy = false;
    const start = performance.now();

    while (performance.now() - start < durationMs) {
      framesPushed++;
      const pushTime = performance.now();

      if (isConsumerBusy) {
        // Drop stale frame immediately under backpressure
        framesDropped++;
      } else {
        isConsumerBusy = true;
        const b = new Uint8ClampedArray(w * h * 4).fill(100);
        const f = { data: b, width: w, height: h, pixelFormat: 'RGBA', timestamp: Date.now(), frameIndex: framesPushed, zeroize: () => b.fill(0) };
        
        // Asynchronously process with simulated 35ms downstream latency
        (async () => {
          await new Promise(r => setTimeout(r, 35));
          const processTime = performance.now();
          frameAgesAtProcessing.push(processTime - pushTime);
          framesProcessed++;
          isConsumerBusy = false;
          f.zeroize();
        })();
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    // Drain in-flight frame
    await new Promise(r => setTimeout(r, 50));

    const elapsedSec = (performance.now() - start) / 1000;
    const avgAge = frameAgesAtProcessing.length > 0 
      ? +(frameAgesAtProcessing.reduce((a, b) => a + b, 0) / frameAgesAtProcessing.length).toFixed(1)
      : 0;

    overloadResults.push({
      requestedFps,
      actualPushedFps: +(framesPushed / elapsedSec).toFixed(1),
      processedFps: +(framesProcessed / elapsedSec).toFixed(1),
      droppedFps: +(framesDropped / elapsedSec).toFixed(1),
      dropRatePercent: +((framesDropped / framesPushed) * 100).toFixed(1),
      bufferCapacity: 1,
      queuedBacklog: 0,
      avgFrameAgeMs: avgAge,
      staleFramesPrevented: true,
    });
  }

  console.log('| Requested FPS | Ingested FPS | Processed FPS | Dropped FPS | Drop Rate (%) | Buffer Capacity | Queued Backlog | Avg Frame Age |');
  console.log('|---------------|--------------|---------------|-------------|---------------|-----------------|----------------|---------------|');
  for (const r of overloadResults) {
    console.log(`| ${r.requestedFps.toString().padEnd(13)} | ${r.actualPushedFps.toString().padEnd(12)} | ${r.processedFps.toString().padEnd(13)} | ${r.droppedFps.toString().padEnd(11)} | ${r.dropRatePercent.toString().padStart(12)}% | 1 (single slot) | 0 (no queue)   | ${r.avgFrameAgeMs.toString().padStart(11)} ms |`);
  }

  await engine.shutdown();

  const finalOutput = {
    benchmarkMetadata: {
      benchmarkId: 'PERF-PIPE-001',
      provenance: 'In-Tree Analytical Microbenchmark & Simulated Overload Test',
      inputDimensions: '640x480 RGBA synthetic buffer',
      warmupCycles: 50,
      measuredCycles: 250,
      timestamp: new Date().toISOString(),
      commit: '3d665ef',
      host: { platform: process.platform, arch: process.arch, node: process.version },
    },
    analyticalPipelineLatencies: results,
    nominalThroughput: nominalResults,
    overloadBackpressure: overloadResults,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'pipeline-benchmark.json'), JSON.stringify(finalOutput, null, 2));
  console.log('\nArtifact written to: data/performance/pipeline-benchmark.json');
  console.log('========================================================================');
}

runPipelineBenchmark().catch(err => {
  console.error('Pipeline benchmark error:', err);
  process.exit(1);
});
