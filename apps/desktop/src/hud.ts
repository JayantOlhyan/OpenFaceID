import { BRANDING } from '../../../packages/branding/src/index.ts';
import { DesktopEngine } from './daemon.ts';

export interface HudPayload {
  app: string;
  codename: string;
  status: string;
  camera: string;
  recognition: string;
  presence: string;
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
    let lastMatchStr = 'No match recorded';

    if (state.recognition.lastMatchTimestamp > 0) {
      const secAgo = ((now - state.recognition.lastMatchTimestamp) / 1000).toFixed(1);
      lastMatchStr = `${state.recognition.activeIdentityName || 'Authorized User'} (${secAgo}s ago, conf: ${(state.recognition.lastConfidence * 100).toFixed(0)}%)`;
    }

    return {
      app: BRANDING.name,
      codename: BRANDING.codeName,
      status: state.tray.status,
      camera: state.camera.activeDeviceName || 'Default System Sensor',
      recognition: state.recognition.state,
      presence: state.presence.state,
      lastMatch: lastMatchStr,
      privacyPaused: state.security.privacyPaused,
      timestamp: now,
    };
  }
}
