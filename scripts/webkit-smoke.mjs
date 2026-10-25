import { webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use the isolated test-room runner.');
const out = new URL('../docs/evidence/webkit/', import.meta.url).pathname;
await fs.mkdir(out, { recursive: true });
const browser = await webkit.launch({ headless: true });
const checks = [],
  errors = [],
  accessibility = [];
const details = { engine: browser.version(), capabilities: {} };
function activity() {
  const root = new URL('../', import.meta.url).pathname;
  const bundled = path.resolve(root, '../work/spacetime-cli/cli.toml');
  const config = existsSync(bundled) ? bundled : path.resolve(root, '.spacetime/cli.toml');
  const report = spawnSync(
    process.execPath,
    [
      'scripts/spacetime.mjs',
      '--config-path',
      config,
      'call',
      process.env.DRIFT_TEST_DATABASE,
      'admin_activity',
      '--server',
      process.env.DRIFT_TEST_HOST,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(report.status, 0, 'Local owner can read private activity');
  const line = report.stdout.split('\n').find((line) => line.startsWith('['));
  const rows = JSON.parse(line);
  return JSON.parse(rows.find((row) => row[1] === 'sandbox')[2]);
}
async function waitForCount(key, expected) {
  const deadline = Date.now() + 10_000;
  while (true) {
    const counts = activity();
    if (counts[key] === expected) return counts;
    if (Date.now() >= deadline) assert.equal(counts[key], expected, key);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
const button = (p, name) => p.getByRole('button', { name, exact: true });
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
let A, B;
async function ready(page) {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('.sandbox-banner').innerText(), /AI checks are off/);
}
async function screen(page, name, scan = true) {
  await page.screenshot({ path: out + name + '.png', fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    name + ': no horizontal overflow',
  );
  if (scan) {
    const report = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const violations = report.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    }));
    accessibility.push({ artifact: name + '.png', violations });
    assert.deepEqual(violations, [], name + ': tested accessibility rules');
  }
}
async function download(page, name) {
  const next = page.waitForEvent('download');
  await button(page, 'Save image').click();
  await (await next).saveAs(out + name);
  const png = await fs.readFile(out + name);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1650);
}
try {
  const phone = await browser.newContext({
    ...devices['iPhone 13'],
    reducedMotion: 'no-preference',
    acceptDownloads: true,
  });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  A = await phone.newPage();
  B = await desktop.newPage();
  await ready(A);
  await ready(B);
  details.capabilities = await A.evaluate(() => ({
    userAgent: navigator.userAgent,
    touch: navigator.maxTouchPoints,
    share: typeof navigator.share === 'function',
    fileShare: typeof navigator.canShare === 'function',
    motion: 'DeviceMotionEvent' in window,
    secureContext: isSecureContext,
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
  }));
  await screen(A, 'home-390');
  await screen(B, 'home-1440');
  pass(
    'Actual WebKit engine connects at iPhone 13 and desktop viewports with no horizontal overflow',
  );

  await B.locator('.sea-surface[data-motion="running"]').waitFor();
  const water = { x: 10, y: 650, width: 90, height: 70 };
  const movingA = await B.screenshot({ clip: water });
  await B.waitForTimeout(500);
  assert.notDeepEqual(
    await B.screenshot({ clip: water }),
    movingA,
    'WebKit renders moving water pixels',
  );
  await button(B, 'Pause sea motion').click();
  await B.locator('.sea-surface[data-motion="paused"]').waitFor();
  const pausedA = await B.screenshot({ clip: water });
  await B.waitForTimeout(500);
  assert.deepEqual(await B.screenshot({ clip: water }), pausedA, 'Paused sea stays still');
  await button(B, 'Resume sea motion').click();
  pass('WebKit draws moving sea pixels and the pause control freezes them');

  await button(B, 'Write my six words').click();
  await B.getByRole('textbox').fill('I challenged their shark to poker.');
  await button(B, 'Toss my bottle').click();
  await button(B, 'Catch a bottle').waitFor();
  await button(A, 'Pick up a bottle').tap();
  await A.getByRole('button', { name: 'Open bottle', exact: false }).tap();
  await A.locator('.paper-unfolding').waitFor();
  assert.equal(await A.locator('.paper-content').getAttribute('inert'), '');
  await A.locator('.paper-unfolding.has-paper-mesh').waitFor();
  await A.waitForTimeout(300);
  await screen(A, 'opening-390', false);
  await A.locator('.paper-open textarea').waitFor();
  await A.getByText('I challenged their shark to poker.', { exact: true }).waitFor();
  assert.equal(await A.locator('.ocean-world').isVisible(), true);
  await A.getByRole('textbox').fill('Our lawyers would like another hand.');
  await screen(A, 'writing-390');
  await A.reload();
  await button(A, 'Pick up where you left off').click();
  assert.equal(await A.getByRole('textbox').inputValue(), 'Our lawyers would like another hand.');
  pass(
    'A peer note opens as a connected WebKit mesh over the sea; its exclusive catch and draft survive reload',
  );

  await button(A, 'Seal our postcard').click();
  await A.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
  await A.locator('.postcard-paper.paper-open').waitFor();
  const layout = await A.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    };
    return {
      heading: rect('.reveal-copy h1'),
      card: rect('.reveal-art'),
      share: rect('.share-actions'),
      invitation: rect('.pass-it-on'),
    };
  });
  assert.ok(layout.heading.bottom <= layout.card.top, 'Read the outcome before the postcard');
  assert.ok(layout.card.bottom <= layout.share.top, 'See the postcard before sharing controls');
  assert.ok(
    layout.share.bottom <= layout.invitation.top,
    'Optional writing invitation follows the payoff',
  );
  await button(B, 'My postcards 1').waitFor();
  await button(B, 'Open returned postcard').waitFor();
  await screen(B, 'returned-notice-1440');
  assert.equal(await A.locator('.human-seal').count(), 1);
  await screen(A, 'postcard-390');
  await download(A, 'postcard-export.png');
  await B.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await button(B, 'Open returned postcard').click();
  await B.getByText('Our lawyers would like another hand.', { exact: true }).waitFor();
  await B.locator('.postcard-paper.paper-open').waitFor();
  assert.equal(
    activity().setupOpened,
    0,
    'An injected hidden-page state is not an observed return open',
  );
  await B.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitForCount('setupOpened', 1);
  assert.equal(await B.locator('.returned-notice').count(), 0);
  pass('WebKit announces a new returned bottle and opens its postcard without a refresh');
  pass(
    'Two WebKit identities receive the same canonical postcard without refresh and export a 1080×1650 PNG',
  );
  pass(
    'Mobile completion keeps the title, postcard and sharing controls above the optional next-beginning invitation',
  );

  // Headless WebKit does not exercise an OS share sheet. These injected adapters
  // verify app cancellation/failure behavior while the PNG generation remains real.
  await A.evaluate(() => {
    window.__shareCalls = [];
    window.__copiedLinks = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        window.__shareCalls.push({ files: data.files?.length, text: data.text });
        throw new DOMException('Synthetic native cancel', 'AbortError');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => window.__copiedLinks.push(text) },
    });
  });
  await button(A, 'Share our story').click();
  await A.waitForFunction(() => window.__shareCalls.length === 1);
  assert.equal(await A.evaluate(() => window.__copiedLinks.length), 0);
  assert.equal(await A.locator('.error-note').count(), 0);
  await A.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Synthetic share unavailable', 'NotAllowedError');
      },
    }),
  );
  await button(A, 'Share our story').click();
  await A.waitForFunction(() => window.__copiedLinks.length === 1);
  const link = await A.evaluate(() => window.__copiedLinks[0]);
  assert.ok(new URL(link).searchParams.get('card'));
  const viewer = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const publicPage = await viewer.newPage();
  publicPage.on('pageerror', (error) => errors.push(error.message));
  await publicPage.goto(link);
  await publicPage.getByText('Our lawyers would like another hand.', { exact: true }).waitFor();
  await screen(publicPage, 'shared-card-390');
  pass(
    'Injected native-share cancellation stays quiet; injected share denial copies a link a third WebKit identity can open',
  );
  const beforeShare = await waitForCount('linkCopied', 1);
  assert.equal(beforeShare.setupOpened, 1);
  assert.equal(beforeShare.replyOpened, 1);
  assert.equal(beforeShare.pngRequested, 1);
  assert.equal(
    beforeShare.nativeShareResolved,
    0,
    'Cancellation/denial do not become native-share success',
  );
  await A.evaluate(() =>
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} }),
  );
  await button(A, 'Share our story').click();
  await button(A, 'Share our story').click();
  await button(A, 'Copy the words').click();
  await download(A, 'postcard-export.png');
  const measured = await waitForCount('wordsCopied', 1);
  assert.equal(measured.nativeShareResolved, 1);
  assert.equal(measured.pngRequested, 1, 'Repeated export counts once per author/card');
  assert.equal(measured.peerCompleted, 1);
  assert.equal(measured.sampleCompleted, 0);
  details.activity = measured;
  pass(
    'Private owner totals observe visible author opens and export/share outcomes, exclude hidden pages/cancellation/public viewers, and deduplicate repeats',
  );

  const fallback = await browser.newContext({
    ...devices['iPhone 13'],
    reducedMotion: 'no-preference',
    acceptDownloads: true,
  });
  await fallback.addInitScript(() => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === 'webgl' || kind === 'webgl2' ? null : context.call(this, kind, ...args);
    };
  });
  const quiet = await fallback.newPage();
  await ready(quiet);
  await quiet.locator('.sea-surface[data-motion="fallback"]').waitFor();
  await button(quiet, 'Pick up a bottle').click();
  await quiet.getByRole('button', { name: 'Open bottle', exact: false }).click();
  await quiet.locator('.paper-unfolding').waitFor();
  assert.equal(await quiet.locator('.has-paper-mesh').count(), 0);
  await quiet.locator('.paper-open textarea').waitFor();
  await screen(quiet, 'no-webgl-390');
  pass(
    'Forced WebGL unavailability leaves the photographed sea and readable CSS note fallback working',
  );
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.message);
  await A?.screenshot({ path: out + 'failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await fs.writeFile(
    out + 'checks.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'Actual desktop Playwright WebKit engine with iPhone viewport/touch emulation; local isolated SpacetimeDB, AI off, synthetic inputs',
        status: errors.length ? 'failed' : 'passed',
        ...details,
        checks,
        errors,
        accessibility,
        limitations: [
          'Not a physical iPhone/Safari run or real mobile keyboard test',
          'Native share sheet cancellation/denial use injected browser adapters',
          'No physical motion sensor or attendee testing',
          'Forced no-WebGL branch is an explicit failure injection',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
