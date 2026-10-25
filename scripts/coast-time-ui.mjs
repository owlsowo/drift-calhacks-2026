import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const origin = process.env.DRIFT_WEB_URL || 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error('Use a local preview; this check never submits a story or calls a provider.');
const out = new URL('../test-results/coast-time/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
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

async function open(time, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/Los_Angeles',
    ...options,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const date = new Date(`2026-10-24T${time}-07:00`);
  await page.clock.install({ time: date });
  await page.clock.pauseAt(date);
  await page.goto(origin);
  await expect(page.locator('.sea-surface')).toHaveAttribute('data-renderer', 'coast-art');
  return { context, page };
}

async function period(page, expected) {
  await expect(page.locator('.sea-world')).toHaveAttribute('data-time-of-day', expected);
  await expect(page.locator('.ocean-world')).toHaveAttribute('data-time-of-day', expected);
}

async function background(page, expected) {
  const data = await page.locator('.ocean-photograph').evaluate(async (element) => {
    const source = getComputedStyle(element).backgroundImage.match(
      /url\(["']?([^"')]+)["']?\)/,
    )?.[1];
    if (!source) throw Error('Coast background is missing.');
    const image = new Image();
    image.src = source;
    await image.decode();
    return { source, width: image.naturalWidth, height: image.naturalHeight };
  });
  assert.ok(data.source.endsWith(expected), data.source);
  assert.ok(data.width > 0 && data.height > 0, 'Selected coast asset must decode.');
  assert.equal(
    await page.locator('.fft-headland').count(),
    0,
    'Fallback art has its own lighthouse.',
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

try {
  const noon = await open('12:00:00', { reducedMotion: 'reduce' });
  await period(noon.page, 'day');
  await background(noon.page, 'coast-day-wide.webp');
  await noon.page.screenshot({ path: new URL('day-desktop.png', out).pathname, fullPage: true });
  await noon.page.setViewportSize({ width: 390, height: 844 });
  await background(noon.page, 'coast-day-mobile.webp');
  await noon.page.screenshot({ path: new URL('day-mobile.png', out).pathname, fullPage: true });
  for (const [width, height, asset] of [
    [320, 740, 'coast-day-mobile.webp'],
    [740, 360, 'coast-day-wide.webp'],
  ]) {
    await noon.page.setViewportSize({ width, height });
    await background(noon.page, asset);
  }
  assert.equal(
    await noon.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    true,
  );
  await period(noon.page, 'day');
  await noon.context.close();
  pass(
    'Local noon selects decodable daytime wide/portrait fallback art without a duplicate lighthouse or horizontal overflow.',
  );

  for (const time of ['02:00:00', '23:00:00']) {
    const night = await open(time);
    await period(night.page, 'night');
    await background(night.page, 'coast-night-wide.webp');
    await night.page.setViewportSize({ width: 390, height: 844 });
    await background(night.page, 'coast-night-mobile.webp');
    await night.context.close();
  }
  pass(
    'Early-morning and late-evening visits retain the night coast on desktop and portrait screens.',
  );

  const sunrise = await open('05:59:00');
  await period(sunrise.page, 'night');
  await sunrise.page.clock.fastForward(60_000);
  await period(sunrise.page, 'day');
  await background(sunrise.page, 'coast-day-wide.webp');
  await sunrise.context.close();
  pass('An open page switches from night to day at local 06:00 without reload.');

  const sunset = await open('17:59:00', { reducedMotion: 'reduce' });
  await period(sunset.page, 'day');
  await sunset.page.getByRole('button', { name: 'How to play', exact: true }).click();
  const pause = sunset.page.getByRole('button', { name: 'Pause sea motion', exact: true });
  await pause.click();
  await expect(
    sunset.page.getByRole('button', { name: 'Resume sea motion', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await sunset.page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await sunset.page.clock.fastForward(60_000);
  await period(sunset.page, 'night');
  await background(sunset.page, 'coast-night-wide.webp');
  assert.equal(
    await sunset.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    true,
  );
  await sunset.page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(
    sunset.page.getByRole('button', { name: 'Resume sea motion', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await sunset.page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  pass(
    'Local 18:00 changes the coast without clearing the user’s paused sea-motion choice or reduced-motion preference.',
  );

  await sunset.page.clock.setFixedTime(new Date('2026-10-25T12:00:00-07:00'));
  await sunset.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await period(sunset.page, 'day');
  await sunset.page.clock.setFixedTime(new Date('2026-10-25T23:00:00-07:00'));
  await sunset.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await period(sunset.page, 'night');
  await sunset.context.close();
  pass('Focus and visibility return recheck the local clock after a sleeping tab or a clock jump.');

  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('checks.json', out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scope:
          'Read-only local browser check with America/Los_Angeles timezone, simulated clock and forced unsupported-WebGPU fallback. No story submission, model call, real GPU or physical-device claim.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
