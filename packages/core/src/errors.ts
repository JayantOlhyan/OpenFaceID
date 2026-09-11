/**
 * OpenFaceID Canonical Error Identifiers and Classes
 * Standardized across Core, Camera, Vision, Storage, Security, API, and Desktop.
 */

export const ErrorCode = {
  CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
  CAMERA_UNAVAILABLE: 'CAMERA_UNAVAILABLE',
  MODEL_INTEGRITY_FAILURE: 'MODEL_INTEGRITY_FAILURE',
  IDENTITY_STORE_CORRUPT: 'IDENTITY_STORE_CORRUPT',
  IPC_UNAUTHORIZED: 'IPC_UNAUTHORIZED',
  IPC_INVALID_REQUEST: 'IPC_INVALID_REQUEST',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  PLATFORM_UNSUPPORTED: 'PLATFORM_UNSUPPORTED',
  KEYRING_ACCESS_DENIED: 'KEYRING_ACCESS_DENIED',
  PRESENCE_TIMEOUT: 'PRESENCE_TIMEOUT',
  CRYPTO_AUTHENTICATION_FAILURE: 'CRYPTO_AUTHENTICATION_FAILURE',
  STORAGE_TRAVERSAL_DENIED: 'STORAGE_TRAVERSAL_DENIED',
  ENROLLMENT_INCOMPLETE: 'ENROLLMENT_INCOMPLETE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorRecoverySuggestion {
  action: string;
  command?: string;
  docsUrl?: string;
}

export const ERROR_RECOVERY_SUGGESTIONS: Record<ErrorCode, ErrorRecoverySuggestion> = {
  [ErrorCode.CAMERA_PERMISSION_DENIED]: {
    action: 'Grant camera access in your operating system Settings / Privacy preferences.',
    command: process.platform === 'darwin' ? 'open "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"' : undefined,
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/docs/camera-troubleshooting.md',
  },
  [ErrorCode.CAMERA_UNAVAILABLE]: {
    action: 'Check that another application (Zoom, Teams, FaceTime) is not locking the webcam.',
    command: 'openfaceid doctor',
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/docs/camera-troubleshooting.md',
  },
  [ErrorCode.MODEL_INTEGRITY_FAILURE]: {
    action: 'Neural network weight file hash mismatch. Reinstall or verify model signatures.',
    command: 'openfaceid security check',
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/docs/threat-model.md',
  },
  [ErrorCode.IDENTITY_STORE_CORRUPT]: {
    action: 'The encrypted biometric identity store failed integrity checks. Re-enroll your identity.',
    command: 'openfaceid enroll',
  },
  [ErrorCode.IPC_UNAUTHORIZED]: {
    action: 'Authentication token missing or invalid. Verify ~/.openfaceid/token file permissions.',
    command: 'openfaceid doctor',
  },
  [ErrorCode.IPC_INVALID_REQUEST]: {
    action: 'Malformed JSON payload or schema validation failure.',
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    action: 'Too many requests sent in short window. Back off and retry.',
  },
  [ErrorCode.PLATFORM_UNSUPPORTED]: {
    action: 'Operating system kernel or architecture is unsupported.',
    docsUrl: 'https://github.com/JayantOlhyan/OpenFaceID/blob/main/README.md#platform-support',
  },
  [ErrorCode.KEYRING_ACCESS_DENIED]: {
    action: 'Unable to access OS keystore. Check keychain permissions or file permissions on ~/.openfaceid/.master.key.',
  },
  [ErrorCode.PRESENCE_TIMEOUT]: {
    action: 'User presence verification timed out.',
  },
  [ErrorCode.CRYPTO_AUTHENTICATION_FAILURE]: {
    action: 'AES-GCM authentication tag verification failed. Ciphertext has been modified or corrupted.',
  },
  [ErrorCode.STORAGE_TRAVERSAL_DENIED]: {
    action: 'Access rejected due to unsafe path or invalid ID pattern.',
  },
  [ErrorCode.ENROLLMENT_INCOMPLETE]: {
    action: 'User canceled enrollment or failed to capture required face poses.',
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
