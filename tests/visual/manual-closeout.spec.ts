import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release } from 'node:os';
import { expect, test as base, type Page } from '@playwright/test';
import { PLAYWRIGHT_CLOSEOUT_VIEWS } from '../../src/verification/manual/views';

// Keep backdrop filters on Skia's baseline CPU path across different CI hosts.
// Chromium147: content/common/skia_utils.cc bypasses runtime opts for this switch.
// Keep the configured executable and other launch settings for this closeout suite.
const test = base.extend({
  launchOptions: [async ({ launchOptions }, use) => {
    await use({ ...launchOptions, args: [...(launchOptions.args ?? []), '--disable-gpu', '--disable-skia-runtime-opts', '--disable-partial-raster'] });
  }, { scope: 'worker' }],
});

// Preserve the original failed comparison and collect bounded raster evidence.
test.afterEach(async ({ browser, page }, testInfo) => {
  if (testInfo.errors.length === 0) return;

  const session = await browser.newBrowserCDPSession();
  try {
    const { gpu } = await session.send('SystemInfo.getInfo');
    const hashes: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const capture = await page.screenshot({ fullPage: true, animations: 'disabled', scale: 'css' });
      hashes.push(createHash('sha256').update(capture).digest('hex'));
      const path = testInfo.outputPath(`raster-repeat-${index + 1}.png`);
      await writeFile(path, capture);
      await testInfo.attach(`raster-repeat-${index + 1}`, { path, contentType: 'image/png' });
    }
    const diagnosticsPath = testInfo.outputPath('raster-diagnostics.json');
    await writeFile(diagnosticsPath, JSON.stringify({
        browser: browser.version(),
        host: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model },
        gpu: { featureStatus: gpu.featureStatus, devices: gpu.devices },
        repeatHashes: hashes,
      }, null, 2));
    await testInfo.attach('raster-diagnostics', { path: diagnosticsPath, contentType: 'application/json' });
  } finally {
    await session.detach();
  }
});

function getViewport(viewport: 'desktop' | 'wide' | undefined) {
  if (viewport === 'wide') {
    return { width: 1600, height: 1360 };
  }

  return { width: 1280, height: 1024 };
}

async function waitForVerificationReady(page: Page, viewId: string) {
  await expect
    .poll(async () => {
      const rawStatus = await page.locator('#verification-status').textContent();

      if (!rawStatus) {
        return 'missing';
      }

      try {
        const status = JSON.parse(rawStatus) as { ready?: boolean; view?: string };
        return status.ready && status.view === viewId ? 'ready' : JSON.stringify(status);
      } catch {
        return 'invalid';
      }
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] })
    .toBe('ready');
}

test.describe('current release-candidate closeout screenshots', () => {
  for (const view of PLAYWRIGHT_CLOSEOUT_VIEWS) {
    test(view.id, async ({ page }) => {
      await page.setViewportSize(getViewport(view.viewport));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/manual-verification.html?view=${view.id}`);
      await waitForVerificationReady(page, view.id);
      await page.addStyleTag({
        content: `
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
            scroll-behavior: auto !important;
          }
        `,
      });
      await page.waitForTimeout(150);
      // Closeout routes model one launcher window, including fixed modal backdrops.
      expect(await page.evaluate(() => document.documentElement.scrollHeight))
        .toBeLessThanOrEqual(getViewport(view.viewport).height);

      // DOM readiness alone does not prove that the screenshot contains the evidence.
      const proofHeadings = view.id === 'phase-24-modpacks-closeout'
        ? ['Alpha Pack']
        : view.id === 'phase-24-degraded-closeout'
          ? ['Unable to search right now', 'Failed to load screenshots.']
          : [];
      for (const name of proofHeadings) {
        const heading = page.getByRole('heading', { name, exact: true });
        await expect(heading).toBeVisible();
        await expect(heading).toBeInViewport({ ratio: 1 });
      }
      for (const closeout of PLAYWRIGHT_CLOSEOUT_VIEWS) {
        await expect(page.getByRole('link', { name: closeout.label, exact: true })).toBeVisible();
      }

      for (const forbidden of view.forbidText ?? []) {
        await expect(page.locator('body')).not.toContainText(forbidden);
      }

      await expect(page).toHaveScreenshot(`${view.id}.png`, {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixels: 0,
        maxDiffPixelRatio: 0,
        scale: 'css',
        threshold: 0,
      });
    });
  }
});
