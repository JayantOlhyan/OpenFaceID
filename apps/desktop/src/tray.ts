import { BRANDING } from '../../../packages/branding/src/index.ts';
import { Logger } from '../../../packages/core/src/index.ts';
import { getPlatformAdapter } from '../../../packages/platform/src/index.ts';
import { DesktopEngine } from './daemon.ts';
import type { ApplicationState } from './types.ts';

export interface TrayMenuItem {
  id: string;
  label: string;
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  action?: () => Promise<void> | void;
}

export class DesktopTrayManager {
  private engine: DesktopEngine;

  constructor(engine?: DesktopEngine) {
    this.engine = engine || DesktopEngine.getInstance();
  }

  public async getMenuItems(): Promise<TrayMenuItem[]> {
    const state = await this.engine.getAuthoritativeState();
    const isPaused = this.engine.isPrivacyPaused();

    const presenceLabel = state.presence.isAuthorized
      ? 'Active (Authorized)'
      : state.canonicalState.presence === 'PRESENCE_AMBIGUOUS'
      ? 'Ambiguous (Multiple Faces)'
      : state.canonicalState.presence === 'PRESENCE_EXPIRED'
      ? 'Expired'
      : 'Unauthorized';

    const cameraLabel = isPaused
      ? 'Paused (Privacy)'
      : state.camera.status === 'ACTIVE'
      ? 'Active'
      : state.camera.status === 'DISCONNECTED'
      ? 'Disconnected'
      : state.camera.status === 'RECOVERING'
      ? 'Recovering'
      : 'Unavailable';

    return [
      {
        id: 'header',
        label: `Open ${BRANDING.name}`,
        action: async () => {
          Logger.info('platform', 'Open OpenFaceID requested from tray');
        },
      },
      { id: 'status', label: state.tray.status, enabled: false },
      { id: 'presence_status', label: `Presence: ${presenceLabel}`, enabled: false },
      { id: 'camera_status', label: `Camera: ${cameraLabel}`, enabled: false },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'privacy_pause',
        label: isPaused ? 'Resume Recognition' : 'Pause Recognition (Privacy)',
        action: async () => {
          if (isPaused) {
            this.engine.resumePrivacy();
          } else {
            this.engine.pausePrivacy();
          }
        },
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'security_check',
        label: 'Run Security Check',
        action: async () => {
          Logger.info('security', 'Run Security Check triggered from tray');
        },
      },
      {
        id: 'privacy_check',
        label: 'Run Privacy Check',
        action: async () => {
          Logger.info('security', 'Run Privacy Check triggered from tray');
        },
      },
      {
        id: 'open_settings',
        label: 'Open Settings',
        action: async () => {
          Logger.info('platform', 'Open Settings requested from tray');
        },
      },
      {
        id: 'open_diagnostics',
        label: 'Open Diagnostics',
        action: async () => {
          Logger.info('security', 'Open Diagnostics requested from tray');
        },
      },
      { id: 'sep3', label: '', separator: true },
      {
        id: 'quit',
        label: `Quit ${BRANDING.name}`,
        action: async () => {
          await this.engine.shutdown();
          process.exit(0);
        },
      },
    ];
  }

  public async renderTrayText(): Promise<string> {
    const state = await this.engine.getAuthoritativeState();
    return state.tray.status;
  }
}
