import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.DRIFT_WEB_URL || 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error('Local development preview only.');
const output = new URL('../test-results/world-bottles/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const checks = [];
const errors = [];
for (const engine of ['chrome', 'webkit']) {
  const browser =
    engine === 'chrome'
      ? await chromium.launch({
          channel: 'chrome',
          headless: true,
          args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
        })
      : await webkit.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (engine === 'webkit')
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }),
    );
  page.on('pageerror', (e) => errors.push(`${engine}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${engine}: ${m.text()}`);
  });
  const pass = (text) => {
    checks.push(`${engine}: ${text}`);
    console.log('PASS', engine, text);
  };
  try {
    await page.goto(`${origin}/bottle-preview.html`);
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-renderer', 'webgpu-fft', {
        timeout: 60000,
      });
    else
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-renderer', 'coast-art', {
        timeout: 60000,
      });
    await expect(page.locator('[data-bottle-choice]')).toHaveCount(0);
    assert.equal(await page.locator('.world-bottle-sprite:visible').count(), 0);
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '0');
    pass('The sea starts empty; full Metal WebGPU and CSS fallback both initialize.');
    for (const [width, height] of [
      [1440, 1000],
      [390, 844],
      [320, 568],
      [740, 360],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('button', { name: 'Pick up', exact: true }).click();
      const choices = page.locator('[data-bottle-choice]');
      await expect(choices).toHaveCount(5);
      await expect(choices.first()).toBeEnabled();
      if (engine === 'chrome')
        await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '5');
      else await expect(page.locator('.world-bottle-sprite:visible')).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        const box = await choices.nth(i).boundingBox();
        assert.ok(
          box &&
            box.width >= 48 &&
            box.height >= 48 &&
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= width &&
            box.y + box.height <= height,
          JSON.stringify({ width, height, i, box }),
        );
      }
      await page.screenshot({ path: new URL(`${engine}-${width}x${height}.png`, output).pathname });
      // Every choice is keyboard reachable in a bounded modal loop.
      await choices.first().focus();
      for (let i = 1; i < 5; i++) {
        await page.keyboard.press('Tab');
        await expect(choices.nth(i)).toBeFocused();
      }
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Back to sea', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(choices.first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      if (engine === 'chrome')
        await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '0');
      pass(`Five reachable spotlit choices fit ${width}×${height}; Escape clears them.`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Pick up', exact: true }).click();
      const choice = page.locator('[data-bottle-choice]').nth(i);
      await expect(choice).toBeEnabled();
      await choice.click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByLabel('Opened bottles')).toHaveText(String(i + 1));
    }
    pass('Each of the five choices opens once, with no walking or distance gate.');
    await page.getByRole('button', { name: 'Release bottle', exact: true }).click();
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '1');
    else await expect(page.locator('.world-bottle-sprite:visible')).toHaveCount(1);
    await page.screenshot({ path: new URL(`${engine}-throw.png`, output).pathname });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Pick up', exact: true }).click();
    await expect(page.locator('[data-bottle-choice]').first()).toBeEnabled();
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '5');
    else await expect(page.locator('.world-bottle-sprite:visible')).toHaveCount(5);
    await page.keyboard.press('Escape');
    pass(
      'Accepted release shows the wave-backed throw; the next pickup contains exactly five choices.',
    );
    await page.getByRole('button', { name: 'Pause sea', exact: true }).click();
    await page.getByRole('button', { name: 'Pick up', exact: true }).click();
    await expect(page.locator('[data-bottle-choice]').last()).toBeEnabled();
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '5');
    await page.locator('[data-bottle-choice]').last().click();
    await expect(page.getByLabel('Opened bottles')).toHaveText('6');
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Pick up', exact: true }).click();
    await expect(page.locator('[data-bottle-choice]').last()).toBeEnabled();
    await page.screenshot({ path: new URL(`${engine}-night-reduced.png`, output).pathname });
    await page.locator('[data-bottle-choice]').last().click();
    await expect(page.getByLabel('Opened bottles')).toHaveText('7');
    pass('Paused sea and reduced-motion night remain usable without restarting the scene.');
  } finally {
    await browser.close();
  }
}
assert.deepEqual(errors, []);
await fs.writeFile(
  new URL('checks.json', output),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      scope:
        'Development-only preview: actual headless Metal WebGPU on Chrome and WebKit CSS fallback. No database, paid models, live stories or physical-phone claim.',
      checks,
      errors,
    },
    null,
    2,
  ) + '\n',
);
