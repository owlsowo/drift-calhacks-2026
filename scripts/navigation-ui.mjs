import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use npm run test:navigation.');
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
    path: new URL(`navigation-${engine.toLowerCase()}-${name}.png`, out).pathname,
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
    { page: C } = await make(390);
  const prompt = await A.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  setupText = prompt.exampleSetup;
  replyText = prompt.exampleReply;
  await release(A, setupText);
  await openOwn(A, setupText);
  const url = await invitation(A),
    beginningId = (await state(A)).outgoing[0].id;
  await ready(B, url);
  await enter(B);
  await finish(B);
  const ownPair = (await state(B)).rounds.find((r) => r.cardId).cardId;
  await expect(B).toHaveURL(`${origin}/?card=${ownPair}`);
  await button(B, 'View this bottle').click();
  await expect(B).toHaveURL(`${origin}/?bottle=${beginningId}`);
  await B.locator('.ending-preview').click();
  await expect(B).toHaveURL(`${origin}/?card=${ownPair}`);
  await B.goBack();
  await expect(B).toHaveURL(`${origin}/?bottle=${beginningId}`);
  await B.getByRole('heading', { name: 'A drifting beginning', exact: true }).waitFor();
  await B.goForward();
  await expect(B).toHaveURL(`${origin}/?card=${ownPair}`);
  await B.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  assert.equal((await state(B)).rounds.length, 1);
  pass(
    'The displayed beginning and pair match their URLs; in-app Back/Forward reopens them without consuming another turn',
  );

  await ready(C, url);
  await enter(C);
  await finish(C, 'Nobody approved your suspicious little plan.');
  const otherPair = (await state(C)).rounds.find((r) => r.cardId).cardId;
  const alternatives = B.getByRole('button', { name: /Read all 2 endings to this beginning/ });
  await alternatives.waitFor();
  assert.match(await alternatives.innerText(), /2/);
  await alternatives.click();
  await B.getByRole('heading', { name: '2 replies', exact: true }).waitFor();
  await B.locator('.ending-preview').filter({ hasText: 'Nobody approved' }).click();
  await expect(B).toHaveURL(`${origin}/?card=${otherPair}`);
  assert.equal(await button(B, 'Hide').count(), 0);
  assert.equal(await B.locator('.co-writer-thanks').count(), 0);
  await B.reload();
  await waitForGameConnection(B);
  await B.getByText('Nobody approved your suspicious little plan.', { exact: true }).waitFor();
  await expect(B).toHaveURL(`${origin}/?card=${otherPair}`);
  await capture(B, 'other-ending');
  pass(
    'The count of alternative endings updates live; opening and reloading another writer’s pair preserves its exact public link without author privileges',
  );
  await button(B, 'Report').click();
  await button(B, 'Something else feels wrong').click();
  await B.getByRole('heading', { name: 'Reply unavailable', exact: true }).waitFor();
  await ready(B, `${origin}/?card=${ownPair}`);
  await button(B, 'View this bottle').waitFor();
  assert.equal(
    await B.getByRole('button', { name: /Read all 2 endings to this beginning/ }).count(),
    0,
  );
  assert.ok((await state(A)).cards.some((card) => card.id === otherPair));
  pass(
    'Alternative-ending counts exclude this viewer’s reported pair without hiding another writer’s public story for everyone',
  );

  await button(B, 'Drift home').click();
  await expect(B).toHaveURL(`${origin}/`);
  await B.reload();
  await waitForGameConnection(B);
  await B.locator('.shore-home').waitFor();
  await B.getByRole('button', { name: /^My bottles/ }).click();
  await expect(B).toHaveURL(`${origin}/?view=bottles`);
  await B.reload();
  await waitForGameConnection(B);
  await B.getByRole('heading', { name: 'My bottles', exact: true }).waitFor();
  assert.equal((await state(B)).rounds.length, 1);
  pass(
    'Home clears the stale story URL and My bottles reloads as the shelf, with no new rounds from read-only navigation',
  );

  await button(B, 'Drift home').click();
  await B.getByRole('button', { name: /^Release a bottle/ }).click();
  const draftBox = B.getByRole('textbox', { name: 'Your six-word beginning', exact: true });
  const draft = 'A draft kept between two tides';
  await draftBox.fill(draft);
  const activeId = (await state(B)).rounds.find((r) => r.stage === 'write').id;
  assert.equal(new URL(B.url()).search, '');
  assert.equal(B.url().includes(activeId), false);
  assert.equal(
    await B.evaluate((text) => JSON.stringify(history.state).includes(text), draft),
    false,
  );
  await B.goBack();
  await B.locator('.shore-home').waitFor();
  await B.goForward();
  await expect(draftBox).toHaveValue(draft);
  await B.reload();
  await waitForGameConnection(B);
  await expect(draftBox).toHaveValue(draft);
  assert.equal((await state(B)).rounds.filter((r) => r.stage === 'write').length, 1);
  pass(
    'Private play survives Back/Forward and reload with its draft and same round; draft text and private round ID never enter the URL',
  );

  const { page: D } = await make(390);
  await D.evaluate(() => {
    const start = window.driftTestGame.start;
    window.driftTestGame.start = async () => {
      await start();
      return new Promise(() => {});
    };
  });
  await D.getByRole('button', { name: /^Release a bottle/ }).click();
  await D.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).waitFor();
  assert.equal((await state(D)).rounds.length, 1);
  assert.equal(await D.getByText('Opening your bottle…', { exact: true }).count(), 0);
  pass(
    'A real beginning round opens from subscription confirmation even when its reducer acknowledgement is lost, consuming exactly one turn',
  );

  const { page: E } = await make(390);
  await E.evaluate(() => {
    window.driftTestGame.start = async () => {
      throw Error('This start was rejected.');
    };
  });
  await E.getByRole('button', { name: /^Release a bottle/ }).click();
  await E.getByText('This start was rejected.', { exact: true }).waitFor();
  assert.equal((await state(E)).rounds.length, 0);
  assert.equal(
    await E.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).count(),
    0,
  );
  await expect(E.getByRole('button', { name: /^Release a bottle/ })).toBeEnabled();
  pass('A rejected start restores controls and does not invent an editor or create another round');

  const { page: F } = await make(390);
  await ready(F, url);
  await button(F, 'Drift home').click();
  await F.evaluate(() => {
    const original = window.driftTestGame.start;
    window.driftTestGame.start = async () => {
      await new Promise((resolve) => {
        window.finishDelayedStart = resolve;
      });
      return original();
    };
  });
  await F.getByRole('button', { name: /^Release a bottle/ }).click();
  await F.goBack();
  await expect(F).toHaveURL(url);
  await F.evaluate(() => window.finishDelayedStart());
  await F.waitForFunction(() =>
    window.driftTestGame.snapshot().rounds.some((r) => r.stage === 'write'),
  );
  await F.getByRole('heading', { name: 'A drifting beginning', exact: true }).waitFor();
  assert.equal(
    await F.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).count(),
    0,
  );
  assert.equal((await state(F)).rounds.length, 1);
  pass(
    'A beginning committed after browser Back cannot pull the reader out of their chosen public bottle',
  );

  await B.evaluate((id) => {
    const game = window.driftTestGame,
      snapshot = game.snapshot,
      snapshots = new WeakMap();
    game.snapshot = () => {
      const state = snapshot();
      if (!snapshots.has(state))
        snapshots.set(state, {
          ...state,
          rounds: state.rounds.map((r) => (r.id === id ? { ...r, day: r.day - 1 } : r)),
        });
      return snapshots.get(state);
    };
    window.closedTideCalls = [];
    const abandon = game.abandon,
      start = game.start,
      paid = game.paid;
    game.abandon = async (id) => {
      window.closedTideCalls.push('close');
      return abandon(id);
    };
    game.start = async () => {
      window.closedTideCalls.push('start');
      return start();
    };
    game.paid = async (...args) => {
      window.closedTideCalls.push('paid');
      return paid(...args);
    };
  }, activeId);
  await draftBox.focus();
  await B.getByText('This tide has closed.', { exact: true }).waitFor();
  await expect(button(B, 'Release')).toBeDisabled();
  assert.equal(await draftBox.inputValue(), draft);
  assert.equal(await draftBox.evaluate((el) => el === document.activeElement), true);
  await button(B, 'Copy my draft').click();
  assert.equal(await B.evaluate(() => window.testCopied), draft);
  await button(B, 'Start today’s beginning').click();
  await expect(draftBox).toHaveValue('');
  assert.deepEqual(await B.evaluate(() => window.closedTideCalls), ['close', 'start']);
  const newRound = (await state(B)).rounds.find((r) => r.stage === 'write');
  assert.ok(newRound && newRound.id !== activeId);
  const savedDraft = await B.evaluate(async (id) => {
    const { saved } = await import('/src/game.ts');
    return saved(`drift:draft:${window.driftTestGame.snapshot().identity}:${id}:setup`);
  }, activeId);
  assert.equal(savedDraft, draft);
  await capture(B, 'new-tide');
  pass(
    'An injected closed-day beginning disables paid publication, preserves focused copyable text and explicitly opens a fresh empty current round while retaining the old draft',
  );

  const failedDraft = 'My beginning stays through this failure';
  await D.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(failedDraft);
  const failedRound = (await state(D)).rounds.find((r) => r.stage === 'write').id;
  const priorRoundCount = (await state(D)).rounds.length;
  await D.evaluate((id) => {
    const game = window.driftTestGame,
      snapshot = game.snapshot,
      snapshots = new WeakMap();
    game.snapshot = () => {
      const current = snapshot();
      if (!snapshots.has(current))
        snapshots.set(current, {
          ...current,
          rounds: current.rounds.map((r) => (r.id === id ? { ...r, day: r.day - 1 } : r)),
        });
      return snapshots.get(current);
    };
    game.start = async () => {
      throw Error('Three little stories is today’s limit. Come back after the tide turns.');
    };
  }, failedRound);
  await D.getByText('This tide has closed.', { exact: true }).waitFor();
  await button(D, 'Start today’s beginning').click();
  await D.locator('.shore-home').waitFor();
  await D.getByText('Three little stories is today’s limit. Come back after the tide turns.', {
    exact: true,
  }).waitFor();
  assert.equal((await state(D)).rounds.length, priorRoundCount);
  assert.equal((await state(D)).rounds.find((r) => r.id === failedRound).stage, 'done');
  assert.equal((await state(D)).rounds.filter((r) => r.stage === 'write').length, 0);
  const retainedFailedDraft = await D.evaluate(async (id) => {
    const { saved } = await import('/src/game.ts');
    return saved(`drift:draft:${window.driftTestGame.snapshot().identity}:${id}:setup`);
  }, failedRound);
  assert.equal(retainedFailedDraft, failedDraft);
  await expect(D.getByRole('button', { name: /^Release a bottle/ })).toBeEnabled();
  pass(
    'If a new-tide start fails after the old round closes, Home keeps the failure visible and the old draft intact without allocating another turn',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`navigation-${engine.toLowerCase()}-checks.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        scope:
          'Disposable real local state and synthetic stories, AI off; old-day client state, lost start receipt and clipboard injected. No physical-phone or overnight-use claim.',
        checks,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
