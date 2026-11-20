import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type Checker = Readonly<{
  checkWorkflowStructure(options: { ci: string; release: string }): { valid: boolean; errors: string[] };
}>;

const require = createRequire(import.meta.url);
const checker = require('../check-workflow-structure.cjs') as Checker;

const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const release = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');

describe('offline workflow structure enforcement', () => {
  it('accepts the checked-in tag publication and build-only dispatch workflows', () => {
    expect(checker.checkWorkflowStructure({ ci, release })).toEqual({ valid: true, errors: [] });
  });

  it('rejects a missing PR quality contract', () => {
    const changed = ci.replace('npm run quality:check -- --profile=pr', 'npm test');
    expect(checker.checkWorkflowStructure({ ci: changed, release }).valid).toBe(false);
  });

  it.each([
    ['branch push trigger', "tags: ['v*']", "branches: [master]\n    tags: ['v*']"],
    ['tag updates', 'github.event.created && !github.event.deleted', 'github.event.deleted'],
    ['parallel duplicate publication', 'cancel-in-progress: false', 'cancel-in-progress: true'],
    ['manual publication', "if: github.event_name == 'push' && needs.verify.outputs.already_published == 'false'", 'if: always()'],
    ['unprivileged job with write access', 'permissions:\n  contents: read', 'permissions:\n  contents: write'],
    ['missing publication environment', 'environment: release-publication', ''],
    ['missing exact commit checkout', 'ref: ${{ github.sha }}', 'ref: master'],
    ['release artifact smoke without virtual display', /xvfb-run --auto-servernum node scripts\/package-smoke\.js/g, 'node scripts/package-smoke.js'],
    ['asset overwrite', 'gh release create "$TAG"', 'gh release create "$TAG" --clobber'],
    ['missing evidence verifier dependency', 'needs: [verify, verify-evidence]', 'needs: [verify, build]'],
    ['broad release artifact pattern', 'pattern: release-package-*', 'pattern: release-*'],
    ['missing deterministic smoke aggregation', 'node scripts/aggregate-platform-smoke.js', 'node scripts/other.js'],
    ['flattened artifact download path', /\/release-assets\/\$\{\{ needs\.verify\.outputs\.version \}\}/g, '/release-assets'],
    ['tag mutation', 'verify_remote_candidate\n          gh release create', 'git push origin ":refs/tags/$TAG"\n          gh release create'],
    ['generated release notes', '--notes-file release-notes.md', '--generate-notes'],
    ['tag creation during publish', '--verify-tag --title', '--title'],
    ['published assets without remote verification', 'diff -u "$RUNNER_TEMP/expected-release-assets.tsv"', 'cat "$RUNNER_TEMP/expected-release-assets.tsv"'],
    ['mutable action tag', /@[0-9a-f]{40}/, '@v7'],
    ['untrusted pinned action', 'actions/checkout@', 'external/action@'],
  ] as const)('rejects %s', (_name, from, to) => {
    const changed = release.replace(from, to);
    expect(changed).not.toEqual(release);
    expect(checker.checkWorkflowStructure({ ci, release: changed }).valid).toBe(false);
  });
});
