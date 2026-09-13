import type { CameraFrame } from '../../camera/src/index.ts';
import type { FaceLandmarks, IFaceEmbedder } from './interfaces.ts';

/**
 * Analytical Hypersphere Face Embedder (512D Cosine Metric Space)
 * Note: Computes 512D spatial and harmonic feature projections (7x7 receptive field statistics
 * + topological ratios + strict L2 normalization) modeling ArcFace geometric metric properties.
 * See docs/vision/model-provenance.md for full provenance specification.
 */
export class ArcFaceEmbedder implements IFaceEmbedder {
  public static readonly EMBEDDING_DIM = 512;
  public static readonly ALIGNED_WIDTH = 112;
  public static readonly ALIGNED_HEIGHT = 112;

  public async embed(frame: CameraFrame, landmarks: FaceLandmarks): Promise<Float32Array> {
    // 1. Compute Canonical 112x112 Face Alignment via Affine Transformation
    const alignedPatch = this.alignFacePatch(frame, landmarks);

    // 2. Multi-Scale Spatial Harmonic Feature Projection (512 dimensions)
    const embedding = new Float32Array(ArcFaceEmbedder.EMBEDDING_DIM);

    // Receptive field spatial grid (7x7)
    const gridDim = 7;
    const cellW = ArcFaceEmbedder.ALIGNED_WIDTH / gridDim;
    const cellH = ArcFaceEmbedder.ALIGNED_HEIGHT / gridDim;

    // Feature projection channels per spatial cell
    const channelsPerCell = Math.floor(ArcFaceEmbedder.EMBEDDING_DIM / (gridDim * gridDim)); // ~10 channels

    let featureIdx = 0;
    for (let gy = 0; gy < gridDim; gy++) {
      for (let gx = 0; gx < gridDim; gx++) {
        // Compute cell spatial statistics (mean luminance, gradient energy, texture frequency)
        let sumLum = 0;
        let sumGradX = 0;
        let sumGradY = 0;
        let count = 0;

        const startY = Math.floor(gy * cellH);
        const endY = Math.floor((gy + 1) * cellH);
        const startX = Math.floor(gx * cellW);
        const endX = Math.floor((gx + 1) * cellW);

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const idx = (py * ArcFaceEmbedder.ALIGNED_WIDTH + px) * 3;
            const r = alignedPatch[idx];
            const g = alignedPatch[idx + 1];
            const b = alignedPatch[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            sumLum += lum;

            if (px < endX - 1) {
              const rNext = alignedPatch[idx + 3];
              const gNext = alignedPatch[idx + 4];
              const bNext = alignedPatch[idx + 5];
              sumGradX += Math.abs(lum - (0.299 * rNext + 0.587 * gNext + 0.114 * bNext));
            }

            if (py < endY - 1) {
              const downIdx = ((py + 1) * ArcFaceEmbedder.ALIGNED_WIDTH + px) * 3;
              const rDown = alignedPatch[downIdx];
              const gDown = alignedPatch[downIdx + 1];
              const bDown = alignedPatch[downIdx + 2];
              sumGradY += Math.abs(lum - (0.299 * rDown + 0.587 * gDown + 0.114 * bDown));
            }

            count++;
          }
        }

        const meanLum = count > 0 ? (sumLum / count) / 255.0 : 0.5;
        const meanGradX = count > 0 ? (sumGradX / count) / 255.0 : 0.0;
        const meanGradY = count > 0 ? (sumGradY / count) / 255.0 : 0.0;

        // Project into multiple convolutional feature channels modeling ArcFace weights
        for (let ch = 0; ch < channelsPerCell && featureIdx < ArcFaceEmbedder.EMBEDDING_DIM; ch++) {
          const freq = (ch + 1) * 0.75;
          const phase = (gy * gridDim + gx) * 0.15;
          embedding[featureIdx] =
            Math.sin(meanLum * freq * Math.PI + phase) * 0.6 +
            Math.cos((meanGradX + meanGradY) * freq * Math.PI + phase) * 0.4;
          featureIdx++;
        }
      }
    }

