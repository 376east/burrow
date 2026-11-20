# Release runbook

To publish Burrow, push a version tag for the current `master` commit. GitHub Actions checks the source and installers on three platforms, uploads the files to a draft, and verifies asset names and SHA-256 digests before publishing. A stable version becomes Latest. A prerelease stays off Latest.

## Prepare an exact candidate

Current numbering uses plain `MAJOR.MINOR.PATCH`, without `next.N`: [package.json version](../../package.json). New features increment MINOR and fixes increment PATCH; development versions use `0.x.y`. Preview status is shown separately. `0.14.0` follows the published [0.13.0](https://github.com/376east/burrow/releases/tag/v0.13.0). Local installers from the former `1.0.0-next.*` branch have a higher SemVer number and require a manual transition; automatic downgrades are not enabled.

Start on a clean branch. Commit the candidate version and its matching `CHANGELOG.md` section before generating the release report.

```bash
nvm use
npm ci
npm version <version> --no-git-tag-version --ignore-scripts
git add package.json package-lock.json CHANGELOG.md
git commit -m "prepare release candidate"
```

Confirm that `package.json` and `package-lock.json` contain the same version, the worktree is clean, and `v<version>` does not already exist. Then build local readiness evidence:

```bash
npm run build -- --publish never --mac --win --linux
npm run release -- <version> --dry-run
```

The first command prepares the three expected artifacts under `release/<version>` without publishing them. If cross-building is unavailable, build on native platform runners and collect the exact DMG, NSIS installer, and AppImage in that directory before the dry run; a missing or unhashed package is a hard failure, never `unsupported-runner` evidence. The dry run then uses the Node 24 shared release profile, runs available package smoke, writes checksums and release evidence, creates a schema-valid pre-push report, and validates that report against the exact version, tag, current commit, and prepared artifacts. It creates no commit, tag, push, remote operation, or GitHub Release. The report is normally written to `quality/evidence/prepush-release-report.json`; this ignored local file must be regenerated after any candidate commit or artifact changes.

## Review the evidence

Upgrade verification must load the previous package with representative settings, statistics, and a selected nonempty instance, then verify that the new package preserves them. An unrelated marker file is insufficient. Run Windows installer checks in a disposable VM or clean runner: NSIS changes installation registration and shortcuts, so a temporary directory alone does not isolate the user's working installation.

Review the pre-push report before asking for any release action. It names the exact version/proposed tag/commit, every quality stage, artifact paths and SHA-256 checksums, platform smoke with unsupported-runner reasons, signing/notarization status, known failures, and the immutable rollback action.

Checksums establish artifact integrity only. The local report is decision evidence, not a security boundary, publisher-authentication proof, or publication authorization. Current macOS DMGs and Windows artifacts are not publisher-signed unless platform verification evidence says otherwise. A local ad-hoc macOS app signature proves neither publisher identity nor notarization; never infer either from a checksum or successful launch. Gatekeeper and SmartScreen prompts are OS/reputation behavior that must be checked manually on the target platform and recorded separately.

## Verify and publish a candidate

Use manual dispatch to verify a pushed candidate branch. The workflow checks the supplied SHA and stores installers, checksums, and reports as GitHub Actions artifacts.

```bash
gh workflow run release.yml --ref <candidate-branch> -f version=<version> -f commit=<candidate-sha>
```

After merging into `master`, push a single new tag on the current commit of that branch.

```bash
git fetch origin master
git tag -a v<version> origin/master -m "Release v<version>"
git push origin refs/tags/v<version>
```

The `release-publication` environment must allow version tags. Publication waits for approval when the environment has required reviewers.

Official release builds also require these GitHub repository variables:

- `POSTHOG_PROJECT_TOKEN` — the public project token from the PostHog EU project;
- `POSTHOG_HOST` — optional; leave empty to use `https://eu.i.posthog.com`.

Before every public release, open PostHog **Settings → Project → General** and confirm that IP capture remains disabled, person profiles remain unused, and retention does not exceed 12 months. The workflow refuses to package without the project token, but hosted privacy settings require a manual owner check.

Each platform tests an upgrade from the previous public stable release when one exists. Release notes come from the matching `CHANGELOG.md` section. A rerun skips an already published release. An upload or asset verification failure leaves the tag and draft in place. Review an incomplete draft before retrying. The workflow rejects an existing draft and preserves its assets.

## Failure and rollback

- Prerelease tags stay non-latest; stable tags become latest only through the same protected publication job.
- If evidence, smoke, or OS trust behavior fails, withdraw or mark the release non-latest where the host permits, investigate, and publish a new patch when ready.
- Never move or overwrite an existing stable tag or asset. Do not replace bytes under an existing version.
- Regenerate the report whenever the candidate commit or artifact set changes; an old report is intentionally rejected as stale.
