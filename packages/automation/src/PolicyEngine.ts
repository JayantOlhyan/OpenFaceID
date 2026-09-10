import { EventBus, type AutomationConfig, Logger } from '../../core/src/index.ts';
import { ActionDispatcher } from './ActionDispatcher.ts';

export class PolicyEngine {
  private config: AutomationConfig;
  private unsubscribeList: Array<() => void> = [];

  constructor(config: AutomationConfig) {
    this.config = config;
    this.attachEventListeners();
  }

  public updateConfig(newConfig: AutomationConfig): void {
    this.config = newConfig;
  }

  private attachEventListeners(): void {
    const bus = EventBus.getInstance();

    // 1. Policy: USER_LEFT -> Lock screen & optional webhook
    const unLeave = bus.subscribe('USER_LEFT', async (event) => {
      Logger.info('automation', 'Policy triggered by USER_LEFT event');
      if (this.config.lockOnLeave) {
        await ActionDispatcher.dispatch('lock_screen');
      }

      if (this.config.customWebhookUrl) {
        await ActionDispatcher.dispatch('webhook', {
          webhookUrl: this.config.customWebhookUrl,
          body: JSON.stringify(event.payload),
        });
      }
    });
    this.unsubscribeList.push(unLeave);

    // 2. Policy: IDENTITY_MATCHED -> Desktop notification
    const unMatch = bus.subscribe('IDENTITY_MATCHED', async (event) => {
      if (this.config.notifyOnMatch) {
        const name = event.payload.identityName || 'User';
        await ActionDispatcher.dispatch('notify', {
          title: 'OpenFaceID Welcome',
          body: `Identity verified: ${name}`,
        });
      }
    });
    this.unsubscribeList.push(unMatch);
  }

  public destroy(): void {
    for (const un of this.unsubscribeList) {
      un();
    }
    this.unsubscribeList = [];
  }
}
