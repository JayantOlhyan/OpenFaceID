import http from 'http';
import { getPlatformAdapter } from '../../platform/src/index.ts';
import { Logger, NotificationManager } from '../../core/src/index.ts';

export type ActionType = 'lock_screen' | 'notify' | 'webhook';

export interface ActionPayload {
  title?: string;
  body?: string;
  webhookUrl?: string;
  data?: Record<string, unknown>;
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
        const notifMgr = NotificationManager.getInstance();
        const safeTitle = (payload.title && payload.title.trim()) ? payload.title.trim().slice(0, 100) : 'OpenFaceID';
        const safeBody = (payload.body && payload.body.trim()) ? payload.body.trim().slice(0, 300) : 'System notification';
        await notifMgr.notify({
          id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          category: 'system',
          severity: 'info',
          title: safeTitle,
          body: safeBody,
          timestamp: Date.now(),
        });
        return true;
      }

      case 'webhook': {
        if (!payload.webhookUrl) {
          Logger.warn('automation', 'Webhook URL not configured');
          return false;
        }
        return await this.sendWebhook(payload.webhookUrl, payload.data || {});
      }

      default:
        Logger.warn('automation', `Unknown or unsupported action: ${action}`);
        return false;
    }
  }

  /**
   * Dispatches event payload strictly to local loopback endpoints (127.0.0.1/localhost).
   * External remote egress is strictly prohibited by OpenFaceID security policy.
   */
  private static async sendWebhook(urlStr: string, data: Record<string, unknown>): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(urlStr);

        // Enforce strict local loopback binding to preserve Zero Remote Egress guarantee
        const host = parsed.hostname.toLowerCase();
        const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';

        if (!isLoopback) {
          Logger.error('automation', `SECURITY POLICY VIOLATION: Outbound webhook to remote host "${host}" blocked. OpenFaceID permits loopback destinations only.`);
          resolve(false);
          return;
        }

        // Scrub any sensitive keys from payload before transmission
        const safeData: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(data)) {
          if (!/embedding|vector|frame|token|key|password|secret/i.test(k)) {
            safeData[k] = v;
          }
        }

        const postData = JSON.stringify({
          event: 'openfaceid_event',
          timestamp: Date.now(),
          data: safeData,
        });

        const req = http.request(
          parsed,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'User-Agent': 'OpenFaceID-Local-Automation/0.2.0',
            },
            timeout: 3000,
          },
          (res) => {
            resolve(res.statusCode !== undefined && res.statusCode < 400);
          }
        );

        req.on('error', (err) => {
          Logger.warn('automation', 'Loopback webhook request failed', { error: String(err) });
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
