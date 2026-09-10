import type { EnrolledIdentity, MatchResult, IFaceRecognizer } from './interfaces.ts';
import { ArcFaceEmbedder } from './embedder.ts';

export interface RecognizerOptions {
  threshold?: number; // default: 0.72
  windowSize?: number; // default: 5
  requiredMatches?: number; // default: 4
}

interface FrameScore {
  identityId: string;
  identityName: string;
  similarity: number;
  timestamp: number;
}

export class FaceRecognizer implements IFaceRecognizer {
  private embedder: ArcFaceEmbedder;
  private threshold: number;
  private windowSize: number;
  private requiredMatches: number;
  private scoreBuffer: FrameScore[] = [];

  constructor(options: RecognizerOptions = {}) {
    this.embedder = new ArcFaceEmbedder();
    this.threshold = options.threshold ?? 0.72;
    this.windowSize = options.windowSize ?? 5;
    this.requiredMatches = options.requiredMatches ?? 4;
  }

  public setThreshold(threshold: number): void {
    this.threshold = Math.max(0.5, Math.min(0.98, threshold));
  }

  public getThreshold(): number {
    return this.threshold;
  }

  public evaluateFrame(embedding: Float32Array, gallery: EnrolledIdentity[]): MatchResult {
    if (!gallery || gallery.length === 0) {
      return {
        matched: false,
        similarity: 0,
        temporalConfidence: 0,
        isUnknown: true,
        frameCount: 0,
      };
    }

    // 1. Find Best Matching Identity for Current Frame
    let bestIdentity: EnrolledIdentity | null = null;
    let highestSim = -1.0;

    for (const identity of gallery) {
      if (!identity.enabled) continue;

      // Compare against average embedding and individual pose embeddings
      let maxIdentitySim = this.embedder.calculateCosineSimilarity(embedding, identity.averageEmbedding);

      for (const poseEmbed of identity.embeddings) {
        const sim = this.embedder.calculateCosineSimilarity(embedding, poseEmbed);
        if (sim > maxIdentitySim) {
          maxIdentitySim = sim;
        }
      }

      if (maxIdentitySim > highestSim) {
        highestSim = maxIdentitySim;
        bestIdentity = identity;
      }
    }

    const currentScore: FrameScore = {
      identityId: bestIdentity?.id ?? 'unknown',
      identityName: bestIdentity?.name ?? 'Unknown',
      similarity: highestSim,
      timestamp: Date.now(),
    };

    // 2. Add to Rolling Temporal Window
    this.scoreBuffer.push(currentScore);
    if (this.scoreBuffer.length > this.windowSize) {
      this.scoreBuffer.shift();
    }

    // 3. Temporal Aggregation
    // Count how many frames in the window match the best candidate above threshold
    const matchingFrames = this.scoreBuffer.filter(
      (s) => s.identityId === bestIdentity?.id && s.similarity >= this.threshold
    );

    // Weighted temporal confidence (exponential decay weighting recent frames)
    let weightedSimSum = 0;
    let weightSum = 0;
    for (let i = 0; i < this.scoreBuffer.length; i++) {
      const weight = Math.pow(1.2, i); // more weight to newer frames
      weightedSimSum += this.scoreBuffer[i].similarity * weight;
      weightSum += weight;
    }
    const temporalConfidence = weightSum > 0 ? weightedSimSum / weightSum : highestSim;

    // Decision rule: Must meet requiredMatches threshold within window
    const isMatched =
      matchingFrames.length >= this.requiredMatches &&
      bestIdentity !== null &&
      temporalConfidence >= this.threshold;

    return {
      matched: isMatched,
      identityId: isMatched ? bestIdentity?.id : undefined,
      identityName: isMatched ? bestIdentity?.name : undefined,
      similarity: Number(highestSim.toFixed(3)),
      temporalConfidence: Number(temporalConfidence.toFixed(3)),
      isUnknown: !isMatched,
      frameCount: this.scoreBuffer.length,
    };
  }

  public resetTemporalBuffer(): void {
    this.scoreBuffer = [];
  }
}
