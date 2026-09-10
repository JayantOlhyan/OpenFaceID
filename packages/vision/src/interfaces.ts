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
  leftEar?: LandmarkPoint;
  rightEar?: LandmarkPoint;
  allPoints?: LandmarkPoint[];
}

export interface FaceQualityScore {
  sharpness: number; // Laplacian variance (acceptable: > 50)
  brightness: number; // Mean luminance 0-255 (acceptable: 35 - 235)
  centering: number; // Center offset 0-1 (acceptable: < 0.35)
  sizeRatio: number; // Face area / frame area (acceptable: 0.08 - 0.75)
  yawDeg: number; // Head rotation left/right in degrees (-35 to +35)
  pitchDeg: number; // Head tilt up/down in degrees (-30 to +30)
  rollDeg: number; // Head tilt side-to-side in degrees (-25 to +25)
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

export type LivenessState =
  | 'LIVENESS_IDLE'
  | 'LIVENESS_STARTING'
  | 'CHALLENGE_PRESENTED'
  | 'WAITING_FOR_RESPONSE'
  | 'RESPONSE_DETECTED'
  | 'LIVENESS_PASSED'
  | 'LIVENESS_FAILED'
  | 'LIVENESS_TIMEOUT';

export interface LivenessResult {
  passed: boolean;
  mode: LivenessMode;
  state: LivenessState;
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
