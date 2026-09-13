/**
 * OpenFaceID Developer Example: Face Recognition & Cosine Similarity
 *
 * Purpose:
 *   Demonstrates generating 512D unit-length embeddings from face landmarks,
 *   calculating cosine similarity, and matching against an enrolled gallery.
 *
 * Requirements:
 *   - Node.js >= 22.0.0
 *
 * Run Command:
 *   node --experimental-strip-types examples/recognition.ts
 *
 * Expected Output:
 *   Embedding dimension, L2-norm verification, pairwise cosine similarity scores,
 *   and match decisions.
 *
 * Security Considerations:
 *   - Raw embedding vectors are never logged or exported.
 *   - Match condition requires cosine similarity >= threshold (default 0.70).
 */

import { ArcFaceEmbedder, FaceRecognizer } from '../packages/vision/src/index.ts';
import { createSyntheticFrame, createSyntheticLandmarks } from './demo/fixtures.ts';

async function run() {
  console.log('=== OpenFaceID Example: Face Recognition & Cosine Similarity ===\n');

  const embedder = new ArcFaceEmbedder();
  // Configure recognizer with windowSize = 1, requiredMatches = 1 for single-frame match
  const recognizer = new FaceRecognizer({ threshold: 0.70, windowSize: 1, requiredMatches: 1 });

  // 1. Generate embedding for Alice (Subject A)
  const frameA = createSyntheticFrame(640, 480, 200);
  const landmarksA = createSyntheticLandmarks(0, 0);
  const embeddingA = await embedder.embed(frameA, landmarksA);
  frameA.zeroize();

  console.log(`1. Embedding Generation:`);
  console.log(`   Dimensions:     ${embeddingA.length}D`);
  const normA = Math.sqrt(embeddingA.reduce((sum, val) => sum + val * val, 0));
  console.log(`   L2-Norm:        ${normA.toFixed(4)} (Unit length normalized)`);

  // 2. Generate embedding for Alice probe (same person, slight variation)
  const frameAProbe = createSyntheticFrame(640, 480, 200);
  const landmarksAProbe = createSyntheticLandmarks(2, 1);
  const embeddingAProbe = await embedder.embed(frameAProbe, landmarksAProbe);
  frameAProbe.zeroize();

  // 3. Generate embedding for Bob (Subject B / Impostor probe)
  const frameB = createSyntheticFrame(640, 480, 50);
  const landmarksB = createSyntheticLandmarks(60, -40);
  const embeddingB = await embedder.embed(frameB, landmarksB);
  frameB.zeroize();

  // 4. Calculate pairwise cosine similarities
  const simSelf = embedder.calculateCosineSimilarity(embeddingA, embeddingA);
  const simGenuine = embedder.calculateCosineSimilarity(embeddingA, embeddingAProbe);
  const simImpostor = embedder.calculateCosineSimilarity(embeddingA, embeddingB);

  console.log(`\n2. Cosine Similarity Metrics (Higher = Closer match):`);
  console.log(`   Self-Similarity (A vs A):      ${simSelf.toFixed(4)} (Exact match)`);
  console.log(`   Genuine Probe (A vs A-Probe):  ${simGenuine.toFixed(4)} (Accepted if >= 0.70)`);
  console.log(`   Impostor Probe (A vs B):       ${simImpostor.toFixed(4)} (Rejected)`);

  // 5. Evaluate against Gallery
  const gallery = [
    {
      id: 'usr_alice_01',
      name: 'Alice',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [embeddingA],
      averageEmbedding: embeddingA,
      recognitionStats: { matchCount: 0 },
    },
  ];

  const matchGenuine = recognizer.evaluateFrame(embeddingAProbe, gallery);
  console.log(`\n3. Match Decisions:`);
  console.log(`   Genuine Probe Match:   ${matchGenuine.matched ? 'YES' : 'NO'} (Confidence: ${(matchGenuine.similarity * 100).toFixed(1)}%)`);

  recognizer.resetTemporalBuffer();
  const matchImpostor = recognizer.evaluateFrame(embeddingB, gallery);
  console.log(`   Impostor Probe Match:  ${matchImpostor.matched ? 'YES (Authorized)' : 'NO (Rejected)'} (Similarity: ${(matchImpostor.similarity * 100).toFixed(1)}%)`);

  console.log('\n✓ Recognition example completed successfully.');
}

run().catch(console.error);
