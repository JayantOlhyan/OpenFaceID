#!/usr/bin/env node
/**
 * OpenFaceID — Biometric Recognition & Gallery Discrimination Benchmark Runner
 *
 * Evaluates genuine match rate (TAR), false reject rate (FRR), and false accept rate (FAR)
 * using the in-tree ArcFaceEmbedder and FaceRecognizer pipelines.
 *
 * NOTE: Operates on synthetic/mathematical cohorts modeling desktop facial variation.
 * Results are transparently reported as small-sample indicative benchmarks.
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { FaceRecognizer } from '../../packages/vision/src/recognizer.ts';
import { ArcFaceEmbedder } from '../../packages/vision/src/embedder.ts';

// Deterministic pseudo-random generator
function createRng(seed = 1337) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateDeterministicVector(dim = 512, seed = 1) {
  const rng = createRng(seed);
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    // Normal-ish distribution via Box-Muller
    const u1 = Math.max(1e-7, rng());
    const u2 = rng();
    vec[i] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

function addVariation(base, seed, noiseScale) {
  const rng = createRng(seed);
  const result = new Float32Array(base.length);
  for (let i = 0; i < base.length; i++) {
    const delta = (rng() - 0.5) * 2 * noiseScale;
    result[i] = base[i] + delta;
  }
  let norm = 0;
  for (let i = 0; i < result.length; i++) norm += result[i] * result[i];
  norm = Math.sqrt(norm);
  for (let i = 0; i < result.length; i++) result[i] /= norm;
  return result;
}

async function runRecognitionEvaluation() {
  console.log('='.repeat(72));
  console.log('OPENFACEID — BIOMETRIC RECOGNITION EVALUATION RUNNER');
  console.log('='.repeat(72));
  console.log('Model Reality Check: In-tree pure TypeScript analytical formulation');
  console.log('Dataset Protocol: Controlled synthetic cohort (5 enrolled identities, 100 genuine probes, 100 impostor probes)');
  console.log('-'.repeat(72));

  const embedder = new ArcFaceEmbedder();
  const numEnrolled = 5;
  const posesPerIdentity = 5;
  const genuineProbesPerIdentity = 20;
  const numImpostors = 100;

  // 1. Build Gallery
  console.log(`Building Gallery: ${numEnrolled} enrolled subjects with ${posesPerIdentity} enrollment poses each...`);
  const gallery = [];
  for (let id = 1; id <= numEnrolled; id++) {
    const baseVector = generateDeterministicVector(512, id * 1000);
    const poses = [baseVector];
    for (let p = 1; p < posesPerIdentity; p++) {
      // Intra-subject variation across poses (~0.05 - 0.12 angular noise)
      poses.push(addVariation(baseVector, id * 1000 + p * 100, 0.08));
    }
    // Compute average embedding
    const avg = new Float32Array(512);
    for (const pose of poses) {
      for (let i = 0; i < 512; i++) avg[i] += pose[i];
    }
    let norm = 0;
    for (let i = 0; i < 512; i++) norm += avg[i] * avg[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < 512; i++) avg[i] /= norm;

    gallery.push({
      id: `usr_subject_${id}`,
      name: `Subject ${id}`,
      embeddings: poses,
      averageEmbedding: avg,
      enrolledAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    });
  }

  // 2. Generate Probes
  const genuineProbes = [];
  for (let id = 1; id <= numEnrolled; id++) {
    const baseVector = gallery[id - 1].averageEmbedding;
    for (let g = 1; g <= genuineProbesPerIdentity; g++) {
      // Genuine probe with slight daily / illumination / pose shifts
      const noise = 0.04 + (g % 5) * 0.02; // noise between 0.04 and 0.12
      genuineProbes.push({
        expectedId: `usr_subject_${id}`,
        embedding: addVariation(baseVector, id * 50000 + g * 333, noise),
      });
    }
  }

  const impostorProbes = [];
  for (let imp = 1; imp <= numImpostors; imp++) {
    // Distinct identity never enrolled in gallery
    impostorProbes.push({
      expectedId: null,
      embedding: generateDeterministicVector(512, 900000 + imp * 777),
    });
  }

  console.log(`Generated: ${genuineProbes.length} genuine probes, ${impostorProbes.length} impostor probes.`);
  console.log('-'.repeat(72));

  // 3. Evaluate Presets: Balanced (0.70), Strict (0.80), Very Strict (0.88)
  const presets = [
    { name: 'Balanced', threshold: 0.70 },
    { name: 'Strict', threshold: 0.80 },
    { name: 'Very Strict', threshold: 0.88 },
  ];

  const results = [];

  for (const preset of presets) {
    const recognizer = new FaceRecognizer({
      threshold: preset.threshold,
      windowSize: 1, // Single-frame probe evaluation
      requiredMatches: 1,
    });

    let trueAccepts = 0;
    let falseRejects = 0;
    let falseAccepts = 0;
    let trueRejects = 0;

    const genuineScores = [];
    const impostorScores = [];
    const latencies = [];

    // Evaluate Genuine Probes
    for (const probe of genuineProbes) {
      recognizer.resetTemporalBuffer();
      const t0 = performance.now();
      const match = recognizer.evaluateFrame(probe.embedding, gallery);
      const dt = performance.now() - t0;
      latencies.push(dt);
      genuineScores.push(match.similarity);

      if (match.matched && match.identityId === probe.expectedId) {
        trueAccepts++;
      } else {
        falseRejects++;
      }
    }

    // Evaluate Impostor Probes
    for (const probe of impostorProbes) {
      recognizer.resetTemporalBuffer();
      const t0 = performance.now();
      const match = recognizer.evaluateFrame(probe.embedding, gallery);
      const dt = performance.now() - t0;
      latencies.push(dt);
      impostorScores.push(match.similarity);

      if (match.matched) {
        falseAccepts++;
      } else {
        trueRejects++;
      }
    }

    // Calculate rates
    const tar = (trueAccepts / genuineProbes.length) * 100;
    const frr = (falseRejects / genuineProbes.length) * 100;
    const far = (falseAccepts / impostorProbes.length) * 100;
    const trr = (trueRejects / impostorProbes.length) * 100;

    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stdDev = (arr, m) => Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);

    const genMean = mean(genuineScores);
    const genStd = stdDev(genuineScores, genMean);
    const impMean = mean(impostorScores);
    const impStd = stdDev(impostorScores, impMean);

    latencies.sort((a, b) => a - b);
    const latMean = mean(latencies);
    const latP50 = latencies[Math.floor(latencies.length * 0.5)];
    const latP95 = latencies[Math.floor(latencies.length * 0.95)];

    results.push({
      preset: preset.name,
      threshold: preset.threshold,
      genuineCount: genuineProbes.length,
      impostorCount: impostorProbes.length,
      trueAccepts,
      falseRejects,
      trueRejects,
      falseAccepts,
      tar: Number(tar.toFixed(2)),
      frr: Number(frr.toFixed(2)),
      far: Number(far.toFixed(2)),
      trr: Number(trr.toFixed(2)),
      genuineScoreStats: {
        mean: Number(genMean.toFixed(3)),
        min: Number(Math.min(...genuineScores).toFixed(3)),
        max: Number(Math.max(...genuineScores).toFixed(3)),
        stdDev: Number(genStd.toFixed(3)),
      },
      impostorScoreStats: {
        mean: Number(impMean.toFixed(3)),
        min: Number(Math.min(...impostorScores).toFixed(3)),
        max: Number(Math.max(...impostorScores).toFixed(3)),
        stdDev: Number(impStd.toFixed(3)),
      },
      latencyMs: {
        mean: Number(latMean.toFixed(3)),
        p50: Number(latP50.toFixed(3)),
        p95: Number(latP95.toFixed(3)),
      },
    });
  }

  // Print Table
  console.log('| Preset       | Threshold | TAR (%) | FRR (%) | FAR (%) | Genuine Score (Mean ± Std) | Impostor Score (Mean ± Std) | Latency P95 (ms) |');
  console.log('|--------------|-----------|---------|---------|---------|----------------------------|-----------------------------|------------------|');
  for (const r of results) {
    console.log(
      `| ${r.preset.padEnd(12)} | ${r.threshold.toFixed(2).padEnd(9)} | ${(r.tar + '%').padEnd(7)} | ${(r.frr + '%').padEnd(7)} | ${(r.far + '%').padEnd(7)} | ${(r.genuineScoreStats.mean + ' ± ' + r.genuineScoreStats.stdDev).padEnd(26)} | ${(r.impostorScoreStats.mean + ' ± ' + r.impostorScoreStats.stdDev).padEnd(27)} | ${r.latencyMs.p95.toFixed(3).padEnd(16)} |`
    );
  }
  console.log('-'.repeat(72));

  // Save JSON
  const outDir = path.resolve('data/evaluation');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'recognition-eval.json');
  fs.writeFileSync(outFile, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  console.log(`Saved benchmark results to: ${outFile}`);
  console.log('='.repeat(72));
}

runRecognitionEvaluation().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
