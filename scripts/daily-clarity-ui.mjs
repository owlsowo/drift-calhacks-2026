import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL;
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use npm run test:daily-clarity with an isolated local test room.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const out = new URL('../docs/evidence/', import.meta.url);
const checks = [],
  errors = [];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const beginningBox = (page) =>
  page.getByRole('textbox', { name: 'Your six-word beginning', exact: true });
const endingBox = (page) =>
  page.getByRole('textbox', { name: 'Your six-word ending', exact: true });
const receipt = (page) => page.getByRole('group', { name: "Today's turns", exact: true });
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};

async function ready(page, url = origin) {
  await page.goto(url);
  await waitForGameConnection(page);
  const service = await page.evaluate(() => window.driftTestGame.snapshot().service);
  assert.equal(service?.sandbox, true, 'Only a disposable, keyless local sandbox is allowed');
  assert.equal(service.aiReady, false, 'This regression must never use a paid provider');
}
async function make(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: width === 320 ? 740 : 844 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.dailyCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.dailyCopied = text;
        },
      },
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  return page;
}
async function state(page) {
  return page.evaluate(() => {
    const s = (window.dailyBaseSnapshot || window.driftTestGame.snapshot)();
    return { rounds: s.rounds, assignments: s.assignments, outgoing: s.outgoing, cards: s.cards };
  });
}
async function shelf(page) {
  if (!(await page.getByRole('button', { name: /^My bottles/ }).count()))
    await button(page, 'Drift home').click();
  await page.getByRole('button', { name: /^My bottles/ }).click();
  await page.getByRole('heading', { name: 'My bottles', exact: true }).waitFor();
}
async function countIs(page, count) {
  await expect(receipt(page)).toContainText(`${count}/3 turns used today`);
}
async function writeDraft(page, text) {
  await button(page, 'Drift home').click();
  await page.getByRole('button', { name: /^Release a bottle/ }).click();
  await beginningBox(page).fill(text);
  return (await state(page)).rounds.find((round) => round.stage === 'write').id;
}
async function openInvitation(page, id) {
  await ready(page, `${origin}/?bottle=${encodeURIComponent(id)}`);
  await button(page, 'Write an ending').click();
  await button(page, 'Open bottle').click();
  await endingBox(page).waitFor();
  return (await state(page)).rounds.find((round) => round.stage === 'reply');
}
async function storedDraft(page, roundId, suffix) {
  return page.evaluate(
    async ({ roundId, suffix }) => {
      const { saved } = await import('/src/game.ts');
      return saved(`drift:draft:${window.driftTestGame.snapshot().identity}:${roundId}:${suffix}`);
    },
    { roundId, suffix },
  );
}
async function instrument(page) {
  await page.evaluate(() => {
    const game = window.driftTestGame;
    window.dailyCalls = [];
    for (const name of [
      'start',
      'startCatching',
      'startInvited',
      'claim',
      'skip',
      'paid',
      'abandon',
      'withdraw',
    ]) {
      const original = game[name];
      game[name] = (...args) => {
        window.dailyCalls.push(name);
        return original(...args);
      };
    }
  });
}
async function noActions(page) {
  assert.deepEqual(
    await page.evaluate(() => window.dailyCalls),
    [],
    'Reading or resuming must not call a start/claim/skip/publication reducer',
  );
}
async function resetActions(page) {
  await page.evaluate(() => {
    window.dailyCalls = [];
  });
}
// Inject only client-visible edge states. The real local rounds and draft identity stay unchanged.
// Cached snapshots follow useSyncExternalStore's stable-reference contract.
async function clientState(page, patch = {}) {
  await page.evaluate(async (patch) => {
    const game = window.driftTestGame;
    if (!window.dailyBaseSnapshot) {
      window.dailyBaseSnapshot = game.snapshot;
      game.snapshot = () => {
        const base = window.dailyBaseSnapshot();
        let changed = window.dailySnapshots.get(base);
        if (!changed) {
          const current = window.dailyPatch;
          changed = {
            ...base,
            ...(current.disconnected ? { connected: false, connecting: false } : {}),
            service: { ...base.service, ...current.service },
            rounds: base.rounds.map((round) => {
              const values = current.rounds?.[round.id];
              if (!values) return round;
              const { dayDelta, ...fields } = values;
              return { ...round, ...fields, ...(dayDelta ? { day: round.day + dayDelta } : {}) };
            }),
          };
          window.dailySnapshots.set(base, changed);
        }
        return changed;
      };
    }
    window.dailyPatch = patch;
    window.dailySnapshots = new WeakMap();
    // Refresh supplies a real subscription notification; it allocates no round or provider call.
    await game.refresh();
  }, patch);
}
async function missingPrivateRound(page) {
  await page.evaluate(async () => {
    const { driftHistoryState, driftRouteUrl } = await import('/src/navigation.ts');
    const route = { view: 'play', roundId: 'expired-private-history-fixture' };
    const saved = driftHistoryState(route);
    history.pushState(saved, '', driftRouteUrl(location.pathname, route));
    dispatchEvent(new PopStateEvent('popstate', { state: saved }));
  });
  await page.getByRole('heading', { name: 'This round has ended.', exact: true }).waitFor();
}
async function capture(page, name) {
  await page.screenshot({
    path: new URL(`daily-clarity-${engine.toLowerCase()}-${name}.png`, out).pathname,
    fullPage: true,
  });
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) })),
    [],
  );
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'The shelf and receipt fit at 320 CSS pixels',
  );
}

