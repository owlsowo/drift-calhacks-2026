import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use the disposable local test room.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
});
const checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
await context.addInitScript(() => {
  window.shorePermissionCalls = 0;
  Object.defineProperty(DeviceMotionEvent, 'requestPermission', {
    configurable: true,
    value: async () => (++window.shorePermissionCalls === 1 ? 'denied' : 'granted'),
  });
});
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const button = (name) => page.getByRole('button', { name, exact: true });
async function samples(values, gravity = false) {
  for (const value of values) {
    await page.evaluate(
      ({ value, gravity }) => {
        const e = new Event('devicemotion');
        Object.defineProperty(e, 'acceleration', {
          value: gravity ? null : typeof value === 'number' ? { x: value, y: 0, z: 0 } : value,
        });
        Object.defineProperty(e, 'accelerationIncludingGravity', {
          value: gravity ? { x: value, y: 0, z: 9.81 } : null,
        });
        window.dispatchEvent(e);
      },
      { value, gravity },
    );
    await page.waitForTimeout(80);
  }
}
async function opens(n) {
  assert.equal(await page.evaluate(() => window.shoreFallbackOpens), n);
}
async function reset() {
  await button('Turn phone shake off').click();
  await button('Enable phone shake').click();
  await button('Turn phone shake off').waitFor();
}
try {
  await page.goto(origin);
  await waitForGameConnection(page);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox), true);
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    const reactUrl = resources.find((url) => /\/react\.js(?:\?|$)/.test(url));
    const domUrl = resources.find((url) => /\/react-dom_client\.js(?:\?|$)/.test(url));
    if (!reactUrl || !domUrl) throw Error('Could not locate the app’s own loaded React modules.');
    const React = (await import(reactUrl)).default;
    const dom = await import(domUrl);
    const createRoot = dom.createRoot ?? dom.default?.createRoot;
    const { Shore } = await import('/src/Shore.tsx');
    document.getElementById('root').style.display = 'none';
    const fixture = document.createElement('div');
    fixture.className = 'sea-world';
    document.body.append(fixture);
    const root = createRoot(fixture);
    window.shoreFallbackOpens = 0;
    let config = { disabled: false };
    window.renderShoreFallback = (next) => {
      config = { ...config, ...next };
      root.render(
        React.createElement(Shore, {
          mode: 'catch',
          ...config,
          busy: '',
          actionLabel: 'Catch a bottle',
          onAction: async () => {
            window.shoreFallbackOpens++;
          },
          onWrite: async () => {},
          onCollection: () => {},
          headingRef: { current: null },
        }),
      );
    };
    window.renderShoreFallback({});
  });
  await button('Enable phone shake').waitFor();
  await samples([12, -12, 12, -12, 12]);
  await opens(0);
  assert.equal(await page.evaluate(() => window.shorePermissionCalls), 0);
  await button('Enable phone shake').click();
  await page
    .getByText('Motion wasn’t enabled. Drag the bottle or use the buttons.', { exact: true })
    .waitFor();
  await samples([12, -12, 12, -12, 12]);
  await opens(0);
  await button('Enable phone shake').click();
  await button('Turn phone shake off').waitFor();
  await samples([3, -3, 3, -3, 3]);
  await opens(0);
  await samples([
    { x: 12, y: 0, z: 0 },
    { x: 0, y: -14, z: 0 },
    { x: 0, y: 0, z: 14 },
    { x: 0, y: -14, z: 0 },
    { x: 0, y: 0, z: 14 },
  ]);
  await opens(0);
  await reset();
  await samples([12, -12, 12, -12, 12]);
  await opens(1);
  pass(
    'The real fallback component requests motion only on opt-in, handles denial, rejects weak/changing-axis bumps and fires once on four deliberate same-axis reversals',
  );
  await reset();
  await samples([12, -12, 12]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await samples([-12, 12, -12, 12]);
  await opens(1);
  await page.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await samples([-12, 12]);
  await opens(1);
  await page.evaluate(() => window.renderShoreFallback({ disabled: true }));
  await expect(button('Turn phone shake off')).toBeDisabled();
  await samples([12, -12, 12, -12, 12]);
  await opens(1);
  await page.evaluate(() => window.renderShoreFallback({ disabled: false }));
  await expect(button('Turn phone shake off')).toBeEnabled();
  await samples([-12, 12]);
  await opens(1);
  await reset();
  await samples([{ x: null, y: null, z: null }]);
  await samples([0, 0, 0, 0, 0], true);
  await opens(1);
  await samples([18, -18, 18, -18, 18], true);
  await opens(2);
  pass(
    'Hidden-page transitions and disabled controls discard partial gestures; gravity-only samples prime at rest and still recognize a fresh deliberate shake',
  );
  await reset();
  const grip = button('Pick up the drifting bottle');
  const box = await grip.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await samples([12, -12, 12, -12, 12]);
  await opens(2);
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
  await page.mouse.up();
  await samples([-12, 12]);
  await opens(2);
  await button('Turn phone shake off').click();
  await samples([12, -12, 12, -12, 12]);
  await opens(2);
  assert.equal((await page.evaluate(() => window.driftTestGame.snapshot().rounds)).length, 0);
  assert.deepEqual(errors, []);
  pass(
    'Pointer-held input cannot combine with phone samples; opting out stops motion and the component fixture creates no real round or provider action',
  );
  await fs.writeFile(
    new URL(`../docs/evidence/shore-motion-${engine.toLowerCase()}.json`, import.meta.url),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        checks,
        errors,
        scope:
          'Actual Shore fallback component mounted with a recording action in a disposable local app. Synthetic motion, permission/visibility/disabled states; no database actions, provider calls, physical sensors or OS permission-sheet claim.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await context.close();
  await browser.close();
}
