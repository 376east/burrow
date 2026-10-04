// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { launcherIPC } from '../launcherIPC';

describe('restart IPC concurrency', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('shares a pending request across remounted consumers and releases it after success', async () => {
    let finish!: () => void;
    const killAndRestart = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    vi.stubGlobal('api', { launcher: { killAndRestart } });
    const first = launcherIPC.killAndRestart();
    const second = launcherIPC.killAndRestart();
    expect(second).toBe(first);
    expect(killAndRestart).toHaveBeenCalledTimes(1);
    finish();
    await first;
    const third = launcherIPC.killAndRestart();
    expect(killAndRestart).toHaveBeenCalledTimes(2);
    finish();
    await third;
  });

  it('releases a rejected request so the user can retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const killAndRestart = vi.fn().mockRejectedValueOnce(new Error('Cannot stop')).mockResolvedValueOnce(undefined);
    vi.stubGlobal('api', { launcher: { killAndRestart } });
    await expect(launcherIPC.killAndRestart()).rejects.toThrow('Cannot stop');
    await expect(launcherIPC.killAndRestart()).resolves.toBeUndefined();
    expect(killAndRestart).toHaveBeenCalledTimes(2);
  });
});
