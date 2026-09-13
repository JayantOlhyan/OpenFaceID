/**
 * OpenFaceID Developer Example: Desktop Automation Actions
 *
 * Purpose:
 *   Demonstrates dispatching safe desktop automation actions (screen lock,
 *   notifications) using ActionDispatcher with strictly enforced argument allowlists.
 *
 * Requirements:
 *   - Node.js >= 22.0.0
 *
 * Run Command:
 *   node --experimental-strip-types examples/automation.ts
 *
 * Expected Output:
 *   Validation of safe action dispatching, rejection of unsafe payloads,
 *   and loopback webhook security defense.
 *
 * Security Considerations:
 *   ActionDispatcher strictly prohibits remote webhook egress or command injection.
 *   Only local loopback and native desktop notifications are permitted.
 */

import { ActionDispatcher } from '../packages/automation/src/index.ts';

async function run() {
  console.log('=== OpenFaceID Example: Automation Actions ===\n');

  // 1. Inspect supported action types
  console.log('1. Available Automation Actions:');
  console.log('   - lock_screen: Native OS workstation lock via PlatformAdapter');
  console.log('   - notify:      Desktop notifications with severity');
  console.log('   - webhook:     Strictly loopback (127.0.0.1/localhost) event dispatch');

  // 2. Dispatch Safe Notification Action
  console.log('\n2. Dispatching Safe Notification Action:');
  const notifyResult = await ActionDispatcher.dispatch('notify', {
    title: 'OpenFaceID Example',
    body: 'Developer automation example executed successfully.',
  });
  console.log(`   Notification Dispatched: ${notifyResult ? 'SUCCESS' : 'FAILED'}`);

  // 3. Security Boundary: Remote Webhook Egress Rejection
  console.log('\n3. Testing Remote Webhook Egress Rejection:');
  const remoteWebhookResult = await ActionDispatcher.dispatch('webhook', {
    webhookUrl: 'http://malicious-external-site.com/leak',
    data: { test: 'payload' },
  });
  console.log(`   Remote Webhook Result:   ${remoteWebhookResult ? 'FAILED (Allowed!)' : 'Security Check: PASS (Blocked)'}`);

  console.log('\n✓ Automation example completed successfully.');
}

run().catch(console.error);