try {
  await fs.mkdir(out, { recursive: true });
  const author = await make(),
    writer = await make(320),
    finisher = await make();
  const prompt = await author.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  const initialDay = await writer.evaluate(() => window.driftTestGame.snapshot().today.day);
  await writeDraft(author, prompt.exampleSetup);
  await button(author, 'Release').click();
  await author.locator('.shore-home').waitFor();
  await author.waitForFunction(() => window.driftTestGame.snapshot().outgoing.length === 1);
  const beginningId = (await state(author)).outgoing[0].id;
  await openInvitation(finisher, beginningId);
  await endingBox(finisher).fill(prompt.exampleReply);
  await button(finisher, 'Send reply').click();
  await finisher.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  const cardId = (await state(finisher)).rounds.find((round) => round.cardId).cardId;

  await shelf(writer);
  await countIs(writer, 0);
  await writer.getByRole('heading', { name: 'No saved bottles yet.', exact: true }).waitFor();
  await button(writer, 'How to play').click();
  const help = writer.getByRole('dialog', { name: 'How to play', exact: true });
  await expect(help.getByRole('group', { name: "Today's turns", exact: true })).toContainText(
    '0/3 turns used today',
  );
  await expect(help).toContainText('shared between beginnings and endings');
  await button(writer, 'Close dialog').click();
  pass(
    'A new writer sees the same daily allowance in My bottles and Help, before allocating a turn',
  );

  const firstDraft = 'My words wait beside your bottle';
  const firstWriteId = await writeDraft(writer, firstDraft);
  await shelf(writer);
  await countIs(writer, 1);
  await writer
    .getByRole('heading', { name: 'A bottle is still in progress.', exact: true })
    .waitFor();
  assert.equal(
    await writer.getByRole('heading', { name: 'No saved bottles yet.', exact: true }).count(),
    0,
  );
  await button(writer, 'Continue your beginning').click();
  await expect(beginningBox(writer)).toHaveValue(firstDraft);

  // Real public links load in the same identity; reading does not acquire another turn or ownership.
  await ready(writer, `${origin}/?bottle=${encodeURIComponent(beginningId)}`);
  await writer.getByRole('heading', { name: 'A drifting beginning', exact: true }).waitFor();
  await writer.locator('.ending-preview').click();
  await expect(writer).toHaveURL(`${origin}/?card=${cardId}`);
  await writer.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  assert.equal(await button(writer, 'Hide').count(), 0);
  assert.equal((await state(writer)).rounds.length, 1);
  await shelf(writer);
  await countIs(writer, 1);
  await button(writer, 'Continue your beginning').click();
  await expect(beginningBox(writer)).toHaveValue(firstDraft);
  pass(
    'Public bottle and reply reading is free, grants no author controls, and leaves the original private beginning intact',
  );

  const replyRound = await openInvitation(writer, beginningId);
  const endingDraft = 'The tiny mailbox demanded better manners';
  await endingBox(writer).fill(endingDraft);
  await instrument(writer);
  await shelf(writer);
  await countIs(writer, 2);
  await expect(button(writer, 'Continue your beginning')).toBeVisible();
  await expect(button(writer, 'Continue your ending')).toBeVisible();
  await writer
    .getByRole('heading', { name: 'Your bottles are still in progress.', exact: true })
    .waitFor();
  assert.equal(await button(writer, 'Write a beginning').count(), 0);
  await capture(writer, 'independent-drafts-320');
  for (let i = 0; i < 2; i++) {
    await button(writer, 'Continue your beginning').click();
    await expect(beginningBox(writer)).toHaveValue(firstDraft);
    await shelf(writer);
    await button(writer, 'Continue your ending').click();
    await expect(endingBox(writer)).toHaveValue(endingDraft);
    await shelf(writer);
  }
  await noActions(writer);
  assert.equal((await state(writer)).rounds.length, 2);
  assert.equal(
    (await state(writer)).rounds.find((round) => round.id === replyRound.id).assignmentId,
    beginningId,
  );
  assert.equal(await storedDraft(writer, firstWriteId, 'setup'), firstDraft);
  assert.equal(await storedDraft(writer, replyRound.id, beginningId), endingDraft);
  pass(
    'Separate beginning and ending continuations restore their own exact drafts and assignment, without starting, claiming, skipping or submitting anything',
  );

  await clientState(writer, { rounds: { [replyRound.id]: { dayDelta: -1 } } });
  await countIs(writer, 1);
  await button(writer, 'Continue your ending').click();
  await expect(endingBox(writer)).toHaveValue(endingDraft);
  await expect(button(writer, 'Send reply')).toBeEnabled();
  await noActions(writer);
  await shelf(writer);
  await clientState(writer);
  await countIs(writer, 2);
  pass(
    'An injected prior-day ending with a still-valid lease remains resumable and is excluded from today’s turn count',
  );

  await clientState(writer, {
    rounds: { [firstWriteId]: { setupAttempts: 3 }, [replyRound.id]: { replyAttempts: 3 } },
  });
  await button(writer, 'Review your beginning').click();
  await expect(beginningBox(writer)).toHaveValue(firstDraft);
  await expect(button(writer, 'Release')).toBeDisabled();
  await shelf(writer);
  await button(writer, 'Review your ending').click();
  await expect(endingBox(writer)).toHaveValue(endingDraft);
  await expect(button(writer, 'Send reply')).toBeDisabled();
  await noActions(writer);
  await shelf(writer);
  await clientState(writer);
  pass(
    'Injected exhausted checks offer review for both drafts and disable publication, without allocating replacement turns',
  );

  await clientState(writer, { rounds: { [replyRound.id]: { leaseMs: 0 } } });
  await button(writer, 'Review your ending').click();
  await expect(endingBox(writer)).toHaveValue(endingDraft);
  await writer.getByText('This bottle has drifted on.', { exact: true }).waitFor();
  await expect(button(writer, 'Send reply')).toBeDisabled();
  await noActions(writer);
  await shelf(writer);
  await countIs(writer, 2);
  await clientState(writer);
  pass(
    'An injected expired lease changes the ending to Review without silently claiming another bottle or discarding its words',
  );

  await clientState(writer, { service: { paused: true } });
  await button(writer, 'Continue your beginning').click();
  await expect(beginningBox(writer)).toHaveValue(firstDraft);
  await shelf(writer);
  // An expired/unavailable writing pass is simulated on the client; never verify a real token.
  await writer.evaluate(() => {
    window.driftTestGame.verifyGate = async () => {
      throw Error('Synthetic expired writing pass');
    };
  });
  await clientState(writer, { service: { botRequired: true } });
  await button(writer, 'Continue your ending').click();
  await expect(endingBox(writer)).toHaveValue(endingDraft);
  await expect(button(writer, 'Send reply')).toBeDisabled();
  await noActions(writer);
  await shelf(writer);
  await clientState(writer);
  pass(
    'Existing drafts remain readable while the client sees a paused service or expired writing pass; a missing pass still blocks publication',
  );

  await author.evaluate((id) => window.driftTestGame.withdraw(id), beginningId);
  await writer.waitForFunction(
    (id) => !window.driftTestGame.snapshot().assignments.some((item) => item.id === id),
    beginningId,
  );
  await expect(button(writer, 'Continue your ending')).toHaveCount(0);
  await button(writer, 'Review your ending').click();
  await expect(endingBox(writer)).toHaveValue(endingDraft);
  await writer.getByText('That beginning is no longer available.', { exact: true }).waitFor();
  await expect(button(writer, 'Send reply')).toBeDisabled();
  await button(writer, 'Copy my draft').click();
  assert.equal(await writer.evaluate(() => window.dailyCopied), endingDraft);
  await noActions(writer);
  await shelf(writer);
  await countIs(writer, 2);
  await shelf(author);
  await countIs(author, 1);
  pass(
    'A real author withdrawal changes the live continuation to Review, preserves copyable ending words, and refunds neither writer’s used turn',
  );

  // Real close/start operations produce three consumed turns, while retaining an independent ending.
  await writer.evaluate((id) => window.driftTestGame.abandon(id), firstWriteId);
  await writer.waitForFunction(
    (id) =>
      window.driftTestGame.snapshot().rounds.find((round) => round.id === id)?.stage === 'done',
    firstWriteId,
  );
  const finalDraft = 'Another beginning waits inside this bottle';
  const finalWriteId = await writeDraft(writer, finalDraft);
  await resetActions(writer);
  await shelf(writer);
  await countIs(writer, 3);
  await button(writer, 'Continue your beginning').click();
  await expect(beginningBox(writer)).toHaveValue(finalDraft);
  await noActions(writer);
  await missingPrivateRound(writer);
  await button(writer, 'Continue your beginning').click();
  await expect(beginningBox(writer)).toHaveValue(finalDraft);
  await noActions(writer);
  assert.equal((await state(writer)).rounds.length, 3);
  pass(
    'At three used turns, both the shelf and stale private-history recovery resume an existing beginning without an additional start',
  );

  await writer.evaluate(
    async (ids) => {
      for (const id of ids) await window.driftTestGame.abandon(id);
    },
    [finalWriteId, replyRound.id],
  );
  await writer.waitForFunction(() =>
    window.driftTestGame.snapshot().rounds.every((round) => round.stage === 'done'),
  );
  await resetActions(writer);
  await shelf(writer);
  await countIs(writer, 3);
  await writer.getByRole('heading', { name: 'Your words are saved here.', exact: true }).waitFor();
  await expect(button(writer, 'Write a beginning')).toBeDisabled();
  await button(writer, 'How to play').click();
  await expect(
    writer.getByRole('dialog').getByRole('group', { name: "Today's turns", exact: true }),
  ).toContainText('3/3 turns used today');
  await button(writer, 'Close dialog').click();
  await missingPrivateRound(writer);
  await expect(button(writer, 'Write a beginning')).toBeDisabled();
  await noActions(writer);
  assert.equal((await state(writer)).rounds.length, 3);
  assert.equal(await storedDraft(writer, firstWriteId, 'setup'), firstDraft);
  assert.equal(await storedDraft(writer, finalWriteId, 'setup'), finalDraft);
  await capture(writer, 'quota-closed-round-320');
  pass(
    'Closing all three rounds never refunds quota; empty shelf and missing-round recovery block a fourth start while keeping both beginning drafts',
  );

  await shelf(writer);
  await clientState(writer, { disconnected: true });
  await expect(receipt(writer)).toHaveCount(0);
  await button(writer, 'How to play').click();
  await expect(
    writer.getByRole('dialog').getByRole('group', { name: "Today's turns", exact: true }),
  ).toHaveCount(0);
  await button(writer, 'Close dialog').click();
  await clientState(writer);
  await countIs(writer, 3);
  await noActions(writer);
  pass(
    'Disconnected client state hides the numeric allowance in both Help and the shelf instead of presenting stale quota as current',
  );

  const oldWriter = await make(320);
  const oldDraft = 'Yesterday I wrote this little secret';
  const oldId = await writeDraft(oldWriter, oldDraft);
  await instrument(oldWriter);
  await clientState(oldWriter, { rounds: { [oldId]: { dayDelta: -1 } } });
  await shelf(oldWriter);
  await countIs(oldWriter, 0);
  await oldWriter
    .getByRole('heading', { name: 'Your words are saved here.', exact: true })
    .waitFor();
  assert.equal(await button(oldWriter, 'Continue your beginning').count(), 0);
  assert.equal(await button(oldWriter, 'Review your beginning').count(), 0);
  await oldWriter.getByText('Your earlier words', { exact: true }).click();
  await oldWriter.getByText(oldDraft, { exact: true }).waitFor();
  await button(oldWriter, 'Copy this draft').click();
  assert.equal(await oldWriter.evaluate(() => window.dailyCopied), oldDraft);
  assert.equal(await storedDraft(oldWriter, oldId, 'setup'), oldDraft);
  await noActions(oldWriter);
  assert.equal((await state(oldWriter)).rounds.length, 1);
  await capture(oldWriter, 'earlier-words-320');
  pass(
    'An injected previous-day beginning is offered as copy-only earlier words, not a resumable current turn, and copying leaves the private draft unchanged',
  );

  const catcher = await make(320);
  await catcher.evaluate(() => window.driftTestGame.startCatching());
  await catcher.waitForFunction(() =>
    window.driftTestGame
      .snapshot()
      .rounds.some((round) => ['catch', 'reply'].includes(round.stage)),
  );
  const catchBefore = await state(catcher);
  const catchId = catchBefore.rounds[0].id;
  // The stocked test room assigns immediately. Project the empty-pool stage to check
  // that merely resuming it does not issue another claim or start request.
  await clientState(catcher, {
    rounds: { [catchId]: { stage: 'catch', assignmentId: '', leaseMs: 0 } },
  });
  await instrument(catcher);
  await shelf(catcher);
  await countIs(catcher, 1);
  await button(catcher, 'Continue picking up').click();
  await catcher
    .getByRole('heading', { name: 'Find a bottle on the shore', exact: true })
    .waitFor({ state: 'attached' });
  await noActions(catcher);
  assert.equal((await state(catcher)).rounds.length, 1);
  assert.equal((await state(catcher)).rounds[0].id, catchId);
  assert.deepEqual((await state(catcher)).assignments, catchBefore.assignments);
  pass(
    'Resuming an injected empty-pool pickup stage reopens the shore without issuing a claim, changing its real assignment or consuming a second turn',
  );

  assert.equal(
    await writer.evaluate(() => window.driftTestGame.snapshot().today.day),
    initialDay,
    'The test must not straddle an actual daily reset',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`daily-clarity-${engine.toLowerCase()}-checks.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        scope:
          'Disposable local database, real start/close/withdraw/assignment state and synthetic stories; provider key absent. Prior-day rounds, exhausted checks, empty-pool pickup stage, pause/gate and disconnection are explicitly injected client states. No hosted, physical-phone, real midnight, or paid-model claim.',
        checks,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
