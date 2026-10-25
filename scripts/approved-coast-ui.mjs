import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use npm run test:coast.');
const out = new URL('../docs/evidence/', import.meta.url);
const checks = [],
  errors = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function ready(context) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  // This historical art regression deliberately exercises the approved night scene.
  // Separate coast-time checks cover the viewer-local day/night selection.
  await page.clock.setFixedTime(new Date('2026-10-24T22:00:00'));
  await page.goto(origin);
  await waitForGameConnection(page);
  return page;
}
async function background(page, expected) {
  const data = await page.locator('.ocean-photograph').evaluate(async (el) => {
    const url = getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    const image = new Image();
    image.src = url;
    await image.decode();
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  });
  assert.ok(data.url.endsWith(expected));
  assert.ok(data.width > 0 && data.height > 0);
}
async function capture(page, name) {
  await page.screenshot({
    path: new URL(`approved-coast-${name}.png`, out).pathname,
    fullPage: true,
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  const prompt = await page.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  assert.equal(await page.locator('.daily-tide h2').innerText(), prompt.title);
  const boxes = await page.evaluate(() => {
    const box = (s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    };
    return { tide: box('.daily-tide'), dock: box('.shore-dock'), header: box('.site-header') };
  });
  assert.ok(
    boxes.tide.bottom + 12 < boxes.dock.top && boxes.tide.top > boxes.header.bottom + 8,
    JSON.stringify(boxes),
  );
}
async function pauseSea(page, paused) {
  await button(page, 'How to play').click();
  await button(page, paused ? 'Pause sea motion' : 'Resume sea motion').click();
  await button(page, 'Close dialog').click();
  await page.locator(`.sea-surface[data-motion="${paused ? 'paused' : 'running'}"]`).waitFor();
}
const chrome = await chromium.launch({ channel: 'chrome' });
let safari;
try {
  const context = await chrome.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ready(context);
  await page.locator('.ocean-ready .fft-headland img').waitFor();
  assert.equal(await page.locator('.fft-surface').getAttribute('data-renderer'), 'webgpu-fft');
  assert.equal(
    await page.locator('.fft-headland img').evaluate(async (img) => {
      await img.decode();
      return img.naturalWidth;
    }),
    2172,
  );
  const box = await page.locator('.fft-headland').boundingBox();
  assert.ok(Math.abs(box.y + box.height - 405) < 2);
  await capture(page, 'gpu-desktop');
  pass(
    'Chrome WebGPU renders moving water with the approved transparent lighthouse aligned to its 40% horizon',
  );
  const clip = { x: 20, y: 700, width: 100, height: 70 };
  const first = await page.screenshot({ clip });
  await page.waitForTimeout(300);
  assert.notDeepEqual(first, await page.screenshot({ clip }));
  await pauseSea(page, true);
  const still = await page.screenshot({ clip });
  await page.waitForTimeout(300);
  assert.deepEqual(still, await page.screenshot({ clip }));
  await pauseSea(page, false);
  pass(
    'Actual water pixels move, pause through Help, remain still and resume after the art change',
  );
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('.sea-surface[data-motion="paused"]').waitFor();
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('.sea-surface[data-motion="running"]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'gpu-mobile');
  const mobileBox = await page.locator('.fft-headland').boundingBox();
  assert.ok(Math.abs(mobileBox.y + mobileBox.height - (844 * 0.4 + 5)) < 2);
  pass(
    'Hidden pages pause the simulation, and the approved headland remains aligned in a portrait viewport',
  );
  const fallback = await chrome.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  await fallback.addInitScript(() =>
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }),
  );
  const plain = await ready(fallback);
  await plain.locator('.sea-surface[data-renderer="coast-art"]').waitFor();
  await background(plain, 'coast-night-wide.webp');
  assert.equal(await plain.locator('.fft-headland').count(), 0);
  await capture(plain, 'fallback-desktop');
  await plain.setViewportSize({ width: 390, height: 844 });
  await background(plain, 'coast-night-mobile.webp');
  await capture(plain, 'fallback-mobile');
  for (const [width, height] of [
    [320, 740],
    [740, 360],
  ]) {
    await plain.setViewportSize({ width, height });
    await capture(plain, `daily-${width}x${height}`);
  }
  pass(
    'The shared daily theme and tide caption stay readable above the dock on desktop, portrait, narrow-phone and short-landscape views',
  );
  pass(
    'Unsupported WebGPU loads the approved wide/portrait landscape with one baked-in lighthouse and no duplicate overlay',
  );
  safari = await webkit.launch();
  const safariContext = await safari.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  await safariContext.addInitScript(() =>
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }),
  );
  const ios = await ready(safariContext);
  await ios.locator('.sea-surface[data-renderer="coast-art"]').waitFor();
  await background(ios, 'coast-night-mobile.webp');
  await capture(ios, 'webkit-fallback');
  await button(ios, 'How to play').click();
  const credits = await safariContext.newPage();
  await credits.goto(origin + '/credits.html');
  assert.match(
    await credits.locator('body').innerText(),
    /AI-generated artwork approved by the team/,
  );
  pass(
    'WebKit fallback uses the portrait art, controls pass selected accessibility checks, and credits accurately disclose the approved generated scene',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('approved-coast.json', out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'Isolated local sandbox; no submitted story or model call. Real Chrome WebGPU pixels; forced unsupported-GPU and hidden-page conditions; emulated WebKit phone viewport, not a physical phone.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await chrome.close();
  await safari?.close();
}
