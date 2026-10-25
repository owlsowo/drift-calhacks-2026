import { chromium, webkit, expect } from '@playwright/test';
import jsQR from 'jsqr';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
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
const contexts = [],
  checks = [],
  errors = [];
const out = new URL('../docs/evidence/', import.meta.url);
const button = (p, name) => p.getByRole('button', { name, exact: true });
const dialog = (p) => p.getByRole('dialog', { name: 'Pass this bottle along', exact: true });
const pass = (message) => {
  checks.push(message);
  console.log('PASS', message);
};
async function make(url = origin) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 740 },
    reducedMotion: 'reduce',
  });
  contexts.push(context);
  await context.addInitScript(() => {
    window.qrCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.qrCopied = text;
        },
      },
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await waitForGameConnection(page);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox), true);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().service?.aiReady), false);
  return page;
}
async function open(page) {
  await button(page, 'Show QR code').click();
  await dialog(page).waitFor();
}
async function decode(page) {
  const png = await page
    .getByRole('img', { name: 'Scan to open this public bottle', exact: true })
    .screenshot();
  const pixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + base64;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const c = canvas.getContext('2d');
    c.drawImage(image, 0, 0);
    return {
      width: canvas.width,
      height: canvas.height,
      data: Array.from(c.getImageData(0, 0, canvas.width, canvas.height).data),
    };
  }, png.toString('base64'));
  return jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height, {
    inversionAttempts: 'dontInvert',
  })?.data;
}
try {
  await fs.mkdir(out, { recursive: true });
  const author = await make();
  const prompt = await author.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  await author.getByRole('button', { name: /^Release a bottle/ }).click();
  await author
    .getByRole('textbox', { name: 'Your six-word beginning', exact: true })
    .fill(prompt.exampleSetup);
  await button(author, 'Release').click();
  await author.locator('.shore-home').waitFor();
  await author.getByRole('button', { name: /^My bottles/ }).click();
  await author.locator('.beginning-preview').click();
  const id = await author.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
  const expected = origin + '/?bottle=' + encodeURIComponent(id);
  const before = await author.evaluate(() =>
    window.driftTestGame.snapshot().rounds.map((r) => r.id),
  );
  await open(author);
  await author.getByRole('img', { name: 'Scan to open this public bottle', exact: true }).waitFor();
  assert.equal(await decode(author), expected);
  await button(author, 'Copy bottle link').last().click();
  assert.equal(await author.evaluate(() => window.qrCopied), expected);
  assert.deepEqual(
    await author.evaluate(() => window.driftTestGame.snapshot().rounds.map((r) => r.id)),
    before,
  );
  const scan = await new AxeBuilder({ page: author })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => v.id),
    [],
  );
  assert.equal(
    await author.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await author.screenshot({
    path: new URL(`qr-invitation-${engine.toLowerCase()}.png`, out).pathname,
    fullPage: true,
  });
  pass(
    'The actual 320px rendered QR screenshot independently decodes to exactly the same public bottle URL as Copy link, with no private history/draft/token and no additional author turn',
  );
  await button(author, 'Close dialog').click();
  await expect(button(author, 'Show QR code')).toBeFocused();
  await open(author);
  await author.keyboard.press('Escape');
  await expect(dialog(author)).toHaveCount(0);
  await expect(button(author, 'Show QR code')).toBeFocused();
  pass(
    'Close and Escape return keyboard focus to the invitation trigger without navigating or altering the author’s round',
  );
  const reader = await make(expected);
  assert.equal((await reader.evaluate(() => window.driftTestGame.snapshot().rounds)).length, 0);
  assert.equal(await button(reader, 'Withdraw this bottle').count(), 0);
  await open(reader);
  assert.equal(await decode(reader), expected);
  await button(reader, 'Close dialog').click();
  assert.equal((await reader.evaluate(() => window.driftTestGame.snapshot().rounds)).length, 0);
  await button(reader, 'Write an ending').click();
  await button(reader, 'Open bottle').click();
  await reader
    .getByRole('textbox', { name: 'Your six-word ending', exact: true })
    .fill(prompt.exampleReply);
  await button(reader, 'Send reply').click();
  await reader.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  await author.waitForFunction(() =>
    window.driftTestGame
      .snapshot()
      .cards.some((c) => c.beginningId === window.driftTestGame.snapshot().outgoing[0]?.id),
  );
  assert.equal((await reader.evaluate(() => window.driftTestGame.snapshot().rounds)).length, 1);
  assert.deepEqual(
    await author.evaluate(() => window.driftTestGame.snapshot().rounds.map((r) => r.id)),
    before,
  );
  pass(
    'An independent identity opens the decoded invitation for free, gains no withdrawal authority, then completes one real local reply that arrives live for the original author',
  );
  const fallback = await make(expected);
  await fallback.route('**/src/invitation-code.ts*', (route) => route.abort());
  await open(fallback);
  await fallback
    .getByText('The code couldn’t load. You can still copy the bottle link below.', { exact: true })
    .waitFor();
  await button(fallback, 'Copy bottle link').last().click();
  assert.equal(await fallback.evaluate(() => window.qrCopied), expected);
  assert.equal((await fallback.evaluate(() => window.driftTestGame.snapshot().rounds)).length, 0);
  pass(
    'A failed lazy encoder leaves a working copy-link route and consumes no turn or provider request',
  );
  await open(author);
  await author.evaluate((id) => window.driftTestGame.withdraw(id), id);
  await expect(dialog(author)).toHaveCount(0);
  await expect(dialog(fallback)).toHaveCount(0);
  await expect(author.locator('.bottle-qr')).toHaveCount(0);
  pass(
    'A real author withdrawal removes open invitation dialogs and their QR from both subscribed identities without leaving a stale code',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`qr-invitation-${engine.toLowerCase()}.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        checks,
        errors,
        scope:
          'Disposable keyless local database and synthetic two-writer story; independent jsQR decoding of an actual rendered QR screenshot. No paid call, external QR service, camera permission, physical-phone scan or OS share claim.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
