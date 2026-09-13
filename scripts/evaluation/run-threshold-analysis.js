#!/usr/bin/env node
/**
 * OpenFaceID — Threshold Calibration & Equal Error Rate (EER) Sweep Runner
 *
 * Sweeps similarity thresholds across [0.50, 0.95] to plot FAR(t) vs FRR(t)
 * and discover the empirical Equal Error Rate crossover point.
 */

import fs from 'fs';
import path from 'path';
import { FaceRecognizer } from '../../packages/vision/src/recognizer.ts';

function createRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateUnitVector(dim = 512, seed = 1) {
  const rng = createRng(seed);
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    const u1 = Math.max(1e-7, rng());
    const u2 = rng();
    vec[i] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
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
    result[i] = base[i] + (rng() - 0.5) * 2 * noiseScale;
  }
  let norm = 0;
  for (let i = 0; i < result.length; i++) norm += result[i] * result[i];
  norm = Math.sqrt(norm);
  for (let i = 0; i < result.length; i++) result[i] /= norm;
  return result;
}

async function runThresholdAnalysis() {
  console.log('='.repeat(72));
  console.log('OPENFACEID — THRESHOLD SWEEP & CALIBRATION ANALYSIS');
  console.log('='.repeat(72));

  const numSubjects = 10;
  const numGenuinePerSubject = 15;
  const numImpostors = 150;

  // 1. Build Gallery
  const gallery = [];
  for (let i = 1; i <= numSubjects; i++) {
    const base = generateUnitVector(512, i * 2000);
    const poses = [base];
    for (let p = 1; p <= 4; p++) {
      poses.push(addVariation(base, i * 2000 + p * 111, 0.07));
    }
    const avg = new Float32Array(512);
    for (const p of poses) {
      for (let d = 0; d < 512; d++) avg[d] += p[d];
    }
    let norm = 0;
    for (let d = 0; d < 512; d++) norm += avg[d] * avg[d];
    norm = Math.sqrt(norm);
    for (let d = 0; d < 512; d++) avg[d] /= norm;

    gallery.push({
      id: `usr_${i}`,
      name: `Subject ${i}`,
      embeddings: poses,
      averageEmbedding: avg,
      enrolledAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    });
  }

  // 2. Generate Probes
  const genuineProbes = [];
  for (let i = 1; i <= numSubjects; i++) {
    const base = gallery[i - 1].averageEmbedding;
    for (let g = 1; g <= numGenuinePerSubject; g++) {
      genuineProbes.push({
        expectedId: `usr_${i}`,
        embedding: addVariation(base, i * 9999 + g * 37, 0.06),
      });
    }
  }

  const impostorProbes = [];
  for (let imp = 1; imp <= numImpostors; imp++) {
    impostorProbes.push({
      expectedId: null,
      embedding: generateUnitVector(512, 555555 + imp * 123),
    });
  }

  console.log(`Evaluating cohort: ${genuineProbes.length} genuine probes, ${impostorProbes.length} impostor probes.`);
  console.log('-'.repeat(72));

  // 3. Sweep thresholds
  const sweep = [];
  const thresholds = [];
  for (let t = 0.50; t <= 0.94; t += 0.02) {
    thresholds.push(Number(t.toFixed(2)));
  }

  let eerPoint = null;
  let minDiff = Infinity;

  console.log('| Threshold | TAR (%) | FRR (%) | FAR (%) | Genuine Decision | Impostor Decision |');
  console.log('|-----------|---------|---------|---------|------------------|-------------------|');

  for (const t of thresholds) {
    const recognizer = new FaceRecognizer({ threshold: t, windowSize: 1, requiredMatches: 1 });

    let ta = 0;
    let fr = 0;
    for (const p of genuineProbes) {
      recognizer.resetTemporalBuffer();
      const res = recognizer.evaluateFrame(p.embedding, gallery);
      if (res.matched && res.identityId === p.expectedId) {
        ta++;
      } else {
        fr++;
      }
    }

    let fa = 0;
    let tr = 0;
    for (const p of impostorProbes) {
      recognizer.resetTemporalBuffer();
      const res = recognizer.evaluateFrame(p.embedding, gallery);
      if (res.matched) {
        fa++;
      } else {
        tr++;
      }
    }

    const tar = (ta / genuineProbes.length) * 100;
    const frr = (fr / genuineProbes.length) * 100;
    const far = (fa / impostorProbes.length) * 100;

    const diff = Math.abs(frr - far);
    if (diff < minDiff) {
      minDiff = diff;
      eerPoint = { threshold: t, frr: Number(frr.toFixed(2)), far: Number(far.toFixed(2)) };
    }

    const entry = {
      threshold: t,
      tar: Number(tar.toFixed(2)),
      frr: Number(frr.toFixed(2)),
      far: Number(far.toFixed(2)),
    };
    sweep.push(entry);

    console.log(
      `| ${t.toFixed(2).padEnd(9)} | ${(entry.tar + '%').padEnd(7)} | ${(entry.frr + '%').padEnd(7)} | ${(entry.far + '%').padEnd(7)} | ${ta}/${genuineProbes.length} accepted    | ${fa}/${impostorProbes.length} false accepts   |`
    );
  }

  console.log('-'.repeat(72));
  console.log(`Empirical EER Crossover: Threshold ~ ${eerPoint.threshold.toFixed(2)} (FRR ~ ${eerPoint.frr}%, FAR ~ ${eerPoint.far}%)`);
  console.log('='.repeat(72));

  const outDir = path.resolve('data/evaluation');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'threshold-sweep.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), eerPoint, sweep }, null, 2)
  );
}

runThresholdAnalysis().catch((err) => {
  console.error(err);
  process.exit(1);
});
