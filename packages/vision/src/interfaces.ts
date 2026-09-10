import type { CameraFrame } from '../../camera/src/index.ts';
import type { LivenessMode } from '../../core/src/index.ts';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
}

export interface FaceLandmarks {
  leftEye: LandmarkPoint;
  rightEye: LandmarkPoint;
  noseTip: LandmarkPoint;
  leftMouth: LandmarkPoint;
  rightMouth: LandmarkPoint;
}

export interface FaceQualityScore {
  sharpness: number; // Laplacian variance (acceptable: > 80)
  brightness: number; // Mean luminance 0-255 (acceptable: 40 - 220)
  centering: number; // Center offset 0-1 (acceptable: < 0.25)
  sizeRatio: number; // Face area / frame area (acceptable: 0.08 - 0.70)
  yawDeg: number; // Head rotation left/right in degrees
  pitchDeg: number; // Head tilt up/down in degrees
  rollDeg: number; // Head tilt side-to-side in degrees
  isAcceptable: boolean;
  rejectionReason?: string;
  userGuidance: string;
}

export interface FaceDetectionResult {
  box: BoundingBox;
  landmarks: FaceLandmarks;
  confidence: number;
  quality: FaceQualityScore;
}

export interface EnrolledIdentity {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  embeddings: Float32Array[]; // Multiple 512D vectors for various poses
  averageEmbedding: Float32Array; // Mean L2-normalized 512D vector
  recognitionStats: {
    matchCount: number;
    lastRecognizedAt?: number;
    lastConfidence?: number;
  };
}

export interface MatchResult {
  matched: boolean;
  identityId?: string;
  identityName?: string;
  similarity: number;
  temporalConfidence: number;
  isUnknown: boolean;
  frameCount: number;
}

export interface LivenessResult {
  passed: boolean;
  mode: LivenessMode;
  score: number; // 0.0 to 1.0
  blinkDetected: boolean;
  motionVariance: number;
  challengeCompleted?: boolean;
  reason?: string;
}

export interface IFaceDetector {
  detect(frame: CameraFrame): Promise<FaceDetectionResult[]>;
}

export interface IFaceQualityAnalyzer {
  analyzeQuality(frame: CameraFrame, box: BoundingBox, landmarks: FaceLandmarks): FaceQualityScore;
}

export interface IFaceEmbedder {
  embed(frame: CameraFrame, landmarks: FaceLandmarks): Promise<Float32Array>;
  calculateCosineSimilarity(vecA: Float32Array, vecB: Float32Array): number;
}

export interface IFaceRecognizer {
  evaluateFrame(embedding: Float32Array, gallery: EnrolledIdentity[]): MatchResult;
  resetTemporalBuffer(): void;
}

export interface ILivenessDetector {
  evaluateLiveness(
    frames: CameraFrame[],
    landmarksHistory: FaceLandmarks[],
    mode: LivenessMode
  ): Promise<LivenessResult>;
}
