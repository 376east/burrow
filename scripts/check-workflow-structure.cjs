/* global console, process */
const fs = require('node:fs')

function checkWorkflowStructure({ ci, release }) {
  const errors = []
  const allowedActions = new Set([
    'actions/checkout',
    'actions/setup-node',
    'actions/upload-artifact',
    'actions/download-artifact',
  ])
  for (const workflow of [ci, release]) {
    for (const match of workflow.matchAll(/uses:\s*([^\s@]+)@([^\s#]+)/g)) {
      if (!allowedActions.has(match[1])) errors.push(`workflow action ${match[1]} is not in the trusted action allowlist`)
      if (!/^[0-9a-f]{40}$/.test(match[2])) errors.push(`workflow action ${match[1]} must be pinned to an immutable commit SHA`)
    }
  }
  if (!/pull_request\s*:/m.test(ci)) errors.push('CI must run for pull requests')
  if (!/npm run quality:check -- --profile=pr/.test(ci)) errors.push('CI must invoke the shared PR quality contract')
  if (!/^ {2}push:\r?\n {4}tags: \['v\*'\]/m.test(release) || /^ {4}branches\s*:/m.test(release)) errors.push('release workflow push trigger must be limited to version tags')
  if (!/workflow_dispatch\s*:/m.test(release) || !/inputs:\s*[\s\S]*?version\s*:[\s\S]*?commit\s*:/m.test(release)) errors.push('build-only dispatch must accept version and exact commit inputs')
  if (!/ref:\s*\$\{\{\s*github\.sha\s*\}\}/.test(release) || !/test "\$COMMIT" = "\$REQUESTED_COMMIT"/.test(release)) errors.push('release workflow must build the event commit and reject a mismatched dispatch SHA')
  if (!/github\.event\.created && !github\.event\.deleted/.test(release)) errors.push('release workflow must only act on newly pushed tags')
  if (!/group: release-.*github\.ref_name/.test(release) || !/cancel-in-progress: false/.test(release)) errors.push('release runs for the same tag must serialize')
  if (!/git ls-remote origin refs\/heads\/master/.test(release)) errors.push('release workflow must prove the candidate is still the exact origin/master commit')
  if (!/npm run quality:check -- --profile=release/.test(release)) errors.push('release builds must invoke the shared release quality contract')
  if (!/xvfb-run --auto-servernum (?:npm run quality:check -- --profile=release|node scripts\/package-smoke\.js)/.test(release)) errors.push('Linux release artifact verification must provide a virtual display')
  if (!/playwright install(?: --with-deps)? chromium/.test(ci) || !/playwright install(?: --with-deps)? chromium/.test(release)) errors.push('measured quality jobs must install Chromium explicitly')
  if (!/scripts\/prepush-release-report\.js/.test(release) || !/quality\/schemas\/prepush-release-report\.schema\.json/.test(release)) errors.push('release workflow must execute the available pre-push report generator and schema')
  if (!/verify-evidence:/.test(release) || !/needs:\s*(?:\[[^\]]*\bverify-evidence\b[^\]]*\]|verify-evidence)/.test(release) || !/actions\/download-artifact@/.test(release) || !/sha256sum --check SHA256SUMS\.txt/.test(release) || !/(?:scripts\/release-evidence\.js|npm run release:evidence)/.test(release)) errors.push('publish must depend on downloaded checksum and release-evidence verification')
  if (!/environment:\s*release-publication/.test(release)) errors.push('only protected release-publication environment may authorize publish')
  if (/--clobber\b/.test(release)) errors.push('release workflow must not overwrite existing assets')
  if (/--generate-notes\b/.test(release) || !/scripts\/changelog-release-notes\.js/.test(release) || !/--notes-file\s+release-notes\.md/.test(release)) errors.push('release notes must come from the committed changelog and published-release boundary')
  if (!/if \[\[ "\$TAG" == \*-\* \]\]/.test(release)) errors.push('release workflow must derive prerelease/latest behavior from the SemVer tag')
  if (!/--prerelease/.test(release) || !/--latest=false/.test(release)) errors.push('release workflow must publish prereleases as non-latest')
  if (!/^\s*LATEST=--latest\s*$/m.test(release) || !/gh release edit[^\n]*--draft=false "\$LATEST"/.test(release)) errors.push('release workflow must publish stable tags as latest')
  if (!/CSC_IDENTITY_AUTO_DISCOVERY:\s*false/.test(release)) errors.push('release builds must explicitly preserve unsigned credential behavior')
  if (!/VITE_POSTHOG_PROJECT_TOKEN:\s*\$\{\{\s*vars\.POSTHOG_PROJECT_TOKEN\s*\}\}/.test(release) || !/test -n "\$VITE_POSTHOG_PROJECT_TOKEN"/.test(release)) errors.push('release builds must require the configured privacy-reviewed analytics project token')
  if (/npm run (?:smoke:package|release:evidence)[^\n]*>/.test(release)) errors.push('workflow must not redirect npm banners into JSON evidence')
  if (!/scripts\/package-smoke\.js[^\n]*--output/.test(release) || !/scripts\/release-evidence\.js[^\n]*--output/.test(release)) errors.push('workflow must persist smoke and release evidence through explicit output files')
  if (!/RELEASES=.*gh api --paginate/.test(release) || !/PREVIOUS_TAG=.*awk/.test(release)
    || !/if:\s*needs\.verify\.outputs\.previous_tag != ''/.test(release)
    || !/gh release download[^\n]*PREVIOUS_TAG/.test(release)
    || !/if \[ -n "\$PREVIOUS_ARTIFACT" \][\s\S]*--previous-artifact[^\n]*--previous-version/.test(release)) {
    errors.push('native release smoke must require an upgrade only when a previous public release exists')
  }
  if (!/\$\{\{\s*runner\.temp\s*\}\}/.test(release)) errors.push('downloaded and generated evidence must stay outside the checkout')
  if (/pattern:\s*release-\*\s*$/m.test(release)) errors.push('broad release artifact patterns can mix packages with evidence')
  if (!/pattern:\s*release-package-\*/.test(release) || !/name:\s*verified-release-assets/.test(release)) errors.push('publish must consume only the verified release-assets handoff')
  if (!/runner\.temp\s*\}\}\/release-assets\/\$\{\{\s*needs\.verify\.outputs\.version\s*\}\}/.test(release)) errors.push('downloaded packages must retain the version-scoped directory expected by smoke')
  if (!/SHA256SUMS-\$\{\{\s*runner\.os\s*\}\}\.txt/.test(release) || !/sha256sum --check[^\n]*\$?\(?['"]?\$?\(?basename/.test(release)) errors.push('clean verification must check preserved per-platform build manifests')
  if (!/scripts\/aggregate-platform-smoke\.js/.test(release)
    || !/if \[ -n "\$PREVIOUS_TAG" \][^\n]*--require-upgrade/.test(release)) {
    errors.push('release platform smoke aggregation must conditionally require verified package upgrades')
  }
  const publish = release.match(/^ {2}publish:\s*$[\s\S]*/m)?.[0] ?? ''
  const beforePublish = publish ? release.slice(0, release.indexOf(publish)) : release
  if (/git (?:tag|push)\b|gh release delete\b/.test(release)) errors.push('release workflow must preserve tags and existing releases')
  if (!/^permissions:\r?\n {2}contents: read\s*$/m.test(beforePublish) || /contents: write/.test(beforePublish) || !/contents: write/.test(publish)) errors.push('only the publication job may write release contents')
  if (!/if: github\.event_name == 'push' && needs\.verify\.outputs\.already_published == 'false'/.test(publish)) errors.push('only an unpublished tag push may reach publication')
  if (!/gh release create[^\n]*--verify-tag[^\n]*--draft/.test(publish) || !/gh release edit[^\n]*--verify-tag[^\n]*--draft=false/.test(publish)) errors.push('release assets must be staged as a draft on the existing tag before publication')
  if (!/test "\$TAG_OBJECT" = "\$\(git ls-remote origin "refs\/tags\/\$TAG"/.test(publish)) errors.push('publish must verify the live tag still identifies the built candidate')
  if (!/\.name,\.state,\.digest/.test(publish) || !/diff -u[^\n]*expected-release-assets\.tsv[^\n]*uploaded-release-assets\.tsv[\s\S]*gh release edit/.test(publish)) errors.push('published asset names, status, and digests must match verified build outputs')
  const checkoutIndex = publish.indexOf('actions/checkout@')
  const remoteIndex = publish.indexOf('git ls-remote')
  if (checkoutIndex === -1 || remoteIndex === -1 || checkoutIndex > remoteIndex) errors.push('publish must checkout the exact commit before verifying origin')
  return { valid: errors.length === 0, errors }
}

function main() {
  const [ciPath, releasePath] = process.argv.slice(2)
  if (!ciPath || !releasePath) throw new Error('Usage: node scripts/check-workflow-structure.cjs <ci.yml> <release.yml>')
  const result = checkWorkflowStructure({ ci: fs.readFileSync(ciPath, 'utf8'), release: fs.readFileSync(releasePath, 'utf8') })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.valid ? 0 : 1
}

if (require.main === module) {
  try { main() } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}

module.exports = { checkWorkflowStructure }
