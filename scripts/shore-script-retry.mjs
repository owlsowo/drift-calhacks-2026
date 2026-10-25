import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL,
  database = process.env.DRIFT_TEST_DATABASE;
if (!origin?.startsWith('http://127.0.0.1:') || !database?.startsWith('drift-test-'))
  throw Error('Use the disposable local harness with DRIFT_TEST_GATE=true.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const contexts = [],
  checks = [],
  errors = [];
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const selector = 'script[data-drift-turnstile]';
const button = (p, name) => p.getByRole('button', { name, exact: true });
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
// This script is fulfilled locally. It cannot verify a token and never invokes
// the success callback; all writes stay blocked behind the real local gate.
const inertApi = `(() => {
  window.shoreScriptTest ||= { renders: 0, removes: 0, resets: 0, options: [] };
  window.turnstile = {
    render(node, options) {
      const stats = window.shoreScriptTest;
      const id = 'inert-' + ++stats.renders;
      stats.options.push(options);
      const box = document.createElement('div');
      box.className = 'inert-local-widget'; box.dataset.widgetId = id;
      box.textContent = 'Local widget placeholder: not verified';
      node.append(box); return id;
    },
    remove(id) {
      window.shoreScriptTest.removes++;
      document.querySelectorAll('.inert-local-widget').forEach(node => {
        if (node.dataset.widgetId === id) node.remove();
      });
    },
    reset() { window.shoreScriptTest.resets++; }
  };
})();`;
async function pageFor(routeHandler, clock = false) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  contexts.push(context);
  await context.route(API, routeHandler);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  if (clock) await page.clock.install();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await waitForGameConnection(page);
  assert.equal(
    await page.evaluate(() => window.driftTestGame.snapshot().service.botRequired),
    true,
    'The disposable module must use DRIFT_TEST_GATE=true; never run against production.',
  );
  await page.locator('.shore-gate').waitFor();
  return page;
}
async function protectedState(page) {
  assert.equal(await page.getByRole('button', { name: /^Release a bottle/ }).isDisabled(), true);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().rounds.length), 0);
}
const respond = (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: inertApi });
try {
  let failedRequests = 0;
  const failed = await pageFor(async (route) => {
    failedRequests++;
    if (failedRequests === 1) await route.abort('failed');
    else await respond(route);
  });
  await failed.getByText('The shore check couldn’t load. Try again.', { exact: true }).waitFor();
  assert.equal(failedRequests, 1);
  await button(failed, 'Retry shore check').click();
  await failed.locator('.inert-local-widget').waitFor();
  assert.equal(failedRequests, 2);
  assert.equal(await failed.locator(selector).count(), 1);
  await protectedState(failed);
  pass(
    'A failed API script is replaced on explicit Retry, makes a new intercepted request and renders an inert widget without issuing a pass',
  );

  await button(failed, 'Retry shore check').click();
  await failed.waitForFunction(() => window.shoreScriptTest.renders === 2);
  assert.equal(failedRequests, 2);
  assert.equal(await failed.locator('.inert-local-widget').count(), 1);
  const healthy = await failed.evaluate(() => ({
    renders: window.shoreScriptTest.renders,
    removes: window.shoreScriptTest.removes,
  }));
  assert.deepEqual(healthy, { renders: 2, removes: 1 });
  // Old widget error/expiry callbacks must not mutate the replacement or reset it.
  await failed.evaluate(() => {
    window.shoreScriptTest.options[0]['error-callback']();
    window.shoreScriptTest.options[0]['expired-callback']();
  });
  assert.equal(
    await failed.locator('.shore-gate [role="status"]').innerText(),
    'Keeping the bottles human…',
  );
  assert.equal(await failed.evaluate(() => window.shoreScriptTest.resets), 0);
  await protectedState(failed);
  pass(
    'A healthy API is reused across Retry; the old widget is removed once and its late error/expiry callbacks are ignored',
  );

  let loadingRequests = 0,
    releaseLoading;
  const heldLoad = new Promise((resolve) => {
    releaseLoading = resolve;
  });
  const loading = await pageFor(async (route) => {
    loadingRequests++;
    await heldLoad;
    await respond(route);
  });
  await loading.locator(selector).waitFor({ state: 'attached' });
  await loading.evaluate(() => {
    window.originalLoadingScript = document.querySelector('script[data-drift-turnstile]');
  });
  await button(loading, 'Retry shore check').click();
  assert.equal(
    await loading.evaluate(
      () => window.originalLoadingScript === document.querySelector('script[data-drift-turnstile]'),
    ),
    true,
  );
  assert.equal(loadingRequests, 1);
  releaseLoading();
  await loading.locator('.inert-local-widget').waitFor();
  assert.equal(loadingRequests, 1);
  assert.equal(await loading.evaluate(() => window.shoreScriptTest.renders), 1);
  await protectedState(loading);
  pass('Retry shares an API request still loading normally and mounts the arriving API only once');

  let lateRequests = 0,
    releaseLate;
  const heldLate = new Promise((resolve) => {
    releaseLate = resolve;
  });
  const late = await pageFor(async (route) => {
    lateRequests++;
    await heldLate;
    await respond(route);
  });
  await late.locator(selector).waitFor({ state: 'attached' });
  await late.getByRole('button', { name: /^My bottles/ }).click();
  await late.getByRole('heading', { name: 'My bottles', exact: true }).waitFor();
  assert.equal(await late.locator('.shore-gate').count(), 0);
  releaseLate();
  await late.waitForFunction(() => !!window.turnstile);
  assert.equal(await late.evaluate(() => window.shoreScriptTest.renders), 0);
  await button(late, 'Drift home').click();
  await late.locator('.inert-local-widget').waitFor();
  assert.equal(lateRequests, 1);
  assert.equal(await late.evaluate(() => window.shoreScriptTest.renders), 1);
  await protectedState(late);
  pass(
    'Leaving before script load prevents a stale widget mount; returning reuses the loaded API without another request',
  );
  let timedRequests = 0,
    releaseTimed;
  const heldTimed = new Promise((resolve) => {
    releaseTimed = resolve;
  });
  const timed = await pageFor(async (route) => {
    timedRequests++;
    await heldTimed;
    await respond(route);
  }, true);
  await timed.locator(selector).waitFor({ state: 'attached' });
  await timed.evaluate(() => {
    window.originalTimedScript = document.querySelector('script[data-drift-turnstile]');
  });
  await timed.clock.fastForward(12001);
  await timed
    .getByText('The shore check is taking longer. Check your connection and try again.', {
      exact: true,
    })
    .waitFor();
  assert.equal(await timed.locator(selector).getAttribute('data-drift-turnstile-state'), 'stalled');
  assert.equal(timedRequests, 1);
  await button(timed, 'Retry shore check').click();
  await timed.getByText('Keeping the bottles human…', { exact: true }).waitFor();
  releaseTimed();
  await timed.locator('.inert-local-widget').waitFor();
  assert.equal(timedRequests, 1);
  assert.equal(
    await timed.evaluate(
      () => window.originalTimedScript === document.querySelector('script[data-drift-turnstile]'),
    ),
    true,
  );
  assert.equal(await timed.evaluate(() => window.shoreScriptTest.renders), 1);
  await timed.clock.fastForward(12001);
  assert.equal(await timed.locator(selector).getAttribute('data-drift-turnstile-state'), 'loaded');
  assert.equal(
    await timed.locator('.shore-gate [role="status"]').innerText(),
    'Keeping the bottles human…',
  );
  assert.equal(await timed.locator('.inert-local-widget').count(), 1);
  await protectedState(timed);
  pass(
    'A stalled load gets bounded feedback; Retry preserves the pending request and mounts its eventual response once, with old timers cancelled',
  );

  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`../docs/evidence/shore-script-retry-${engine.toLowerCase()}.json`, import.meta.url),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        mode: 'Disposable local database with synthetic gate secret. All API scripts are locally intercepted inert placeholders, script failures/delays and clock are injected. No success callback, challenge solving, pass issuance, external Turnstile API response or provider call.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
