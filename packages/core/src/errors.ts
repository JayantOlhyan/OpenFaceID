/**
 * OpenFaceID Canonical Error Identifiers and Classes
 * Standardized across Core, Camera, Vision, Storage, Security, API, and Desktop.
 */

export const ErrorCode = {
  // Camera Errors
  CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
  CAMERA_UNAVAILABLE: 'CAMERA_UNAVAILABLE',
  CAMERA_DISCONNECTED: 'CAMERA_DISCONNECTED',
  CAMERA_INITIALIZATION_FAILED: 'CAMERA_INITIALIZATION_FAILED',

  // Integrity & Model Errors
  MODEL_INTEGRITY_FAILURE: 'MODEL_INTEGRITY_FAILURE',

  // Identity & Storage Errors
  IDENTITY_STORE_CORRUPT: 'IDENTITY_STORE_CORRUPT',
  IDENTITY_NOT_FOUND: 'IDENTITY_NOT_FOUND',
  IDENTITY_ENROLLMENT_FAILED: 'IDENTITY_ENROLLMENT_FAILED',
  IDENTITY_DELETE_FAILED: 'IDENTITY_DELETE_FAILED',

  // Liveness Errors
  LIVENESS_FAILED: 'LIVENESS_FAILED',
  LIVENESS_TIMEOUT: 'LIVENESS_TIMEOUT',

  // Detection & Recognition Errors
  FACE_NOT_DETECTED: 'FACE_NOT_DETECTED',
  MULTIPLE_FACES_DETECTED: 'MULTIPLE_FACES_DETECTED',
  UNKNOWN_FACE: 'UNKNOWN_FACE',

  // IPC & Communication Errors
  IPC_UNAUTHORIZED: 'IPC_UNAUTHORIZED',
  IPC_UNAVAILABLE: 'IPC_UNAVAILABLE',
  IPC_TIMEOUT: 'IPC_TIMEOUT',
  IPC_INVALID_REQUEST: 'IPC_INVALID_REQUEST',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Privacy & Lifecycle Errors
  PRIVACY_PAUSED: 'PRIVACY_PAUSED',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  PRESENCE_TIMEOUT: 'PRESENCE_TIMEOUT',

  // Platform & Keyring Errors
  PLATFORM_UNSUPPORTED: 'PLATFORM_UNSUPPORTED',
  KEYRING_ACCESS_DENIED: 'KEYRING_ACCESS_DENIED',
  CRYPTO_AUTHENTICATION_FAILURE: 'CRYPTO_AUTHENTICATION_FAILURE',
  STORAGE_TRAVERSAL_DENIED: 'STORAGE_TRAVERSAL_DENIED',
  ENROLLMENT_INCOMPLETE: 'ENROLLMENT_INCOMPLETE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorRecoverySuggestion {
  action: string;
  command?: string;
  docsUrl?: string;
  retryable?: boolean;
}

