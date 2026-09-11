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
  private currentStatusText: string = '● Protection Active';

  constructor(engine?: DesktopEngine) {
    this.engine = engine || DesktopEngine.getInstance();
  }

  public async getMenuItems(): Promise<TrayMenuItem[]> {
    const state = await this.engine.getAuthoritativeState();
    const isPaused = this.engine.isPrivacyPaused();

    return [
      {
        id: 'header',
        label: `${BRANDING.name} — ${BRANDING.tagline}`,
        enabled: false,
      },
      {
        id: 'status',
        label: state.tray.status,
        enabled: false,
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'open_dashboard',
        label: 'Open Dashboard',
        action: async () => {
          Logger.info('platform', 'Open Dashboard requested from Tray');
        },
      },
      {
        id: 'recognize_now',
        label: 'Recognize Now',
        enabled: !isPaused,
        action: async () => {
          Logger.info('vision', 'Instant recognition triggered from Tray');
        },
      },
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
        id: 'camera_info',
        label: `Camera: ${state.camera.activeDeviceName || 'Default Sensor'}`,
        enabled: false,
      },
      {
        id: 'presence_info',
        label: `Presence: ${state.presence.state}`,
        enabled: false,
      },
      {
        id: 'lock_workstation',
        label: 'Lock Workstation Now',
        action: async () => {
          await this.engine.adapter.lockScreen();
        },
      },
      { id: 'sep3', label: '', separator: true },
      {
        id: 'diagnostics',
        label: 'Diagnostics & Security Status',
        action: async () => {
          Logger.info('security', 'Diagnostics requested from Tray');
        },
      },
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
    return `${state.tray.status} | ${BRANDING.name}`;
  }
}
