import { expect, test } from '@playwright/test';

test('the number input sends its full port value to Burrow Link', async ({ page }) => {
  await page.addInitScript(() => {
    let api: Window['api'];
    Object.defineProperty(window, 'api', {
      configurable: true,
      get: () => api,
      set: (value: Window['api']) => {
        api = value;
        const host = api.network.tunnel.host;
        api.network.tunnel.host = async (request) => {
          document.documentElement.dataset.hostPort = String(request.port);
          return host(request);
        };
      },
    });
  });
  await page.goto('/manual-verification.html?view=product-next&lang=en');
  await page.getByTestId('next-nav-friends').click();
  const port = page.getByRole('spinbutton', { name: 'LAN Port' });
  const host = page.getByRole('button', { name: 'Create Room', exact: true });
  await port.fill('0');
  await expect(host).toBeDisabled();
  await port.fill('65536');
  await expect(host).toBeDisabled();
  await port.fill('1e3');
  await expect(host).toBeEnabled();
  await host.click();
  await expect(page.locator('html')).toHaveAttribute('data-host-port', '1000');
});
