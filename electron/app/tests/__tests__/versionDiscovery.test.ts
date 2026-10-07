import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverVersions } from '../versionDiscovery';

describe('full-test version discovery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preserves the newest-first Mojang manifest order for bounded runs', async () => {
    const getVersionList = vi.fn().mockResolvedValue({
      versions: [
        { id: '1.21.8', type: 'release' },
        { id: '1.20.1', type: 'release' },
        { id: '26w31a', type: 'snapshot' },
        { id: '1.0', type: 'release' },
      ],
    });

    const discovered = await discoverVersions({
      versionLists: { getVersionList } as never,
      providerId: 'mojang',
      enabledStages: new Set(['vanilla']),
      onLog: vi.fn(),
    });

    expect(discovered.allReleaseVersions).toEqual(['1.21.8', '1.20.1', '1.0']);
  });

  it('reuses the selected provider manifest for Fabric instead of requesting the default provider', async () => {
    const getVersionList = vi.fn().mockResolvedValueOnce({ versions: [
      { id: '1.21.8', type: 'release' },
      { id: '26w31a', type: 'snapshot' },
      { id: '1.20.1', type: 'release' },
    ] }).mockRejectedValue(new Error('Unexpected second manifest request'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
      { version: '1.20.1' }, { version: '26w31a' }, { version: '1.21.8' },
    ] }));
    const result = await discoverVersions({
      versionLists: { getVersionList } as never,
      providerId: 'mojang',
      enabledStages: new Set(['vanilla', 'fabric']),
      onLog: vi.fn(),
    });
    expect(result.fabricVersions).toEqual(['1.21.8', '1.20.1']);
    expect(getVersionList).toHaveBeenCalledExactlyOnceWith('mojang');
  });
});
