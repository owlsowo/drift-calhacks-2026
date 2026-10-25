import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const origin = process.env.DRIFT_WEB_URL || 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error('Use the local coast preview; it has no game connection or writing actions.');
const out = new URL('../test-results/coast-time/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
  ...(process.env.DRIFT_CHROMIUM_PATH
    ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
    : { channel: 'chrome' }),
});
const checks = [];
const errors = [];
const pass = (message) => {
  checks.push(message);
  console.log('PASS', message);
};
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

async function settledFrame() {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function headland(source) {
  const image = page.locator('.fft-headland img');
  await expect(image).toHaveAttribute('src', `/assets/${source}`);
  const width = await image.evaluate(async (element) => {
    await element.decode();
    return element.naturalWidth;
  });
  assert.ok(width > 0, 'The selected transparent coast must decode.');
  assert.equal(await page.locator('.fft-headland').count(), 1);
  const bounds = await page.locator('.fft-headland').boundingBox();
  assert.ok(bounds, 'The GPU coast must have a headland.');
  const height = page.viewportSize().height;
  assert.ok(Math.abs(bounds.y + bounds.height - (height * 0.4 + 5)) < 2, JSON.stringify(bounds));
}

try {
  await page.goto(`${origin}/coast-preview.html`);
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-renderer', 'webgpu-fft', {
    timeout: 60_000,
  });
  const canvas = await page.locator('.fft-surface').elementHandle();
  assert.ok(canvas);
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-time-of-day', 'day');
  await headland('coast-headland-day.webp');
  await page.getByRole('button', { name: 'Pause sea', exact: true }).click();
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-motion', 'paused');
  await settledFrame();
  await page.screenshot({ path: new URL('gpu-day-desktop.png', out).pathname, fullPage: true });
  const clip = { x: 30, y: 700, width: 160, height: 90 };
  const dayWater = await page.screenshot({ clip });
  pass(
    'Actual headless Metal WebGPU renders the daylight coast and stops through the preview’s Pause sea control.',
  );

  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-time-of-day', 'night');
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-renderer', 'webgpu-fft');
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-motion', 'paused');
  assert.equal(
    await canvas.evaluate((original) => original === document.querySelector('.fft-surface')),
    true,
  );
  await headland('coast-headland.webp');
  await settledFrame();
  await page.screenshot({ path: new URL('gpu-night-desktop.png', out).pathname, fullPage: true });
  const nightWater = await page.screenshot({ clip });
  assert.notDeepEqual(
    dayWater,
    nightWater,
    'The water’s rendered lighting must change while paused.',
  );
  pass(
    'Night changes the rendered water and headland while the original canvas remains mounted and paused.',
  );

  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-time-of-day', 'day');
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-motion', 'paused');
  assert.equal(
    await canvas.evaluate((original) => original === document.querySelector('.fft-surface')),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await headland('coast-headland-day.webp');
  await settledFrame();
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-renderer', 'webgpu-fft');
  await expect(page.locator('.fft-surface')).toHaveAttribute('data-motion', 'paused');
  await page.screenshot({ path: new URL('gpu-day-mobile.png', out).pathname, fullPage: true });
  pass(
    'Returning to daylight and resizing to 390×844 retains the same paused canvas and aligns the headland to the waterline.',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('gpu-checks.json', out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scope:
          'Actual headless Chromium Metal WebGPU in the development-only coast preview. Day/night lighting and coast asset changes, paused redraw, retained DOM canvas, and emulated portrait viewport. No game connection, story submission, model call, physical-device or performance claim.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} catch (error) {
  const diagnostic = await page
    .evaluate(() => ({
      webgpuAvailable: !!navigator.gpu,
      renderer: document.querySelector('.fft-surface')?.getAttribute('data-renderer'),
      motion: document.querySelector('.fft-surface')?.getAttribute('data-motion'),
    }))
    .catch(() => null);
  await fs.writeFile(
    new URL('gpu-checks.json', out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        passed: false,
        failure: String(error),
        diagnostic,
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  throw error;
} finally {
  await browser.close();
}
