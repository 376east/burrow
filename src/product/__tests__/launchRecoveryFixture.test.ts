// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { installManualVerificationEnvironment, seedManualVerificationStorage } from '../../verification/manual/mockEnvironment';

afterEach(() => { document.getElementById('manual-launch-outcome-note')?.remove(); history.replaceState(null, '', '/'); });
describe('launch recovery manual fixture', () => {
  it('labels the simulated failure, rejects exactly once, then permits the existing fixture retry', async () => {
    history.replaceState(null, '', '/manual-verification.html?view=product-next&launchOutcome=fail-once');
    seedManualVerificationStorage('dashboard');
    localStorage.setItem('settings_language', 'ru');
    installManualVerificationEnvironment();
    expect(document.getElementById('manual-launch-outcome-note')?.textContent).toContain('Minecraft не открывается');
    const launcher = window.api!.launcher!;
    const request = { nickname: 'DemoPlayer', version: '1.20.1', ram: 4 };
    await expect(launcher.launch(request)).rejects.toThrow('Учебный сбой');
    await expect(launcher.launch(request)).resolves.toBeUndefined();
  });
  it('leaves the default current-App fixture unchanged without the explicit knob', async () => {
    history.replaceState(null, '', '/manual-verification.html?view=product-next');
    installManualVerificationEnvironment();
    expect(document.getElementById('manual-launch-outcome-note')).toBeNull();
    await expect(window.api!.launcher!.launch({ nickname: 'DemoPlayer', version: '1.20.1', ram: 4 })).resolves.toBeUndefined();
  });
});
