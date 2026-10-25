import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL;
if (
  !origin?.startsWith('http://127.0.0.1:') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use npm run test:returns for a disposable local sandbox.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const contexts = [],
  errors = [],
  checks = [];
const out = new URL('../docs/evidence/', import.meta.url);
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
const button = (p, name) => p.getByRole('button', { name, exact: true });
const shelf = (p) => p.getByRole('button', { name: /^My bottles/ });
async function context(cookies) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    ...(cookies ? { storageState: { cookies, origins: [] } } : {}),
  });
  contexts.push(ctx);
  return ctx;
}
async function ready(ctx, url = origin) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await waitForGameConnection(p);
  return p;
}
async function finish(ctx, id, line) {
  const p = await ready(ctx, `${origin}/?bottle=${encodeURIComponent(id)}`);
  await button(p, 'Write an ending').click();
  await button(p, 'Open bottle').click();
  await p.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(line);
  await button(p, 'Send reply').click();
  await p.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  return p;
}
async function a11y(p) {
  const results = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    [],
  );
}
try {
  const author = await context(),
    writer = await context(),
    otherWriter = await context();
  let A = await ready(author);
  await A.getByRole('button', { name: /^Release a bottle/ }).click();
  await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(
    'I challenged their shark to poker.',
  );
  await button(A, 'Release').click();
  await A.locator('.shore-home').waitFor();
  const id = await A.evaluate(() => window.driftTestGame.snapshot().book.beginningIds[0]);
  await A.close();
  const B = await finish(writer, id, 'Our lawyers would like another hand.');
  A = await ready(author);
  await button(A, 'My bottles. 1 unopened reply').waitFor();
  assert.equal(await A.locator('.returned-notice').count(), 0);
  await A.screenshot({
    path: new URL(`unopened-${engine.toLowerCase()}-shore.png`, out).pathname,
    fullPage: true,
  });
  await a11y(A);
  assert.equal(await B.evaluate(() => window.driftTestGame.snapshot().unopenedReturns.length), 0);
  pass(
    'A reply completed while its author page is closed appears as unopened on return, without a false live-arrival notice or a badge for the ending writer',
  );

  const secondTab = await ready(author);
  await shelf(secondTab).click();
  await secondTab.locator('.unopened-label').filter({ hasText: '1 unopened' }).waitFor();
  await shelf(A).click();
  await A.locator('.beginning-preview').click();
  await A.locator('.ending-preview .unopened-label').waitFor();
  assert.equal(await A.evaluate(() => window.driftTestGame.snapshot().unopenedReturns.length), 1);
  await A.screenshot({
    path: new URL(`unopened-${engine.toLowerCase()}-reply-list.png`, out).pathname,
    fullPage: true,
  });
  await a11y(A);
  await A.locator('.ending-preview').click();
  await A.locator('.paper-open').waitFor();
  await A.locator('.paper-open').scrollIntoViewIfNeeded();
  await A.waitForFunction(() => window.driftTestGame.snapshot().unopenedReturns.length === 0);
  await secondTab.waitForFunction(
    () => window.driftTestGame.snapshot().unopenedReturns.length === 0,
  );
  assert.equal(await secondTab.locator('.unopened-label').count(), 0);
  await A.goto(origin);
  await waitForGameConnection(A);
  await button(A, 'My bottles').waitFor();
  assert.equal(await A.locator('.dock-object b').count(), 0);
  pass(
    'Beginning/reply previews do not mark a return opened; visible full-paper opening clears only that reply on both author tabs and remains cleared after reload',
  );

  await Promise.all([A.close(), secondTab.close()]);
  await finish(otherWriter, id, 'The shark has requested legal counsel.');
  A = await ready(author);
  await button(A, 'My bottles. 1 unopened reply').waitFor();
  assert.equal(await A.locator('.dock-object b').innerText(), '1');
  await shelf(A).click();
  await A.locator('.beginning-preview').click();
  assert.equal(await A.locator('.ending-preview').count(), 2);
  assert.equal(await A.locator('.ending-preview .unopened-label').count(), 1);
  assert.ok(
    (await A.locator('.ending-preview').filter({ hasText: 'Unopened' }).innerText()).includes(
      'requested legal counsel',
    ),
  );
  pass(
    'A second ending arriving while all author pages are closed adds exactly one unopened reply without reviving the already-opened pair',
  );

  const cookies = (await author.cookies()).filter((c) => c.name.startsWith('drift_book_'));
  const guest = await ready(await context(cookies));
  await button(guest, 'My bottles').waitFor();
  assert.equal(
    await guest.evaluate(() => window.driftTestGame.snapshot().unopenedReturns.length),
    0,
  );
  await shelf(guest).click();
  await guest.locator('.beginning-preview').waitFor();
  assert.equal(await guest.locator('.unopened-label').count(), 0);
  pass(
    'Public bookmark cookies recover the saved story but reveal no private reading state or author unread markers to a new identity',
  );

  await A.locator('.ending-preview').filter({ hasText: 'Unopened' }).click();
  await A.locator('.paper-open').waitFor();
  await A.locator('.paper-open').scrollIntoViewIfNeeded();
  await A.waitForFunction(() => window.driftTestGame.snapshot().unopenedReturns.length === 0);
  await button(A, 'Drift home').click();
  await button(A, 'My bottles').waitFor();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`unopened-${engine.toLowerCase()}.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        mode: 'Disposable local sandbox, synthetic writers and normal SDK subscriptions. No provider calls, production stories or challenge solution.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await Promise.all(contexts.map((ctx) => ctx.close()));
  await browser.close();
}