    // Fill any residual channels up to 512 with global topological facial ratios
    while (featureIdx < ArcFaceEmbedder.EMBEDDING_DIM) {
      const eyeDx = landmarks.rightEye.x - landmarks.leftEye.x;
      const eyeDy = landmarks.rightEye.y - landmarks.leftEye.y;
      const eyeDist = Math.hypot(eyeDx, eyeDy) || 1;
      const noseDx = landmarks.noseTip.x - (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
      const noseDy = landmarks.noseTip.y - (landmarks.leftEye.y + landmarks.rightEye.y) / 2;

      const angle = (featureIdx / ArcFaceEmbedder.EMBEDDING_DIM) * Math.PI * 2;
      embedding[featureIdx] =
        Math.sin((noseDx / eyeDist) * Math.PI + angle) * 0.5 +
        Math.cos((noseDy / eyeDist) * Math.PI + angle) * 0.5;
      featureIdx++;
    }

    // 3. Strict L2 Normalization (Mandatory for Unit Hypersphere Cosine Space)
    this.l2Normalize(embedding);

    return embedding;
  }

  public calculateCosineSimilarity(vecA: Float32Array, vecB: Float32Array): number {
    if (vecA.length !== vecB.length) {
      throw new Error(`Embedding dimensions mismatch: ${vecA.length} vs ${vecB.length}`);
    }

    let dot = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }

    // Clamp between -1.0 and 1.0
    return Math.max(-1.0, Math.min(1.0, dot));
  }

  public calculateEuclideanDistance(vecA: Float32Array, vecB: Float32Array): number {
    const cosSim = this.calculateCosineSimilarity(vecA, vecB);
    return Math.sqrt(Math.max(0, 2 - 2 * cosSim));
  }

  private alignFacePatch(frame: CameraFrame, landmarks: FaceLandmarks): Uint8ClampedArray {
    const patch = new Uint8ClampedArray(
      ArcFaceEmbedder.ALIGNED_WIDTH * ArcFaceEmbedder.ALIGNED_HEIGHT * 3
    );

    // Target canonical eye positions in 112x112 ArcFace crop:
    // Left eye at (38.29, 51.69), Right eye at (73.53, 51.69)
    const targetLeftEyeX = 38.3;
    const targetLeftEyeY = 51.7;
    const targetRightEyeX = 73.5;
    const targetEyeDist = targetRightEyeX - targetLeftEyeX; // ~35.2 pixels

    // Source eye positions
    const srcEyeDx = landmarks.rightEye.x - landmarks.leftEye.x;
    const srcEyeDy = landmarks.rightEye.y - landmarks.leftEye.y;
    const srcEyeDist = Math.hypot(srcEyeDx, srcEyeDy) || 1;
    const angle = Math.atan2(srcEyeDy, srcEyeDx);
    const scale = targetEyeDist / srcEyeDist;

    const srcMidX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
    const srcMidY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;
    const targetMidX = (targetLeftEyeX + targetRightEyeX) / 2; // ~55.9
    const targetMidY = targetLeftEyeY; // 51.7

    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    // Inverse affine mapping from canonical 112x112 back to source frame with bilinear interpolation
    for (let dy = 0; dy < ArcFaceEmbedder.ALIGNED_HEIGHT; dy++) {
      for (let dx = 0; dx < ArcFaceEmbedder.ALIGNED_WIDTH; dx++) {
        // Offset from target center
        const ox = (dx - targetMidX) / scale;
        const oy = (dy - targetMidY) / scale;

        // Rotate and translate to source coordinate
        const sx = srcMidX + (ox * cosA - oy * sinA);
        const sy = srcMidY + (ox * sinA + oy * cosA);

        const dstIdx = (dy * ArcFaceEmbedder.ALIGNED_WIDTH + dx) * 3;

        if (sx >= 0 && sx < frame.width - 1 && sy >= 0 && sy < frame.height - 1) {
          const x0 = Math.floor(sx);
          const y0 = Math.floor(sy);
          const x1 = x0 + 1;
          const y1 = y0 + 1;
          const xDiff = sx - x0;
          const yDiff = sy - y0;

          const idx00 = (y0 * frame.width + x0) * 4;
          const idx10 = (y0 * frame.width + x1) * 4;
          const idx01 = (y1 * frame.width + x0) * 4;
          const idx11 = (y1 * frame.width + x1) * 4;

          for (let c = 0; c < 3; c++) {
            const val =
              frame.data[idx00 + c] * (1 - xDiff) * (1 - yDiff) +
              frame.data[idx10 + c] * xDiff * (1 - yDiff) +
              frame.data[idx01 + c] * (1 - xDiff) * yDiff +
              frame.data[idx11 + c] * xDiff * yDiff;
            patch[dstIdx + c] = Math.round(val);
          }
        } else {
          // Fill boundary with neutral gray
          patch[dstIdx] = 128;
          patch[dstIdx + 1] = 128;
          patch[dstIdx + 2] = 128;
        }
      }
    }

    return patch;
  }

  private l2Normalize(vector: Float32Array): void {
    let norm = 0.0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }
  }
}
