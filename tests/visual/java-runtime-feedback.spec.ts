import { expect, test } from '@playwright/test';

for (const lang of ['en', 'ru']) {
  test(`Java scan and selection recover visibly in ${lang}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: lang === 'en' ? 1100 : 760, height: 850 });
    await page.addInitScript(() => {
      let api: Window['api'];
      let scanFails = true;
      window.addEventListener('manual-java-scan-recover', () => { scanFails = false; });
      Object.defineProperty(window, 'api', {
        configurable: true,
        get: () => api,
        set: (value: Window['api']) => {
          api = value;
          const scan = api.javaRuntime!.scan;
          const select = api.javaRuntime!.select;
          let selectionFails = true;
          api.javaRuntime!.scan = async () => {
            if (scanFails) throw new Error('Synthetic scan unavailable');
            return scan();
          };
          api.javaRuntime!.select = async (request) => {
            if (selectionFails) { selectionFails = false; throw new Error('Synthetic selection unavailable'); }
            return select(request);
          };
        },
      });
    });
    await page.goto(`/manual-verification.html?view=product-next&lang=${lang}`);
    await page.getByRole('button', { name: lang === 'en' ? 'Advanced settings' : 'Расширенные настройки', exact: true }).click();
    const select = page.getByRole('combobox', { name: /Java/ });
    const scanMessage = lang === 'en' ? 'Could not load Java installations. Rescan to try again.' : 'Не удалось загрузить список Java. Повторите поиск.';
    await expect(select).toBeDisabled();
    await expect(select).toHaveAccessibleDescription(scanMessage);
    await page.getByText(scanMessage, { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText(scanMessage, { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('java-scan-error.png'), fullPage: true });
    await page.evaluate(() => window.dispatchEvent(new Event('manual-java-scan-recover')));
    await page.getByRole('button', { name: lang === 'en' ? 'Rescan' : 'Пересканировать', exact: true }).click();
    await expect(select).toBeEnabled();
    await expect(select).not.toHaveAttribute('aria-invalid', 'true');
    await select.selectOption('manual-java-21');
    await expect(select).toHaveAccessibleDescription(lang === 'en' ? 'Could not confirm the Java selection. Rescan and try again.' : 'Не удалось подтвердить выбор Java. Повторите поиск и попробуйте ещё раз.');
    await expect(select).toHaveValue('');
    await select.selectOption('manual-java-21');
    await expect(select).toHaveValue('manual-java-21');
    await expect(select).not.toHaveAttribute('aria-invalid', 'true');
    expect(errors).toEqual([]);
  });
}
