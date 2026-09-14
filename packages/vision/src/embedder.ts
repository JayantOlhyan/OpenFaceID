import type { CameraFrame } from '../../camera/src/index.ts';
import type { FaceLandmarks, IFaceEmbedder } from './interfaces.ts';
import {
  type EmbedderProviderType,
  type IEmbedderProvider,
  AnalyticalEmbedderProvider,
  CoreMLEmbedderProvider,
  OnnxEmbedderProvider,
  resolveEmbedderProvider,
} from './providers.ts';

/**
 * ArcFace Embedder (512D Cosine Metric Space)
 * Multi-Provider Architecture:
 * - macOS: CoreML / Apple Neural Engine
 * - Windows & Linux: ONNX Runtime (DirectML / CPU / OpenVINO)
 * - Universal: In-Tree Analytical Hypersphere Embedder (Zero external weight downloads)
 */
export class ArcFaceEmbedder implements IFaceEmbedder {
  public static readonly EMBEDDING_DIM = 512;
  public static readonly ALIGNED_WIDTH = 112;
  public static readonly ALIGNED_HEIGHT = 112;

  private activeProvider: IEmbedderProvider;
  private analyticalFallback: AnalyticalEmbedderProvider;
  private preferredType: EmbedderProviderType;
  private resolutionVersion = 0;

  constructor(preferredType: EmbedderProviderType = 'auto') {
    this.preferredType = preferredType;
    this.analyticalFallback = new AnalyticalEmbedderProvider();
    this.activeProvider = this.analyticalFallback;

    // Asynchronously resolve preferred provider
    const currentVer = ++this.resolutionVersion;
    resolveEmbedderProvider(preferredType).then((provider) => {
      if (this.resolutionVersion === currentVer) {
        this.activeProvider = provider;
      }
    });
  }

  public getActiveProvider(): EmbedderProviderType {
    return this.activeProvider.type;
  }

  public getProviderName(): string {
    return this.activeProvider.name;
  }

  public async setProvider(providerType: EmbedderProviderType): Promise<void> {
    this.preferredType = providerType;
    const currentVer = ++this.resolutionVersion;
    const provider = await resolveEmbedderProvider(providerType);
    if (this.resolutionVersion === currentVer) {
      this.activeProvider = provider;
    }
  }

  public async getCapabilities(): Promise<{
    active: EmbedderProviderType;
    coremlAvailable: boolean;
    onnxAvailable: boolean;
    analyticalAvailable: boolean;
  }> {
    const coreml = new CoreMLEmbedderProvider();
    const onnx = new OnnxEmbedderProvider();

    return {
      active: this.activeProvider.type,
      coremlAvailable: await coreml.isAvailable(),
      onnxAvailable: await onnx.isAvailable(),
      analyticalAvailable: true,
    };
  }

  public async embed(frame: CameraFrame, landmarks: FaceLandmarks): Promise<Float32Array> {
    return this.activeProvider.embed(frame, landmarks);
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

  /**
   * Canonical 112x112 face alignment helper (backward compatibility)
   */
  public alignFacePatch(frame: CameraFrame, landmarks: FaceLandmarks): Uint8ClampedArray {
    return this.analyticalFallback.alignFacePatch(frame, landmarks);
  }
}
