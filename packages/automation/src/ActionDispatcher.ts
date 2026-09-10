import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { getPlatformAdapter } from '../../platform/src/index.ts';
import { Logger } from '../../core/src/index.ts';

const execAsync = promisify(exec);

export type ActionType = 'lock_screen' | 'notify' | 'webhook' | 'shell_command';

export interface ActionPayload {
  title?: string;
  body?: string;
  webhookUrl?: string;
  command?: string;
}

export class ActionDispatcher {
  public static async dispatch(action: ActionType, payload: ActionPayload = {}): Promise<boolean> {
    const adapter = getPlatformAdapter();
    Logger.info('automation', `Executing action: ${action}`);

    switch (action) {
      case 'lock_screen': {
        return await adapter.lockScreen();
      }

      case 'notify': {
        const title = payload.title || 'OpenFaceID Alert';
        const body = payload.body || 'Event triggered';
        await adapter.showNotification(title, body);
        return true;
      }

      case 'webhook': {
        if (!payload.webhookUrl) {
          Logger.warn('automation', 'Webhook URL not configured');
          return false;
        }
        return await this.sendWebhook(payload.webhookUrl, payload);
      }

      case 'shell_command': {
        if (!payload.command) {
          Logger.warn('automation', 'No shell command provided');
          return false;
        }
        try {
          Logger.info('automation', `Executing shell command: ${payload.command}`);
          await execAsync(payload.command);
          return true;
        } catch (err) {
          Logger.error('automation', 'Shell command failed', { error: String(err) });
          return false;
        }
      }

      default:
        Logger.warn('automation', `Unknown action: ${action}`);
        return false;
    }
  }

  private static async sendWebhook(urlStr: string, data: Record<string, unknown>): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(urlStr);
        const transport = parsed.protocol === 'https:' ? https : http;
        const postData = JSON.stringify({ event: 'sightlock_event', timestamp: Date.now(), data });

        const req = transport.request(
          parsed,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 3000,
          },
          (res) => {
            resolve(res.statusCode !== undefined && res.statusCode < 400);
          }
        );

        req.on('error', (err) => {
          Logger.warn('automation', 'Webhook request failed', { error: String(err) });
          resolve(false);
        });

        req.write(postData);
        req.end();
      } catch (err) {
        Logger.error('automation', 'Invalid webhook configuration', { error: String(err) });
        resolve(false);
      }
    });
  }
}
