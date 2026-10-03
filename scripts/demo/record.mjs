/* global process, console, localStorage */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { _electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.argv[2] ?? 'work/demo');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-demo-'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
fs.mkdirSync(path.join(output, 'raw-video'), { recursive: true });
const packs = ['Мир с друзьями', 'Своя сборка', 'Vanilla +'];
const records = packs.map((name, index) => {
  const id = `demo-${index}`;
  fs.mkdirSync(path.join(profile, 'minecraft_data/modpacks', id), { recursive: true });
  const runtime = { minecraftVersion: '1.21.1', modLoader: { type: 'vanilla' } };
  return {
    id, name,
    source: { source: 'local', createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z', description: 'Демонстрационная сборка. Игровые файлы не установлены.' },
    config: { runtime, memory: { maxMb: 6144 } }, summary: runtime,
  };
});
fs.writeFileSync(path.join(profile, 'minecraft_data/instance-control-plane.json'), JSON.stringify({ snapshot: { selectedId: records[0].id, records }, _burrowSchemaVersion: 1 }));

let app;
let page;
const errors = [];
const chapters = [];
let demoStart;
const pause = (ms) => page.waitForTimeout(ms);
async function click(locator) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Demo control is not visible');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 18 });
  await pause(180);
  await locator.click();
  await pause(700);
}
async function chapter(name) {
  chapters.push({ name, seconds: (Date.now() - demoStart) / 1000 });
  console.log(name);
}

try {
  app = await _electron.launch({
    executablePath: process.platform === 'win32' ? path.join(root, 'node_modules/electron/dist/electron.exe') : process.platform === 'darwin' ? path.join(root, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron') : path.join(root, 'node_modules/electron/dist/electron'),
    args: [path.join(root, 'dist-electron/main.js')],
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test', BURROW_TEST_USER_DATA: profile, VITE_DEV_SERVER_URL: '' },
    recordVideo: { dir: path.join(output, 'raw-video'), size: { width: 1280, height: 900 } },
    timeout: 45000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(1280, 900); });
  await page.getByTestId('next-nav-play').waitFor();
  await page.evaluate(() => {
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('first_launch', 'false');
    localStorage.setItem('settings_language', 'ru');
    localStorage.setItem('settings_theme', 'dark');
    localStorage.setItem('settings_themePresetId', 'midnight');
  });
  await page.reload();
  await page.getByTestId('play-workspace-launch').waitFor();
  await pause(3000);
  await page.getByTestId('title-bar-brand-icon').evaluate(img => { if (!img.complete || img.naturalWidth === 0) throw new Error('Window icon failed to load'); });
  demoStart = Date.now();
  await chapter('Играть');
  await page.mouse.move(1200, 780);
  await pause(3500);
  await page.locator('.next-play-heading').hover();
  await pause(1800);
  await page.screenshot({ path: path.join(output, 'final-play.png') });

  await chapter('Библиотека');
  await click(page.getByTestId('next-nav-library'));
  await page.getByRole('button', { name: 'Открыть детали: Мир с друзьями', exact: true }).waitFor();
  await pause(3000);
  await page.screenshot({ path: path.join(output, 'final-library.png') });
  await click(page.getByRole('button', { name: 'Открыть детали: Мир с друзьями', exact: true }));
  await page.getByTestId('modpack-details-tablist').waitFor();
  await pause(2500);
  await page.screenshot({ path: path.join(output, 'final-details.png') });
  await click(page.getByRole('tab', { name: 'Настройки', exact: true }));
  await pause(2500);

  await chapter('Вместе');
  await click(page.getByTestId('next-nav-friends'));
  await pause(2500);
  await click(page.locator('.next-friends-guide summary'));
  await pause(3000);
  await page.screenshot({ path: path.join(output, 'final-friends.png') });

  await chapter('Свой Burrow');
  await click(page.getByTestId('next-nav-settings'));
  await pause(2800);
  await page.screenshot({ path: path.join(output, 'final-settings.png') });
  await click(page.getByRole('button', { name: 'Светлая', exact: true }));
  await page.getByRole('combobox', { name: 'Готовые темы', exact: true }).selectOption('forest');
  await pause(2500);
  await click(page.getByTestId('next-nav-play'));
  await pause(2500);
  await page.screenshot({ path: path.join(output, 'final-light.png') });
  await click(page.getByTestId('next-nav-settings'));
  await click(page.getByRole('button', { name: /Т[её]мная/, exact: true }));
  await page.getByRole('combobox', { name: 'Готовые темы', exact: true }).selectOption('midnight');
  await pause(900);
  await click(page.getByTestId('next-nav-play'));
  await pause(3500);
  const demoSeconds = (Date.now() - demoStart) / 1000;
  const video = page.video();
  await app.close();
  app = null;
  const videoPath = await video.path();
  fs.writeFileSync(path.join(output, 'demo-recording.json'), JSON.stringify({
    version, commit,
    type: 'production Electron renderer with real backend and isolated synthetic local instances',
    videoPath, demoSeconds, chapters, errors,
  }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(videoPath);
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'demo-failure.png') }).catch(() => {});
  throw error;
} finally {
  if (app) await app.close();
  // Profile was created by mkdtemp above and contains synthetic records only.
  fs.rmSync(profile, { recursive: true, force: true });
}
