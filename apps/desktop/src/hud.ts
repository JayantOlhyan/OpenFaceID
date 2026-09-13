import { BRANDING } from '../../../packages/branding/src/index.ts';
import { DesktopEngine } from './daemon.ts';

export interface HudPayload {
  app: string;
  codename: string;
  // Section 20 Authoritative Display
  presence: 'AUTHORIZED' | 'NOT AUTHORIZED';
  reason: string | null;
  identity: string;
  liveness: 'Passed' | 'Failed' | 'Checking' | 'Required';
  camera: string;
  cameraStatus: 'Active' | 'Paused' | 'Unavailable' | 'Disconnected' | 'Recovering';
  // Legacy / widget compatibility
  status: string;
  recognition: string;
  lastMatch: string;
  privacyPaused: boolean;
  timestamp: number;
}

export class QuickGlanceHud {
  private engine: DesktopEngine;
  private isVisible: boolean = false;

  constructor(engine?: DesktopEngine) {
    this.engine = engine || DesktopEngine.getInstance();
  }

  public toggle(): boolean {
    this.isVisible = !this.isVisible;
    return this.isVisible;
  }

  public getVisibility(): boolean {
    return this.isVisible;
  }

  public async getHudPayload(): Promise<HudPayload> {
    const state = await this.engine.getAuthoritativeState();
    const now = Date.now();
    const isAuthorized = state.presence.isAuthorized;

    let lastMatchStr = 'No match recorded';
    if (state.recognition.lastMatchTimestamp > 0) {
      const secAgo = Math.round((now - state.recognition.lastMatchTimestamp) / 1000);
      lastMatchStr = `${state.recognition.activeIdentityName || 'Authorized User'} (${secAgo}s ago)`;
    }

    let identityDisplay = 'None';
    if (state.presence.authorizedIdentity) {
      identityDisplay = state.presence.authorizedIdentity;
    } else if (state.canonicalState.detection === 'UNKNOWN_FACE') {
      identityDisplay = 'Unknown face';
    } else if (state.canonicalState.detection === 'MULTIPLE_FACES') {
      identityDisplay = 'Multiple faces';
    }

    let livenessDisplay: HudPayload['liveness'] = 'Required';
    if (state.canonicalState.liveness === 'LIVENESS_PASSED') {
      livenessDisplay = 'Passed';
    } else if (state.canonicalState.liveness === 'LIVENESS_FAILED') {
      livenessDisplay = 'Failed';
    } else if (state.canonicalState.liveness === 'LIVENESS_RUNNING') {
      livenessDisplay = 'Checking';
    }

    let cameraDisplayStatus: HudPayload['cameraStatus'] = 'Active';
    if (state.security.privacyPaused) {
      cameraDisplayStatus = 'Paused';
    } else if (state.camera.status === 'DISCONNECTED') {
      cameraDisplayStatus = 'Disconnected';
    } else if (state.camera.status === 'RECOVERING') {
      cameraDisplayStatus = 'Recovering';
    } else if (state.camera.status === 'ERROR') {
      cameraDisplayStatus = 'Unavailable';
    }

    return {
      app: BRANDING.name,
      codename: BRANDING.codeName,
      presence: isAuthorized ? 'AUTHORIZED' : 'NOT AUTHORIZED',
      reason: isAuthorized ? null : (state.presence.unauthorizedReason || 'Looking for you...'),
      identity: identityDisplay,
      liveness: livenessDisplay,
      camera: state.camera.activeDeviceName || 'Default System Sensor',
      cameraStatus: cameraDisplayStatus,
      status: state.tray.status,
      recognition: state.recognition.state,
      lastMatch: lastMatchStr,
      privacyPaused: state.security.privacyPaused,
      timestamp: now,
    };
  }
}
