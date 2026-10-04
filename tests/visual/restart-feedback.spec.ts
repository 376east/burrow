import { expect, test } from '@playwright/test';

test('a running library instance can be force restarted without switching launch modes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 760, height: 850 });
  await page.addInitScript(() => {
    let api: Window['api'];
    Object.defineProperty(window, 'api', {
      configurable: true,
      get: () => api,
      set: (value: Window['api']) => {
        api = value;
        localStorage.setItem('settings_uiMode', 'modpacks');
        api.launcher.getSessionState = async () => ({ revision: 1, phase: 'running' });
      },
    });
  });
  await page.goto('/manual-verification.html?view=product-next&lang=ru');
  await expect(page.getByTestId('library-launch-dock')).toBeVisible();
  await expect(page.getByTestId('next-nav-play')).toBeDisabled();
  const restart = page.getByTestId('restart-game-button');
  await expect(restart).toBeVisible();
  await page.getByTestId('next-nav-settings').click();
  await expect(restart).toBeVisible();
  await page.getByTestId('next-nav-library').click();
  expect(await page.locator('.next-window').evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('library-restart.png'), fullPage: true });
  await restart.click();
  await expect(restart).toHaveCount(0);
  await expect(page.getByTestId('library-launch-dock').getByRole('button')).toBeEnabled();
});

for (const width of [1100, 760]) {
  for (const lang of ['en', 'ru']) {
    test(`restart failure and retry at ${width}px in ${lang}`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 850 });
      // Synthetic running session and IPC failure, using the real renderer.
      await page.addInitScript(() => {
        let api: Window['api'];
        Object.defineProperty(window, 'api', {
          configurable: true,
          get: () => api,
          set: (value: Window['api']) => {
            api = value;
            const reset = api.launcher.killAndRestart;
            let attempts = 0;
            api.launcher.getSessionState = async () => ({ revision: 1, phase: 'running' });
            api.launcher.killAndRestart = async () => {
              attempts += 1;
              document.documentElement.dataset.restartAttempts = String(attempts);
              await new Promise<void>((resolve) => window.addEventListener('manual-restart-complete', () => resolve(), { once: true }));
              if (attempts === 1) throw new Error('Process did not stop');
              await reset();
            };
          },
        });
      });
      await page.goto(`/manual-verification.html?view=product-next&lang=${lang}`);
      const restartName = lang === 'en' ? 'Force restart' : 'Перезапустить принудительно';
      const button = page.getByTestId('restart-game-button');
      await expect(button).toHaveAccessibleName(restartName);
      await button.click();
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('aria-busy', 'true');
      await page.getByTestId('next-nav-settings').click();
      await page.getByTestId('next-nav-play').click();
      await button.click();
      await expect(button).toBeDisabled();
      await expect(page.locator('html')).toHaveAttribute('data-restart-attempts', '1');
      await page.evaluate(() => window.dispatchEvent(new Event('manual-restart-complete')));
      await expect(page.getByRole('alert')).toContainText('Process did not stop');
      await expect(button).toBeEnabled();
      const overflow = await page.locator('.next-window').evaluate((node) => node.scrollWidth > node.clientWidth + 1);
      expect(overflow).toBe(false);
      await page.screenshot({ path: testInfo.outputPath('restart-error.png'), fullPage: true });
      await button.click();
      await expect(button).toBeDisabled();
      await page.evaluate(() => window.dispatchEvent(new Event('manual-restart-complete')));
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(button).toHaveCount(0);
      await expect(page.getByTestId('play-workspace-launch')).toBeEnabled();
      expect(errors).toEqual([]);
    });
  }
}
