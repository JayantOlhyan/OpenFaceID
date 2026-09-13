import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';
import { DesktopTrayManager } from '../../apps/desktop/src/tray.ts';
import { QuickGlanceHud } from '../../apps/desktop/src/hud.ts';
import { BRANDING } from '../../packages/branding/src/index.ts';

describe('DesktopEngine Lifecycle & Authoritative State', () => {
  it('initializes engine and exposes authoritative single-source-of-truth state', async () => {
    const engine = new DesktopEngine({ leaveTimeoutSec: 15, gracePeriodSec: 3 });
    await engine.initialize();

    const state = await engine.getAuthoritativeState();
    assert.equal(state.version, BRANDING.version);
    assert.equal(state.codename, 'SightLock');
    assert.ok(state.platform.os === 'macos' || state.platform.os === 'windows' || state.platform.os === 'linux');
    assert.equal(state.security.cloudEgress, false);
    assert.equal(state.security.ramOnlyProcessing, true);
    assert.equal(state.security.privacyPaused, false);
    assert.equal(state.presence.leaveTimeoutSec, 20);
    assert.ok(['● Active', '⚠ Camera Unavailable', '⏳ Loading Model'].includes(state.tray.status));

    await engine.shutdown();
  });

  it('activates and deactivates Privacy Pause mode correctly', async () => {
    const engine = new DesktopEngine();
    await engine.initialize();

    assert.equal(engine.isPrivacyPaused(), false);

    // 1. Activate Privacy Pause
    engine.pausePrivacy();
    assert.equal(engine.isPrivacyPaused(), true);

    const pausedState = await engine.getAuthoritativeState();
    assert.equal(pausedState.camera.status, 'PAUSED');
    assert.equal(pausedState.vision.status, 'PAUSED');
    assert.equal(pausedState.tray.status, '○ Paused');
    assert.equal(pausedState.security.privacyPaused, true);
    assert.equal(pausedState.recognition.activeIdentityId, null);

    // 2. Resume Protection
    engine.resumePrivacy();
    assert.equal(engine.isPrivacyPaused(), false);

    const resumedState = await engine.getAuthoritativeState();
    assert.equal(resumedState.camera.status, 'ACTIVE');
    assert.equal(resumedState.vision.status, 'READY');
    assert.equal(resumedState.tray.status, '● Active');

    await engine.shutdown();
  });
});

describe('DesktopTrayManager & QuickGlanceHud', () => {
  it('renders native menu items and reflects real engine state', async () => {
    const engine = new DesktopEngine();
    await engine.initialize();
    const trayMgr = new DesktopTrayManager(engine);

    const items = await trayMgr.getMenuItems();
    assert.ok(items.length >= 8);

    const header = items.find((i) => i.id === 'header');
    assert.ok(header?.label.includes('OpenFaceID'));

    const statusItem = items.find((i) => i.id === 'status');
    assert.ok(statusItem?.label.includes('Active') || statusItem?.label.includes('Camera'));

    const pauseItem = items.find((i) => i.id === 'privacy_pause');
    assert.equal(pauseItem?.label, 'Pause Recognition (Privacy)');

    // Toggle pause and verify tray label updates
    engine.pausePrivacy();
    const pausedItems = await trayMgr.getMenuItems();
    const pausedItem = pausedItems.find((i) => i.id === 'privacy_pause');
    assert.equal(pausedItem?.label, 'Resume Recognition');

    const trayText = await trayMgr.renderTrayText();
    assert.ok(trayText.includes('Paused'));

    await engine.shutdown();
  });

  it('generates accurate HUD payload without fake values', async () => {
    const engine = new DesktopEngine();
    await engine.initialize();
    const hud = new QuickGlanceHud(engine);

    assert.equal(hud.getVisibility(), false);
    hud.toggle();
    assert.equal(hud.getVisibility(), true);

    const payload = await hud.getHudPayload();
    assert.equal(payload.app, 'OpenFaceID');
    assert.equal(payload.codename, 'SightLock');
    assert.ok(payload.camera.length > 0);
    assert.equal(payload.lastMatch, 'No match recorded');
    assert.equal(payload.privacyPaused, false);

    await engine.shutdown();
  });
});
