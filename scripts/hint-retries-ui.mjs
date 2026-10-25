import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (
  !origin?.startsWith('http://127.0.0.1:') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-hint-retries-')
)
  throw Error('Use npm run test:hint-retries.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ reducedMotion: 'reduce' }),
  page = await context.newPage();
const checks = [],
  errors = [],
  calls = [],
  receipts = new Map(),
  pending = new Map();
let mode = 'instant';
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
const good = {
  ok: true,
  message: '',
  hint: 'Consider how the character might misunderstand a perfectly ordinary rule.',
};
page.on('pageerror', (e) => errors.push(e.message));
await page.exposeFunction('testHintTransport', (args) => {
  calls.push(args);
  if (!receipts.has(args.requestId)) receipts.set(args.requestId, { ...good });
  if (mode === 'drop') throw Error('Synthetic hint response lost');
  if (mode === 'hold') return new Promise((resolve) => pending.set(args.requestId, resolve));
  return receipts.get(args.requestId);
});
async function hook() {
  await page.evaluate(async () => {
    const { game } = await import('/src/game.ts'),
      { DbConnection } = await import('/src/module_bindings/index.ts');
    const original = DbConnection.builder;
    DbConnection.builder = () => {
      const builder = original.call(DbConnection),
        onConnect = builder.onConnect.bind(builder);
      builder.onConnect = (callback) =>
        onConnect((conn, ...args) => {
          conn.procedures.requestNudge = (args) => {
            const round = game.snapshot().rounds.find((r) => r.id === args.roundId);
            return window.testHintTransport({
              ...args,
              context: `${round.assignmentId}:${round.version}`,
            });
          };
          const reply = conn.procedures.submitReply.bind(conn.procedures);
          conn.procedures.submitReply = async (args) => {
            if (window.deferActualReply)
              await new Promise((resolve) => {
                window.releaseActualReply = resolve;
              });
            const result = await reply(args);
            if (window.holdActualReply) return new Promise(() => {});
            if (window.dropActualReply) {
              window.dropActualReply = false;
              throw Error('Synthetic reply response lost after local commit');
            }
            return result;
          };
          callback(conn, ...args);
        });
      return builder;
    };
    game.reconnect();
  });
  await waitForGameConnection(page);
}
async function paid(roundId) {
  return page.evaluate(async (roundId) => {
    try {
      return { result: await window.driftTestGame.paid('nudge', roundId, '') };
    } catch (e) {
      return { error: e.message };
    }
  }, roundId);
}
async function cached(roundId) {
  return page.evaluate(async (roundId) => {
    const { game, saved } = await import('/src/game.ts');
    const raw = saved(`drift:request:${game.snapshot().identity}:nudge:${roundId}`);
    return raw ? JSON.parse(raw) : null;
  }, roundId);
}
try {
  await page.goto(origin);
  await waitForGameConnection(page);
  await hook();
  const roundId = await page.evaluate(() => window.driftTestGame.startCatching());
  await page.waitForFunction(() =>
    window.driftTestGame.snapshot().rounds.some((r) => r.stage === 'reply'),
  );
  mode = 'drop';
  assert.match((await paid(roundId)).error, /Synthetic hint response lost/);
  const first = await cached(roundId);
  assert.ok(first.context);
  await page.reload();
  await waitForGameConnection(page);
  await hook();
  mode = 'instant';
  assert.equal((await paid(roundId)).result.ok, true);
  assert.equal(calls.at(-1).requestId, first.id);
  assert.equal(receipts.size, 1);
  assert.equal(await cached(roundId), null);
  pass(
    'A lost hint response survives reload with the original same-assignment request ID; confirmed replay clears its retry text',
  );

  mode = 'hold';
  await page.evaluate((roundId) => {
    window.oldHint = window.driftTestGame.paid('nudge', roundId, '').then(
      (v) => ({ result: v }),
      (e) => ({ error: e.message }),
    );
  }, roundId);
  const old = await cached(roundId);
  await page.evaluate(async (roundId) => {
    await window.driftTestGame.skip(roundId);
    await window.driftTestGame.claim(roundId);
  }, roundId);
  await page.waitForFunction(
    (version) =>
      window.driftTestGame
        .snapshot()
        .rounds.some((r) => r.stage === 'reply' && r.version > version),
    Number(old.context.split(':').at(-1)),
  );
  await page.evaluate((roundId) => {
    window.newHint = window.driftTestGame.paid('nudge', roundId, '').then(
      (v) => ({ result: v }),
      (e) => ({ error: e.message }),
    );
  }, roundId);
  const next = await cached(roundId);
  assert.notEqual(next.id, old.id);
  assert.notEqual(next.context, old.context);
  pending.get(old.id)({
    ok: false,
    message: 'That check belongs to an earlier bottle. Your draft is saved.',
    hint: '',
  });
  const oldResult = await page.evaluate(() => window.oldHint);
  assert.match(oldResult.error, /earlier bottle/);
  assert.equal((await cached(roundId)).id, next.id);
  pending.get(next.id)(good);
  assert.equal((await page.evaluate(() => window.newHint)).result.ok, true);
  assert.equal(await cached(roundId), null);
  pass(
    'Skipping binds a fresh hint ID even for an unchanged empty draft; a late old response cannot erase the newer pending record',
  );

  const legacy = await page.evaluate(async (roundId) => {
    const { game, persist } = await import('/src/game.ts'),
      id = crypto.randomUUID();
    persist(
      `drift:request:${game.snapshot().identity}:nudge:${roundId}`,
      JSON.stringify({ id, text: '' }),
    );
    return id;
  }, roundId);
  mode = 'drop';
  assert.match((await paid(roundId)).error, /Synthetic hint response lost/);
  assert.equal(calls.at(-1).requestId, legacy);
  assert.equal((await cached(roundId)).id, legacy);
  mode = 'instant';
  assert.equal((await paid(roundId)).result.ok, true);
  assert.equal(calls.at(-1).requestId, legacy);
  pass(
    'An older retry cache without assignment metadata preserves its ID for authoritative server replay instead of silently dispatching again',
  );

  const reply = await page.evaluate(async (roundId) => {
    window.dropActualReply = true;
    const text = 'Our lawyers would like another hand.';
    let error = '';
    try {
      await window.driftTestGame.paid('reply', roundId, text);
    } catch (e) {
      error = e.message;
    }
    const { saved } = await import('/src/game.ts'),
      identity = window.driftTestGame.snapshot().identity;
    const raw = JSON.parse(saved(`drift:request:${identity}:reply:${roundId}`));
    return { error, text, requestId: raw.id, context: raw.context };
  }, roundId);
  assert.match(reply.error, /after local commit/);
  await page.waitForFunction(() =>
    window.driftTestGame.snapshot().rounds.some((r) => r.stage === 'done' && r.cardId),
  );
  const cardId = await page.evaluate(
    () => window.driftTestGame.snapshot().rounds.find((r) => r.stage === 'done' && r.cardId).cardId,
  );
  await page.reload();
  await waitForGameConnection(page);
  const replay = await page.evaluate(
    async ({ roundId, text }) => {
      const value = await window.driftTestGame.paid('reply', roundId, text);
      const { saved } = await import('/src/game.ts');
      return {
        ok: value.ok,
        cache: saved(`drift:request:${window.driftTestGame.snapshot().identity}:reply:${roundId}`),
        ids: window.driftTestGame.snapshot().cards.map((c) => c.id),
      };
    },
    { roundId, text: reply.text },
  );
  assert.equal(replay.ok, true);
  assert.equal(replay.cache, '');
  assert.deepEqual(replay.ids, [cardId]);
  pass(
    'A response lost after an actual local reply commit still replays successfully after completion/reload and retains the exact single pair',
  );
  await hook();
  await page
    .getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true })
    .click();
  await page.getByRole('button', { name: 'Open bottle', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Your six-word ending', exact: true })
    .fill('Our lawyers would like another hand.');
  await page.evaluate(() => {
    window.holdActualReply = true;
  });
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Save image', exact: true }).isEnabled(),
    true,
  );
  await page.screenshot({
    path: new URL(
      `../docs/evidence/reply-confirmation-${engine.toLowerCase()}.png`,
      import.meta.url,
    ).pathname,
    fullPage: true,
  });
  pass(
    'An actual reply commit unlocks its exact postcard and Save image through the subscription even when its procedure response never resolves',
  );

  await page.getByRole('button', { name: 'Drift home', exact: true }).click();
  await page
    .getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true })
    .click();
  await page.getByRole('button', { name: 'Open bottle', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Your six-word ending', exact: true })
    .fill('The shark has requested legal counsel.');
  await page.evaluate(() => {
    window.deferActualReply = true;
  });
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await page.waitForFunction(() => !!window.releaseActualReply);
  await page.getByRole('button', { name: 'Drift home', exact: true }).click();
  await page.evaluate(() => window.releaseActualReply());
  await page.waitForFunction(
    () =>
      window.driftTestGame.snapshot().rounds.filter((r) => r.stage === 'done' && r.cardId)
        .length === 3,
  );
  assert.equal(await page.locator('.shore-home').count(), 1);
  await page.getByRole('button', { name: /^My bottles/ }).click();
  assert.equal(await page.locator('.collection-card').count(), 3);
  pass(
    'Navigating away while a reply is pending keeps the chosen view when its real commit arrives; the exact completed pair remains in My bottles',
  );

  const hintContext = await browser.newContext({ reducedMotion: 'reduce' }),
    H = await hintContext.newPage();
  H.on('pageerror', (e) => errors.push(e.message));
  await H.goto(origin);
  await waitForGameConnection(H);
  await H.evaluate(async () => {
    const { game } = await import('/src/game.ts'),
      { DbConnection } = await import('/src/module_bindings/index.ts');
    const snapshot = game.snapshot;
    let previous, decorated;
    // UI-only fixture: the local backend still has no provider key and receives no nudge call.
    game.snapshot = () => {
      const next = snapshot();
      if (next !== previous) {
        previous = next;
        decorated = { ...next, service: next.service && { ...next.service, aiReady: true } };
      }
      return decorated;
    };
    const original = DbConnection.builder;
    window.hintAttempts = [];
    DbConnection.builder = () => {
      const builder = original.call(DbConnection),
        onConnect = builder.onConnect.bind(builder);
      builder.onConnect = (callback) =>
        onConnect((conn, ...args) => {
          conn.procedures.requestNudge = (args) => {
            window.hintAttempts.push(args.requestId);
            if (window.hintAttempts.length === 1)
              return new Promise((resolve) => {
                window.releaseHint = resolve;
              });
            return Promise.resolve({
              ok: true,
              message: '',
              hint: 'Consider another interpretation of the rules.',
            });
          };
          callback(conn, ...args);
        });
      return builder;
    };
    game.reconnect();
  });
  await waitForGameConnection(H);
  await H.getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true }).click();
  await H.getByRole('button', { name: 'Open bottle', exact: true }).click();
  await H.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(
    'My unfinished little ending',
  );
  await H.clock.install();
  await H.locator('.nudge-button').click();
  await H.waitForFunction(() => window.hintAttempts.length === 1);
  await H.clock.fastForward(31000);
  await H.getByRole('alert').filter({ hasText: 'Your hint could not be confirmed' }).waitFor();
  assert.equal(await H.locator('.nudge-button').isEnabled(), true);
  assert.equal(
    await H.getByRole('textbox', { name: 'Your six-word ending', exact: true }).inputValue(),
    'My unfinished little ending',
  );
  await H.locator('.nudge-button').click();
  await H.waitForFunction(() => window.hintAttempts.length === 2);
  assert.equal(await H.evaluate(() => window.hintAttempts[0] === window.hintAttempts[1]), true);
  await H.evaluate(() =>
    window.releaseHint({
      ok: true,
      message: '',
      hint: 'Consider another interpretation of the rules.',
    }),
  );
  pass(
    'A never-resolving Hint restores controls after its deadline, preserves the draft and reuses the original ID on an explicit retry',
  );
  await hintContext.close();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`../docs/evidence/hint-retries-${engine.toLowerCase()}.json`, import.meta.url),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        checks,
        errors,
        mode: 'Disposable local database, real SDK assignment/reply transitions. Hint transport receipts and delayed/lost responses are injected; reply commit/replay is actual local execution with AI off. No provider calls or hosted stories.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  for (const resolve of pending.values()) resolve(good);
  await browser.close();
}
