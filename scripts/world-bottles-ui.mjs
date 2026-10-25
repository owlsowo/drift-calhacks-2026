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
const exitChecks = [];
for (const engine of ['chrome', 'webkit']) {
  const browser =
    engine === 'chrome'
      ? await chromium.launch({
          ...(process.env.DRIFT_CHROMIUM_PATH
            ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
            : { channel: 'chrome' }),
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
  const chooseCount = (count) =>
    page.evaluate((n) => {
      Math.random = () => (n - 3 + 0.5) / 3;
    }, count);
  async function checkExit(action) {
    const result = await page.evaluate(async (action) => {
      const initial = document.querySelector('.bottle-ritual');
      const initialStep = initial?.getAttribute('data-pickup-step');
      const choices = [...document.querySelectorAll('[data-bottle-choice]')];
      if (action === 'cancel') document.querySelector('.bottle-ritual__cancel').click();
      if (action === 'open') (choices[0] ?? document.querySelector('.bottle-ritual__open')).click();
      if (action === 'open-last') choices.at(-1).click();
      const samples = [];
      const started = performance.now();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('The exit never completed.')), 3000);
        const sample = () => {
          const dialog = initial?.isConnected ? initial : null;
          if (!dialog) {
            clearTimeout(timeout);
            resolve({ samples, elapsed: performance.now() - started, step: initialStep });
            return;
          }
          if (dialog.classList.contains('bottle-ritual--leaving')) {
            const sprite = document.querySelector('.world-bottle-sprite:not([hidden])');
            samples.push({
              opacity: Number(getComputedStyle(dialog).opacity),
              glass: sprite ? Number(sprite.style.opacity) : null,
            });
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
    }, action);
    assert.ok(
      result.samples.some((s) => s.opacity > 0.01 && s.opacity < 0.95),
      `${engine}/${action}: the dialog must visibly fade before it unmounts.`,
    );
    if (engine === 'webkit' && result.step === 'choose')
      assert.ok(
        result.samples.some((s) => s.glass > 0 && s.glass < 0.95),
        'The fallback bottle fades with the overlay instead of popping away.',
      );
    exitChecks.push({ engine, action, elapsed: result.elapsed, samples: result.samples.length });
  }
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
      for (const count of [3, 4, 5]) {
        await page.setViewportSize({ width, height });
        await chooseCount(count);
        await page.getByRole('button', { name: 'Pick up', exact: true }).click();
        const choices = page.locator('[data-bottle-choice]');
        await expect(choices).toHaveCount(count);
        await expect(choices.first()).toBeEnabled();
        if (engine === 'chrome')
          await expect(page.locator('.fft-surface')).toHaveAttribute(
            'data-bottle-count',
            String(count),
          );
        else await expect(page.locator('.world-bottle-sprite:visible')).toHaveCount(count);
        await expect(page.locator('.bottle-ritual [role="status"]')).toContainText(
          `${count} bottles are ready`,
        );
        const openings = page.locator('.bottle-ritual__world-shade ellipse');
        await expect(openings).toHaveCount(count);
        for (let i = 0; i < count; i++) {
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
          const light = await openings.nth(i).evaluate((node) => ({
            width: node.rx.baseVal.value * 2,
            height: node.ry.baseVal.value * 2,
          }));
          assert.ok(
            light.width > box.width * 2.2 && light.height > box.height * 1.5,
            'Each soft opening includes a generous patch of water around the bottle.',
          );
        }
        await page.screenshot({
          path: new URL(`${engine}-${width}x${height}-${count}.png`, output).pathname,
        });
        // Every choice is keyboard reachable in a bounded modal loop.
        await choices.first().focus();
        for (let i = 1; i < count; i++) {
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
        pass(
          `${count} reachable choices with large soft spotlights fit ${width}×${height}; Escape clears them.`,
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Pause sea', exact: true }).click();
    const unshaded = await page.screenshot();
    await chooseCount(5);
    await page.getByRole('button', { name: 'Pick up', exact: true }).click();
    await expect(page.locator('[data-bottle-choice]').first()).toBeEnabled();
    const litPoint = await page
      .locator('.bottle-ritual__world-shade ellipse')
      .first()
      .evaluate((node) => ({
        x: Math.round(node.cx.baseVal.value + node.rx.baseVal.value * 0.3),
        y: Math.round(node.cy.baseVal.value + node.ry.baseVal.value * 0.5),
      }));
    const shaded = await page.screenshot({
      path: new URL(`${engine}-spotlight-contrast.png`, output).pathname,
    });
    const contrast = await page.evaluate(
      async ({ before, after, inside }) => {
        const sample = async (raw) => {
          const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          const light = ({ x, y }) => {
            const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
            return r * 0.2126 + g * 0.7152 + b * 0.0722;
          };
          return { inside: light(inside), outside: light({ x: 16, y: 790 }) };
        };
        return { before: await sample(before), after: await sample(after) };
      },
      { before: unshaded.toString('base64'), after: shaded.toString('base64'), inside: litPoint },
    );
    assert.ok(contrast.after.outside < contrast.before.outside * 0.42, JSON.stringify(contrast));
    assert.ok(contrast.after.inside > contrast.before.inside * 0.68, JSON.stringify(contrast));
    await checkExit('cancel');
    await page.getByRole('button', { name: 'Resume sea', exact: true }).click();
    pass('Actual pixels darken the sea outside the spotlights while keeping the lit water clear.');
    for (let i = 0; i < 5; i++) {
      await chooseCount(5);
      await page.getByRole('button', { name: 'Pick up', exact: true }).click();
      const choice = page.locator('[data-bottle-choice]').nth(i);
      await expect(choice).toBeEnabled();
      if (i === 0) await checkExit('open');
      else await choice.click();
      await expect(page.locator('.bottle-ritual[data-pickup-step="open"]')).toHaveClass(
        /bottle-ritual--arrived/,
      );
      await expect(page.getByLabel('Opened bottles')).toHaveText(String(i));
      await page.getByRole('button', { name: 'Open bottle', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByLabel('Opened bottles')).toHaveText(String(i + 1));
    }
    pass('Each choice leads to the separate shake/open stage before the bottle opens once.');
    await page.getByRole('button', { name: 'Release bottle', exact: true }).click();
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '1');
    else await expect(page.locator('.world-bottle-sprite:visible')).toHaveCount(1);
    await page.screenshot({ path: new URL(`${engine}-throw.png`, output).pathname });
    await checkExit('release');
    await chooseCount(3);
    await page.getByRole('button', { name: 'Pick up', exact: true }).click();
    await expect(page.locator('[data-bottle-choice]').first()).toBeEnabled();
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '3');
    else await expect(page.locator('.world-bottle-sprite:visible')).toHaveCount(3);
    await page.keyboard.press('Escape');
    pass(
      'Accepted release shows the wave-backed throw; the next pickup clears it and draws a fresh count.',
    );
    await page.getByRole('button', { name: 'Pause sea', exact: true }).click();
    await chooseCount(4);
    await page.getByRole('button', { name: 'Pick up', exact: true }).click();
    await expect(page.locator('[data-bottle-choice]').last()).toBeEnabled();
    if (engine === 'chrome')
      await expect(page.locator('.fft-surface')).toHaveAttribute('data-bottle-count', '4');
    await page.locator('[data-bottle-choice]').last().click();
    await expect(page.locator('.bottle-ritual[data-pickup-step="open"]')).toHaveClass(
      /bottle-ritual--arrived/,
    );
    await page.getByRole('button', { name: 'Open bottle', exact: true }).click();
    await expect(page.getByLabel('Opened bottles')).toHaveText('6');
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await chooseCount(3);
    await page.getByRole('button', { name: 'Pick up', exact: true }).click();
    await expect(page.locator('[data-bottle-choice]').last()).toBeEnabled();
    await page.screenshot({ path: new URL(`${engine}-night-reduced.png`, output).pathname });
    await checkExit('open-last');
    await expect(page.locator('.bottle-ritual[data-pickup-step="open"]')).toHaveClass(
      /bottle-ritual--arrived/,
    );
    await checkExit('open');
    await expect(page.getByLabel('Opened bottles')).toHaveText('7');
    pass('Paused sea and reduced-motion night remain usable without restarting the scene.');
    pass(
      'Opening, Back to sea and release retain the dialog until a real exit fade completes, including reduced motion.',
    );
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
      exitChecks,
    },
    null,
    2,
  ) + '\n',
);
