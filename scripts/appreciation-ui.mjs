import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use npm run test:thanks.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const out = new URL('../docs/evidence/', import.meta.url),
  checks = [],
  errors = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const button = (page, name) => page.getByRole('button', { name, exact: true });
let setupText, replyText;
const otherText = 'My imaginary friend caused this mess.';
async function ready(page, url = origin) {
  await page.goto(url);
  await waitForGameConnection(page);
}
async function make(width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.testCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.testCopied = text;
        },
      },
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  return { page, context };
}
async function state(page) {
  return page.evaluate(() => {
    const s = window.driftTestGame.snapshot();
    return { rounds: s.rounds, assignments: s.assignments, outgoing: s.outgoing, cards: s.cards };
  });
}
async function release(page, text) {
  await button(page, 'Drift home').click();
  await page.getByRole('button', { name: /^Release a bottle/ }).click();
  await page.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(text);
  await button(page, 'Release').click();
  await page.locator('.shore-home').waitFor();
  await page.waitForFunction(() =>
    window.driftTestGame.snapshot().rounds.some((r) => r.stage === 'done' && r.setupId),
  );
}
async function openOwn(page, text) {
  await page.getByRole('button', { name: /^My bottles/ }).click();
  await page.locator('.beginning-preview').filter({ hasText: text }).click();
  await page.locator('.paper-open .letter-text').waitFor();
}
async function invitation(page) {
  await button(page, 'Invite someone to finish').click();
  return page.evaluate(() => window.testCopied);
}
async function enter(page, label = 'Write an ending') {
  await button(page, label).click();
  await button(page, 'Open bottle').click();
  await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
}
async function finish(page, text = replyText) {
  await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(text);
  await button(page, 'Send reply').click();
  await page.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
}
async function capture(page, name) {
  await page.screenshot({
    path: new URL(`thanks-${engine.toLowerCase()}-${name}.png`, out).pathname,
    fullPage: true,
  });
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
try {
  const { page: A, context: authorContext } = await make(1440),
    { page: B } = await make(390),
    { page: C, context: otherWriterContext } = await make(390),
    { page: E, context: cookieContext } = await make(390);
  const prompt = await A.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  setupText = prompt.exampleSetup;
  replyText = prompt.exampleReply;
  await release(A, setupText);
  await openOwn(A, setupText);
  const url = await invitation(A);
  const id = (await state(A)).outgoing[0].id;
  await ready(B, url);
  await enter(B);
  await finish(B);
  const pairId = (await state(B)).rounds.find((r) => r.cardId).cardId;
  const pairUrl = `${origin}/?card=${pairId}`;
  await ready(A, pairUrl);
  await expect(button(A, 'Thank your co-writer')).toBeEnabled();
  await expect(button(B, 'Thank your co-writer')).toBeEnabled();
  assert.equal(await A.locator('.thanks-received').count(), 0);
  assert.equal(await B.locator('.thanks-received').count(), 0);
  await capture(A, 'before');
  pass(
    'A completed human pair offers a deliberate private thank-you after opening; reading alone sends nothing',
  );

  await cookieContext.addCookies(
    (await authorContext.cookies()).filter((c) => c.name.startsWith('drift_book_')),
  );
  await ready(E, pairUrl);
  assert.equal(await E.locator('.co-writer-thanks').count(), 0);
  assert.deepEqual(await E.evaluate(() => window.driftTestGame.snapshot().appreciation), []);
  const rejection = await E.evaluate(async (id) => {
    try {
      await window.driftTestGame.thank(id);
      return 'unexpected success';
    } catch (e) {
      return e.message;
    }
  }, pairId);
  assert.match(rejection, /only for the two writers/i);
  pass(
    'Public story links and copied shelf cookies reveal no private receipts and cannot send a thank-you',
  );

  const A2 = await authorContext.newPage();
  await ready(A2, pairUrl);
  await button(B, 'Drift home').click();
  await B.getByRole('button', { name: /^Release a bottle/ }).click();
  const draftBox = B.getByRole('textbox', { name: 'Your six-word beginning', exact: true });
  await draftBox.fill('A little unfinished draft');
  await A.evaluate(() => {
    const original = window.driftTestGame.thank;
    window.driftTestGame.thank = async (id) => {
      await original(id);
      return new Promise(() => {});
    };
  });
  await button(A, 'Thank your co-writer').click();
  await expect(button(A, 'Thanks sent')).toBeDisabled();
  await A2.evaluate(async (id) => {
    await Promise.all([window.driftTestGame.thank(id), window.driftTestGame.thank(id)]);
  }, pairId);
  await expect(button(A2, 'Thanks sent')).toBeDisabled();
  await B.getByText('A co-writer sent a little thanks. Find it in My bottles.', {
    exact: true,
  }).waitFor();
  assert.equal(await draftBox.inputValue(), 'A little unfinished draft');
  assert.equal(await draftBox.evaluate((el) => el === document.activeElement), true);
  assert.equal(await A.getByText('Sending thanks…', { exact: true }).count(), 0);
  assert.deepEqual(
    await A2.evaluate(
      (id) => window.driftTestGame.snapshot().appreciation.find((item) => item.cardId === id),
      pairId,
    ),
    { cardId: pairId, sent: true, received: false },
  );
  pass(
    'Real thanks arrives live while the other writer keeps their focused draft; subscription confirmation unlocks a lost response and repeat/two-tab sends remain one receipt',
  );

  await button(B, 'Drift home').click();
  await B.getByRole('button', { name: /^My bottles/ }).click();
  await B.locator('.collection-card .thanks-label').waitFor();
  await capture(B, 'shelf-phone');
  await B.locator('.collection-card').filter({ hasText: setupText }).click();
  await B.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  await button(B, 'Thank your co-writer').click();
  await A.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  await expect(button(B, 'Thanks sent')).toBeDisabled();
  await capture(B, 'mutual-phone');
  await A.reload();
  await waitForGameConnection(A);
  await expect(button(A, 'Thanks sent')).toBeDisabled();
  await A.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  await capture(A, 'mutual-desktop');
  assert.equal(await E.locator('.co-writer-thanks').count(), 0);
  pass(
    'Each co-writer can send independently; both private receipts survive reload and remain absent from the public copy',
  );

  await ready(C, url);
  await enter(C);
  await finish(C, 'Nobody approved your suspicious little plan.');
  assert.equal(await C.locator('.thanks-received').count(), 0);
  const otherPair = (await state(C)).rounds.find((r) => r.cardId).cardId;
  assert.equal(
    await A.evaluate(
      (id) =>
        window.driftTestGame.snapshot().appreciation.find((item) => item.cardId === id)?.received,
      otherPair,
    ),
    false,
  );
  await C.close();
  await A.evaluate((id) => window.driftTestGame.thank(id), otherPair);
  const C2 = await otherWriterContext.newPage();
  await ready(C2, `${origin}/?card=${otherPair}`);
  await C2.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  assert.equal(
    await C2.getByText('A co-writer sent a little thanks. Find it in My bottles.', {
      exact: true,
    }).count(),
    0,
  );
  assert.equal(await E.locator('.co-writer-thanks').count(), 0);
  await C2.close();
  pass(
    'Another ending has independent private appreciation; thanks sent while its writer is away appears on return without a false live-arrival toast',
  );

  await button(B, 'Copy text').click();
  const copied = await B.evaluate(() => window.testCopied);
  assert.equal(copied.includes('thanks'), false);
  assert.ok(copied.includes(setupText) && copied.includes(replyText));
  const downloadPromise = B.waitForEvent('download');
  await button(B, 'Save image').click();
  const download = await downloadPromise;
  const file = await download.path();
  assert.ok(file);
  assert.ok((await fs.stat(file)).size > 10000);
  pass(
    'Copy text and the actual image download still export the story, with private receipt UI kept outside story text',
  );

  await button(A, 'Hide').click();
  await button(A, 'Hide postcard').click();
  await B.getByRole('heading', { name: 'Reply unavailable', exact: true }).waitFor();
  await E.getByRole('heading', { name: 'Reply unavailable', exact: true }).waitFor();
  assert.equal(await B.locator('.co-writer-thanks').count(), 0);
  await B.waitForFunction(
    (id) => !window.driftTestGame.snapshot().appreciation.some((item) => item.cardId === id),
    pairId,
  );
  await A.waitForFunction(
    (id) => !window.driftTestGame.snapshot().appreciation.some((item) => item.cardId === id),
    pairId,
  );
  pass(
    'Hiding the pair removes its appreciation and public story live for both writers and public readers',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`thanks-${engine.toLowerCase()}-checks.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        scope:
          'Real disposable local database and synthetic stories with AI off. Clipboard and lost acknowledgement are injected. Screens and downloads are desktop browser checks, not physical phone OS sharing.',
        checks,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
