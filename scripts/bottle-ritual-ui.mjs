import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use npm run test:ritual.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const checks = [],
  errors = [];
const out = new URL('../docs/evidence/', import.meta.url);
const button = (page, name) => page.getByRole('button', { name, exact: true });
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
async function ready(context) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin);
  await page.waitForFunction(async () => (await import('/src/game.ts')).game.snapshot().connected);
  return page;
}
async function pickup(page) {
  await button(page, 'Pick up a bottle. Write an ending').click();
  await page.locator('.bottle-ritual--arrived').waitFor();
}
async function drag(page, offsets) {
  const box = await button(page, 'Open bottle').boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const offset of offsets) {
    await page.waitForTimeout(95);
    await page.mouse.move(x + offset, y);
  }
  await page.mouse.up();
}
async function motion(page, values) {
  for (const value of values) {
    await page.evaluate((value) => {
      const event = new Event('devicemotion');
      Object.defineProperty(event, 'acceleration', {
        value: typeof value === 'number' ? { x: value, y: 0, z: 0 } : value,
      });
      window.dispatchEvent(event);
    }, value);
    await page.waitForTimeout(95);
  }
}
async function hidden(page, value) {
  await page.evaluate((value) => {
    if (value)
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    else delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}
async function scan(page, name) {
  await page.screenshot({
    path: new URL(`bottle-ritual-${engine.toLowerCase()}-${name}.png`, out).pathname,
    fullPage: true,
  });
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ready(desktop);
  await pickup(page);
  assert.equal(await button(page, 'Enable phone shake').count(), 0);
  await drag(page, [25, 50, 75, 100]);
  assert.equal(await page.locator('.bottle-ritual--arrived').count(), 1);
  await drag(page, [30, -30, 30]);
  assert.equal(await page.locator('.bottle-ritual--arrived').count(), 1);
  await scan(page, 'desktop');
  pass('One-way travel and incomplete drags do not open a bottle or synthesize a tap');
  await page.setViewportSize({ width: 740, height: 360 });
  await scan(page, 'landscape');
  const boxes = await page.evaluate(() =>
    ['.bottle-ritual__open-label', '.bottle-ritual__gesture'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }),
  );
  assert.ok(boxes[0].bottom <= boxes[1].top && boxes[1].bottom <= 360, JSON.stringify(boxes));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await drag(page, [60, -60, 60, -60, 60]);
  await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
  assert.equal(await page.locator('.ocean-world').isVisible(), true);
  pass(
    'Four deliberate pointer reversals open the real received note over the sea; desktop and short landscape controls remain readable',
  );

  await button(page, 'Drift home').click();
  await pickup(page);
  await page.keyboard.press('Escape');
  await page.locator('.shore-home').waitFor();
  await pickup(page);
  assert.equal(
    await button(page, 'Open bottle').evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await button(page, 'Back to sea').evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await button(page, 'Open bottle').evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
  pass(
    'Escape returns to sea, keyboard focus stays in the ritual, and Enter opens without shaking',
  );

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  await phone.addInitScript(() => {
    window.testMotionResult = 'denied';
    window.testMotionRequests = 0;
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: class extends Event {
        static async requestPermission() {
          window.testMotionRequests++;
          if (window.testMotionResult === 'error') throw Error('Synthetic motion error');
          return window.testMotionResult;
        }
      },
    });
  });
  const mobile = await ready(phone);
  await pickup(mobile);
  assert.equal(await mobile.evaluate(() => window.testMotionRequests), 0);
  await motion(mobile, [12, -12, 12, -12, 12]);
  assert.equal(await mobile.locator('.bottle-ritual--arrived').count(), 1);
  await button(mobile, 'Enable phone shake').click();
  await mobile
    .getByText('Motion wasn’t enabled. Drag or tap the bottle to open it.', { exact: true })
    .waitFor();
  await mobile.evaluate(() => (window.testMotionResult = 'error'));
  await button(mobile, 'Enable phone shake').click();
  await mobile
    .getByText('Motion isn’t available here. Drag or tap the bottle.', { exact: true })
    .waitFor();
  assert.equal(await button(mobile, 'Open bottle').isEnabled(), true);
  await scan(mobile, 'phone-denied');
  pass(
    'Motion permission is requested only by its explicit control; denial and API failure leave the bottle operable',
  );
  await mobile.evaluate(() => (window.testMotionResult = 'granted'));
  await button(mobile, 'Enable phone shake').click();
  await mobile.getByText('Shake your phone gently, or tap the bottle.', { exact: true }).waitFor();
  assert.equal(
    await button(mobile, 'Open bottle').evaluate((e) => e === document.activeElement),
    true,
  );
  await motion(mobile, [3, -3, 3, -3, 3]);
  await motion(mobile, [
    12,
    { x: 0, y: -14, z: 0 },
    { x: 0, y: 14, z: 0 },
    { x: 0, y: -14, z: 0 },
    { x: 0, y: 14, z: 0 },
  ]);
  assert.equal(await mobile.locator('.bottle-ritual--arrived').count(), 1);
  await hidden(mobile, true);
  await motion(mobile, [12, -12, 12, -12, 12]);
  assert.equal(await mobile.locator('.bottle-ritual--arrived').count(), 1);
  await hidden(mobile, false);
  await scan(mobile, 'phone-enabled');
  await mobile.setViewportSize({ width: 740, height: 360 });
  await scan(mobile, 'phone-landscape');
  const mobileBoxes = await mobile.evaluate(() =>
    ['.bottle-ritual__open-label', '.bottle-ritual__gesture'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }),
  );
  assert.ok(
    mobileBoxes[0].bottom <= mobileBoxes[1].top && mobileBoxes[1].bottom <= 360,
    JSON.stringify(mobileBoxes),
  );
  await mobile.setViewportSize({ width: 390, height: 844 });
  await motion(mobile, [12, -12, 12, -12, 12]);
  await mobile.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
  pass(
    'Opted-in phone motion ignores weak input, changing axes and hidden-page events; a fresh deliberate shake opens once',
  );
  await button(mobile, 'Drift home').click();
  await pickup(mobile);
  assert.equal(await button(mobile, 'Enable phone shake').count(), 0);
  assert.equal(await mobile.evaluate(() => window.testMotionRequests), 3);
  await hidden(mobile, true);
  await hidden(mobile, false);
  await button(mobile, 'Turn off phone shake').click();
  await motion(mobile, [12, -12, 12, -12, 12]);
  assert.equal(await mobile.locator('.bottle-ritual--arrived').count(), 1);
  await button(mobile, 'Open bottle').click();
  await mobile.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
  pass(
    'The in-memory phone opt-in survives reopening without another request, can be turned off, and reduced-motion tap opening remains available',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`bottle-ritual-${engine.toLowerCase()}.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        mode: 'Isolated local database, synthetic sample assignment, AI disabled; emulated motion/permissions, not a physical phone test',
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