export const ERROR_RECOVERY_SUGGESTIONS: Record<ErrorCode, ErrorRecoverySuggestion> = {
  [ErrorCode.CAMERA_PERMISSION_DENIED]: {
    action: 'Grant camera access in your operating system Settings / Privacy preferences.',
    command: process.platform === 'darwin' ? 'open "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"' : undefined,
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/docs/camera-troubleshooting.md',
    retryable: true,
  },
  [ErrorCode.CAMERA_UNAVAILABLE]: {
    action: 'Check that another application (Zoom, Teams, FaceTime) is not locking the webcam.',
    command: 'openfaceid doctor',
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/docs/camera-troubleshooting.md',
    retryable: true,
  },
  [ErrorCode.CAMERA_DISCONNECTED]: {
    action: 'Reconnect your USB webcam or check built-in camera hardware connection.',
    command: 'openfaceid camera status',
    retryable: true,
  },
  [ErrorCode.CAMERA_INITIALIZATION_FAILED]: {
    action: 'Failed to initialize video capture stream. Verify camera permissions and driver status.',
    command: 'openfaceid doctor',
    retryable: true,
  },
  [ErrorCode.MODEL_INTEGRITY_FAILURE]: {
    action: 'Neural network weight file hash mismatch. Reinstall or verify model signatures.',
    command: 'openfaceid security check',
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/docs/threat-model.md',
    retryable: false,
  },
  [ErrorCode.IDENTITY_STORE_CORRUPT]: {
    action: 'The encrypted biometric identity store failed integrity checks. Re-enroll your identity.',
    command: 'openfaceid identity enroll <name>',
    retryable: false,
  },
  [ErrorCode.IDENTITY_NOT_FOUND]: {
    action: 'No enrolled biometric identity found for this ID. Launch enrollment to create a profile.',
    command: 'openfaceid identity enroll <name>',
    retryable: false,
  },
  [ErrorCode.IDENTITY_ENROLLMENT_FAILED]: {
    action: 'Biometric enrollment failed due to poor quality, movement, or lighting. Retry enrollment.',
    retryable: true,
  },
  [ErrorCode.IDENTITY_DELETE_FAILED]: {
    action: 'Failed to securely shred identity from encrypted store. Check filesystem permissions.',
    retryable: true,
  },
  [ErrorCode.LIVENESS_FAILED]: {
    action: 'Presentation attack detection rejected the face. Ensure natural micro-motion and direct camera gaze.',
    retryable: true,
  },
  [ErrorCode.LIVENESS_TIMEOUT]: {
    action: 'Liveness challenge timed out before detection. Keep face centered and look directly at camera.',
    retryable: true,
  },
  [ErrorCode.FACE_NOT_DETECTED]: {
    action: 'No face visible in camera field of view. Center your face in front of the lens.',
    retryable: true,
  },
  [ErrorCode.MULTIPLE_FACES_DETECTED]: {
    action: 'Multiple faces in view. For security and privacy, only one person must be visible.',
    retryable: true,
  },
  [ErrorCode.UNKNOWN_FACE]: {
    action: 'Detected face does not match any enrolled identity profile in local encrypted storage.',
    retryable: true,
  },
  [ErrorCode.IPC_UNAUTHORIZED]: {
    action: 'Authentication token missing or invalid. Verify ~/.openfaceid/token file permissions.',
    command: 'openfaceid doctor',
    retryable: true,
  },
  [ErrorCode.IPC_UNAVAILABLE]: {
    action: 'OpenFaceID background daemon is not running. Launch desktop app or start daemon.',
    command: 'openfaceid status',
    retryable: true,
  },
  [ErrorCode.IPC_TIMEOUT]: {
    action: 'Local daemon did not respond within timeout window. Daemon may be busy or reloading.',
    retryable: true,
  },
  [ErrorCode.IPC_INVALID_REQUEST]: {
    action: 'Malformed JSON payload or schema validation failure.',
    retryable: false,
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    action: 'Too many requests sent in short window. Back off and retry.',
    retryable: true,
  },
  [ErrorCode.PRIVACY_PAUSED]: {
    action: 'Camera processing is paused by user request. Resume recognition from tray or settings.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_ERROR]: {
    action: 'An unexpected internal error occurred. Inspect logs or run openfaceid doctor.',
    command: 'openfaceid doctor',
    retryable: true,
  },
  [ErrorCode.PLATFORM_UNSUPPORTED]: {
    action: 'Operating system kernel or architecture is unsupported.',
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/README.md#platform-support',
    retryable: false,
  },
  [ErrorCode.KEYRING_ACCESS_DENIED]: {
    action: 'Unable to access OS keystore. Check keychain permissions or file permissions on ~/.openfaceid/.master_key.',
    retryable: true,
  },
  [ErrorCode.PRESENCE_TIMEOUT]: {
    action: 'User presence verification timed out.',
    retryable: true,
  },
  [ErrorCode.CRYPTO_AUTHENTICATION_FAILURE]: {
    action: 'AES-GCM authentication tag verification failed. Ciphertext has been modified or corrupted.',
    retryable: false,
  },
  [ErrorCode.STORAGE_TRAVERSAL_DENIED]: {
    action: 'Access rejected due to unsafe path or invalid ID pattern.',
    retryable: false,
  },
  [ErrorCode.ENROLLMENT_INCOMPLETE]: {
    action: 'User canceled enrollment or failed to capture required face poses.',
    retryable: true,
  },
};

export class OpenFaceIDError extends Error {
  public readonly code: ErrorCode;
  public readonly recovery: ErrorRecoverySuggestion;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OpenFaceIDError';
    this.code = code;
    this.details = details;
    this.recovery = ERROR_RECOVERY_SUGGESTIONS[code] || {
      action: 'Check logs or run openfaceid doctor for diagnostics.',
      retryable: true,
    };
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recovery: this.recovery,
      details: this.details,
    };
  }
}
