import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use npm run test:invitations.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit'
    ? await webkit.launch()
    : await chromium.launch(
        process.env.DRIFT_CHROMIUM_PATH
          ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
          : { channel: 'chrome' },
      );
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
    path: new URL(`invitation-${engine.toLowerCase()}-${name}.png`, out).pathname,
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
  const { page: A } = await make(1440),
    { page: B } = await make(390),
    { page: C } = await make(1440),
    { page: D } = await make(390);
  const prompt = await A.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  setupText = prompt.exampleSetup;
  replyText = prompt.exampleReply;
  await release(A, setupText);
  await openOwn(A, setupText);
  const url = await invitation(A);
  const id = (await state(A)).outgoing[0].id;
  assert.equal(url, `${origin}/?bottle=${encodeURIComponent(id)}`);
  assert.equal((await state(A)).rounds.length, 1);
  await capture(A, 'author');
  pass(
    'The author’s prominent invitation control copies a public bottle-ID URL through an injected clipboard adapter without creating a round',
  );
  await release(C, otherText);
  await openOwn(C, otherText);
  const otherUrl = await invitation(C);
  const otherId = (await state(C)).outgoing[0].id;
  await ready(B, url);
  await B.getByRole('heading', { name: 'A drifting beginning', exact: true }).waitFor();
  assert.equal((await state(B)).rounds.length, 0);
  assert.equal(await B.locator('.letter-text').innerText(), setupText);
  assert.equal(await button(B, 'Invite someone to finish').count(), 0);
  await capture(B, 'recipient');
  pass(
    'A fresh recipient reads the exact beginning and its theme before choosing to write; viewing alone consumes no daily round',
  );
  await button(B, 'Write an ending').click();
  await B.locator('.bottle-ritual--arrived').waitFor();
  const original = (await state(B)).rounds.find((r) => r.stage === 'reply');
  assert.equal(original.assignmentId, id);
  await button(B, 'Back to sea').click();
  await button(B, 'Resume your ending').waitFor();
  await enter(B, 'Resume your ending');
  assert.equal((await state(B)).rounds[0].leaseMs, original.leaseMs);
  await B.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(
    'A saved beginning',
  );
  await ready(B, url);
  await enter(B, 'Resume your ending');
  assert.equal(
    await B.getByRole('textbox', { name: 'Your six-word ending', exact: true }).inputValue(),
    'A saved beginning',
  );
  assert.equal((await state(B)).rounds.length, 1);
  pass(
    'Invitation cancel, resume and reload retain the exact assignment, original deadline and independent ending draft',
  );
  await finish(B);
  await A.locator('.ending-preview').filter({ hasText: replyText }).waitFor();
  await button(A, 'Open returned postcard').waitFor();
  await ready(B, url);
  await B.getByText('You already added an ending to this beginning.', { exact: true }).waitFor();
  assert.equal(await button(B, 'Write an ending').count(), 0);
  assert.equal((await state(B)).rounds.length, 1);
  pass(
    'Finishing the invitation returns a real pair live to its author and the same identity cannot add another ending through the link',
  );
  await ready(C, url);
  await enter(C);
  await finish(C, 'Nobody approved your suspicious little plan.');
  await A.getByRole('heading', { name: '2 replies', exact: true }).waitFor();
  assert.equal(await A.locator('.ending-preview').count(), 2);
  await capture(A, 'two-endings');
  pass(
    'Two invited writers finish the same selected beginning as distinct pairs, even with another public beginning available',
  );
  await ready(D, otherUrl);
  await enter(D);
  await D.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(
    'My other saved ending',
  );
  await ready(D, url);
  await button(D, 'Resume your open bottle').waitFor();
  assert.equal(await button(D, 'Write an ending').count(), 0);
  await enter(D, 'Resume your open bottle');
  assert.equal((await state(D)).assignments[0].id, otherId);
  assert.equal(
    await D.getByRole('textbox', { name: 'Your six-word ending', exact: true }).inputValue(),
    'My other saved ending',
  );
  assert.equal((await state(D)).rounds.length, 1);
  pass(
    'Another invitation cannot silently replace an open bottle or its draft; the recipient can resume that existing ending',
  );
  await release(B, 'Our captain replaced gravity with glitter.');
  await release(B, 'Their penguin stole my student discount.');
  await ready(B, otherUrl);
  assert.equal(await button(B, 'Write an ending').isDisabled(), true);
  await B.getByText('Today’s limit is reached. You can still read the replies.', {
    exact: true,
  }).waitFor();
  assert.equal((await state(B)).rounds.length, 3);
  await capture(B, 'daily-limit');
  pass(
    'The invitation respects the shared three-round daily quota while its public beginning and replies remain readable',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`invitation-${engine.toLowerCase()}.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        mode: 'Isolated local sandbox; synthetic writers and words, model calls disabled. Copy adapter injected; actual server assignments, moderation sandbox transitions, reloads and live multi-writer subscriptions.',
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
