import { describe, expect, it, vi } from 'vitest';
import type { TestSummary } from '../types';
import { selectInstalledSmokeTarget } from '../installedGameSmoke';

vi.mock('../../../services/launcher/orchestrator', () => ({ LauncherManager: vi.fn() }));
vi.mock('../../../infrastructure/instances/launchAdapters', () => ({ createLaunchAdapters: vi.fn() }));

describe('installed smoke target', () => {
  it('uses the selected installed loader and never falls back to Vanilla after a Fabric failure', () => {
    const summary: Pick<TestSummary, 'stages'> = {
      stages: {
        vanilla: { total: 1, okCount: 1, failCount: 0, results: [{ mcVersion: '1.20.1', ok: true, ms: 0 }] },
        fabric: { total: 0, okCount: 0, failCount: 0, results: [] },
        forge: { total: 0, okCount: 0, failCount: 0, results: [] },
        neoforge: { total: 0, okCount: 0, failCount: 0, results: [] },
      },
    };
    expect(selectInstalledSmokeTarget(summary, 'vanilla')).toEqual({ version: '1.20.1', modLoader: 'vanilla' });
    expect(selectInstalledSmokeTarget(summary, 'fabric')).toEqual({ version: null, modLoader: 'fabric' });
    const step = { ok: true, ms: 0 };
    const result = {
      mcVersion: '1.20.1', modLoader: 'fabric' as const, modLoaderVersion: '0.19.5', launchVersionId: '1.20.1-fabric0.19.5', ok: false, ms: 0,
      steps: { modLoaderInstall: step, dependenciesInstall: step, versionValidation: step, launchReadiness: step },
    };
    summary.stages.fabric.results.push(result);
    expect(selectInstalledSmokeTarget(summary, 'fabric')).toEqual({ version: null, modLoader: 'fabric' });
    result.ok = true;
    expect(selectInstalledSmokeTarget(summary, 'fabric')).toEqual({ version: '1.20.1', modLoader: 'fabric' });
  });
});
