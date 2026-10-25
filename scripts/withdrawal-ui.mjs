import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use npm run test:withdrawal.');
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
    path: new URL(`withdrawal-${engine.toLowerCase()}-${name}.png`, out).pathname,
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
    { page: C } = await make(1440),
    { page: D } = await make(390),
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
  await cookieContext.addCookies(
    (await authorContext.cookies()).filter((cookie) => cookie.name.startsWith('drift_book_')),
  );
  await ready(E, url);
  await E.getByText('Bottle ID', { exact: true }).click();
  assert.equal(await button(E, 'Withdraw this bottle').count(), 0);
  const rejected = await E.evaluate(async (id) => {
    try {
      await window.driftTestGame.withdraw(id);
      return 'unexpected success';
    } catch (error) {
      return error.message;
    }
  }, id);
  assert.match(rejected, /Only the writer/);
  assert.equal((await state(A)).outgoing[0].id, id);
  pass('A public link and copied ID-only shelf cookies grant no withdrawal UI or server authority');

  for (const writer of [B, C]) {
    await ready(writer, url);
    await enter(writer);
    await finish(writer);
  }
  await A.getByRole('heading', { name: '2 replies', exact: true }).waitFor();
  const pairIds = (await state(A)).cards
    .filter((card) => card.beginningId === id)
    .map((card) => card.id);
  await ready(D, url);
  await enter(D);
  const draftBox = D.getByRole('textbox', { name: 'Your six-word ending', exact: true });
  const draftText = 'Our lawyers would like another hand.';
  await draftBox.fill(draftText);
  const draftRound = (await state(D)).rounds.find((round) => round.stage === 'reply');
  await release(C, otherText);
  await openOwn(C, otherText);
  const otherId = (await state(C)).outgoing.find((item) => item.text === otherText).id;
  await ready(B, `${origin}/?card=${pairIds[0]}`);
  await B.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  await A.getByText('Bottle ID', { exact: true }).click();
  await button(A, 'Withdraw this bottle').click();
  await A.getByRole('dialog', { name: 'Withdraw this bottle?' }).waitFor();
  await capture(A, 'confirmation');
  await button(A, 'Keep it drifting').click();
  await expect(button(A, 'Withdraw this bottle')).toBeFocused();
  assert.equal((await state(A)).cards.filter((card) => card.beginningId === id).length, 2);
  pass(
    'Withdrawal requires a clear scope confirmation; cancellation returns focus without changing either shared reply',
  );
  const A2 = await authorContext.newPage();
  await ready(A2, url);
  await A2.getByText('Bottle ID', { exact: true }).click();
  await button(A2, 'Withdraw this bottle').click();
  await A2.getByRole('dialog').waitFor();

  // Simulate a lost acknowledgement only after the real reducer commits.
  await A.evaluate(() => {
    const original = window.driftTestGame.withdraw;
    window.driftTestGame.withdraw = async (id) => {
      await new Promise((resolve) => {
        window.releaseWithdrawal = resolve;
      });
      await original(id);
      return new Promise(() => {});
    };
  });
  await button(A, 'Withdraw this bottle').click();
  await button(A, 'Withdraw bottle').click();
  await expect(button(A, 'Keep it drifting')).toBeDisabled();
  await expect(button(A, 'Close dialog')).toBeDisabled();
  await A.keyboard.press('Escape');
  await expect(A.getByRole('dialog')).toBeVisible();
  await A.evaluate(() => window.releaseWithdrawal());
  await A.getByRole('heading', { name: 'My bottles', exact: true }).waitFor();
  await A.getByText('Bottle withdrawn', { exact: true }).waitFor();
  await A2.getByRole('dialog').waitFor({ state: 'hidden' });
  await B.getByRole('heading', { name: 'Reply unavailable', exact: true }).waitFor();
  await E.getByRole('heading', { name: 'Bottle unavailable', exact: true }).waitFor();
  for (const page of [A, B, C, D, E]) {
    await page.waitForFunction(
      (id) =>
        !window.driftTestGame.snapshot().beginnings.some((item) => item.id === id) &&
        !window.driftTestGame.snapshot().cards.some((item) => item.beginningId === id),
      id,
    );
  }
  assert.equal((await state(A)).rounds.length, 1);
  assert.equal(
    (await state(C)).outgoing.some((item) => item.id === otherId),
    true,
  );
  pass(
    'One real withdrawal removes all public views and both pairs live across five identities, even when its acknowledgement is lost; quota and unrelated beginning remain',
  );

  await D.getByText('That beginning is no longer available.', { exact: true }).waitFor();
  assert.equal(await draftBox.inputValue(), draftText);
  assert.equal(await draftBox.evaluate((el) => el === document.activeElement), true);
  assert.equal(await button(D, 'Send reply').isDisabled(), true);
  assert.equal(await D.locator('.caught-note').count(), 0);
  await button(D, 'Copy my draft').click();
  assert.equal(await D.evaluate(() => window.testCopied), draftText);
  await capture(D, 'retained-draft');
  pass(
    'The active writer sees live removal without losing text or focus; sending stops and copying the saved draft still works',
  );

  await button(D, 'Catch a fresh bottle').click();
  await button(D, 'Open bottle').click();
  await draftBox.waitFor();
  const fresh = (await state(D)).rounds.find((round) => round.id === draftRound.id);
  assert.equal(fresh.assignmentId, otherId);
  assert.equal(fresh.skips, draftRound.skips);
  assert.equal((await state(D)).rounds.length, 1);
  assert.equal(await draftBox.inputValue(), '');
  const retained = await D.evaluate(
    async ({ roundId, assignmentId }) => {
      const { saved } = await import('/src/game.ts');
      return saved(
        `drift:draft:${window.driftTestGame.snapshot().identity}:${roundId}:${assignmentId}`,
      );
    },
    { roundId: draftRound.id, assignmentId: id },
  );
  assert.equal(retained, draftText);
  pass(
    'Catching after withdrawal keeps the same daily turn and skip allowance; the earlier draft remains recoverable separately',
  );

  await ready(A, url);
  await A.getByRole('heading', { name: 'Bottle unavailable', exact: true }).waitFor();
  await A.evaluate((id) => window.driftTestGame.withdraw(id), id);
  assert.equal(
    (await state(A)).outgoing.some((item) => item.id === id),
    false,
  );
  pass(
    'Reloading the withdrawn link stays unavailable, and the authenticated author can safely repeat withdrawal',
  );

  await release(A2, 'Our captain replaced gravity with glitter.');
  await openOwn(A2, 'Our captain replaced gravity with glitter.');
  assert.equal(await A2.getByRole('dialog').count(), 0);
  pass('A confirmation closed by another author tab cannot reopen itself for a different bottle');

  // Exercise the old-day recovery branch with a synthetic client-side round day.
  // Reducer abandonment, replacement assignment and draft storage remain real.
  await draftBox.fill(draftText);
  await D.evaluate(() => {
    const game = window.driftTestGame;
    const snapshot = game.snapshot;
    const oldId = snapshot().rounds.find((r) => r.stage === 'reply').id;
    const snapshots = new WeakMap();
    game.snapshot = () => {
      const state = snapshot();
      if (!snapshots.has(state))
        snapshots.set(state, {
          ...state,
          rounds: state.rounds.map((r) => (r.id === oldId ? { ...r, day: r.day - 1 } : r)),
        });
      return snapshots.get(state);
    };
    window.recoveryCalls = [];
    const abandon = game.abandon,
      start = game.startCatching;
    game.abandon = async (id) => {
      window.recoveryCalls.push('close');
      return abandon(id);
    };
    game.startCatching = async () => {
      window.recoveryCalls.push('start');
      return start();
    };
  });
  await C.evaluate((id) => window.driftTestGame.withdraw(id), otherId);
  await D.getByText('That beginning is no longer available.', { exact: true }).waitFor();
  await button(D, 'Catch a fresh bottle').click();
  await button(D, 'Open bottle').click();
  await draftBox.waitFor();
  assert.deepEqual(await D.evaluate(() => window.recoveryCalls), ['close', 'start']);
  assert.equal((await state(D)).rounds.find((r) => r.id === draftRound.id).stage, 'done');
  assert.ok((await state(D)).rounds.find((r) => r.stage === 'reply' && r.id !== draftRound.id));
  pass(
    'An injected previous-day unavailable assignment closes its old round before starting a real fresh catch instead of repeatedly reclaiming a closed prompt',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`withdrawal-${engine.toLowerCase()}-checks.json`, out),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        engine,
        scope:
          'Disposable local database; synthetic stories; AI off; clipboard and lost acknowledgement injected. No physical-phone or hosted-withdrawal claim.',
        checks,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
