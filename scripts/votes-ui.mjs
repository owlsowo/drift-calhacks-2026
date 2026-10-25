import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL,
  database = process.env.DRIFT_TEST_DATABASE;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '') || !database?.startsWith('drift-test-'))
  throw Error('Use the keyless local test room.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const checks = [],
  errors = [],
  contexts = [];
const out = new URL('../docs/evidence/', import.meta.url);
const button = (p, name) => p.getByRole('button', { name, exact: true });
const mainVote = (p) => p.locator('.postcard-vote .ending-upvote');
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
async function make(url = origin) {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await waitForGameConnection(p);
  if (url.includes('?card=')) await p.locator('.postcard-paper.paper-open').waitFor();
  const service = await p.evaluate(() => window.driftTestGame.snapshot().service);
  assert.equal(service.sandbox, true);
  assert.equal(service.aiReady, false);
  return p;
}
async function end(p, url, text) {
  await p.goto(url);
  await waitForGameConnection(p);
  await button(p, 'Write an ending').click();
  await button(p, 'Open bottle').click();
  await p.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(text);
  await button(p, 'Send reply').click();
  await p.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  return p.evaluate(() => window.driftTestGame.snapshot().rounds.find((r) => r.cardId).cardId);
}
const rowVote = (p, text) =>
  p
    .locator('.ending-entry')
    .filter({ has: p.getByText(text, { exact: true }) })
    .locator('.ending-upvote');
async function count(p, selector, n) {
  await expect(selector.locator('strong')).toHaveText(String(n));
}
function pause(value) {
  const r = spawnSync(
    process.execPath,
    ['scripts/spacetime.mjs', value ? 'pause-test' : 'resume-test', database],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0, 'Only this disposable test room is paused/resumed.');
}
try {
  await fs.mkdir(out, { recursive: true });
  const a = await make(),
    b = await make(),
    c = await make();
  const prompt = await a.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  await a.getByRole('button', { name: /^Release a bottle/ }).click();
  await a
    .getByRole('textbox', { name: 'Your six-word beginning', exact: true })
    .fill(prompt.exampleSetup);
  await button(a, 'Release').click();
  await a.locator('.shore-home').waitFor();
  const beginning = await a.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
  const bottleUrl = origin + '/?bottle=' + beginning;
  const first = await end(b, bottleUrl, prompt.exampleReply);
  const secondText = 'Nobody approved your suspicious little plan.';
  await end(c, bottleUrl, secondText);
  await b.getByRole('button', { name: /Read all 2 endings/ }).click();
  await expect(b.locator('.ending-preview')).toHaveCount(2);
  assert.equal((await b.evaluate(() => window.driftTestGame.snapshot().rounds)).length, 1);
  await expect(rowVote(b, prompt.exampleReply)).toBeVisible();
  await expect(rowVote(b, secondText)).toBeVisible();
  pass(
    'An ending responder can open the explicit all-endings route, read both replies and see vote controls without another writing turn',
  );
  const d = await make(origin + '/?card=' + first);
  await count(d, mainVote(d), 0);
  assert.equal(await button(d, 'Hide').count(), 0);
  assert.equal(await d.locator('.co-writer-thanks').count(), 0);
  await d.evaluate(() => {
    const original = window.driftTestGame.vote;
    window.voteDispatches = 0;
    window.driftTestGame.vote = async (...args) => {
      window.voteDispatches++;
      await original(...args);
      return new Promise(() => {});
    };
  });
  await mainVote(d).click();
  await expect(mainVote(d)).toHaveAttribute('aria-pressed', 'true');
  await expect(mainVote(d)).toBeEnabled();
  await count(d, mainVote(d), 1);
  await count(b, rowVote(b, prompt.exampleReply), 1);
  assert.equal(await d.evaluate(() => window.voteDispatches), 1);
  pass(
    'A public guest upvote arrives live for a co-writer, and subscription confirmation unlocks a deliberately lost reducer acknowledgement with one dispatch',
  );
  await d.reload();
  await waitForGameConnection(d);
  await expect(mainVote(d)).toHaveAttribute('aria-pressed', 'true');
  await count(d, mainVote(d), 1);
  const e = await make(origin + '/?card=' + first);
  await expect(mainVote(e)).toHaveAttribute('aria-pressed', 'false');
  await count(e, mainVote(e), 1);
  await mainVote(e).click();
  try {
    await expect(mainVote(e)).toHaveAttribute('aria-pressed', 'true');
    await count(d, mainVote(d), 2);
  } catch (error) {
    console.log(
      'Vote diagnostic',
      await e.evaluate(() => ({
        votes: window.driftTestGame.snapshot().votes,
        totals: window.driftTestGame.snapshot().voteTotals,
        alerts: [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent),
      })),
    );
    await e.screenshot({ path: new URL('vote-diagnostic.png', out).pathname, fullPage: true });
    throw error;
  }
  await expect(mainVote(e)).toHaveAttribute('aria-pressed', 'true');
  pass(
    'Reload preserves the same guest selection without duplicating it; a fresh identity sees the shared total but has its own independent selection',
  );
  pause(true);
  await d.waitForFunction(() => window.driftTestGame.snapshot().service.paused);
  await expect(mainVote(d)).toBeEnabled();
  await mainVote(d).click();
  await expect(mainVote(d)).toHaveAttribute('aria-pressed', 'false');
  await count(e, mainVote(e), 1);
  await expect(mainVote(d)).toBeDisabled();
  pause(false);
  await d.waitForFunction(() => !window.driftTestGame.snapshot().service.paused);
  pass(
    'Undo works during a real local service pause; adding a new vote stays blocked until writing is reopened',
  );
  const f = await make(origin + '/?card=' + first);
  await f.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: '/* inert challenge resource; never grants a pass */',
    }),
  );
  await f.evaluate(async () => {
    const g = window.driftTestGame,
      original = g.snapshot;
    const cache = new WeakMap();
    window.gatedVoteCalls = 0;
    // This keyless room would accept an empty preflight. Model an expired pass
    // by rejecting it, never by faking a successful verification callback.
    g.verifyGate = async () => {
      throw Error('Injected expired human check');
    };
    const vote = g.vote;
    g.vote = (...args) => {
      window.gatedVoteCalls++;
      return vote(...args);
    };
    g.snapshot = () => {
      const base = original();
      let changed = cache.get(base);
      if (!changed) {
        changed = { ...base, service: { ...base.service, botRequired: true } };
        cache.set(base, changed);
      }
      return changed;
    };
    await g.refresh();
  });
  await expect(mainVote(f)).toContainText('Verify to upvote');
  await mainVote(f).click();
  await f.getByRole('dialog', { name: 'Keep the votes human', exact: true }).waitFor();
  assert.equal(await f.evaluate(() => window.gatedVoteCalls), 0);
  await count(e, mainVote(e), 1);
  await button(f, 'Close dialog').click();
  pass(
    'An injected expired human-check state opens verification before any vote dispatch; no challenge is solved or pass granted',
  );
  const denied = await f.evaluate(async (database) => {
    const { DbConnection } = await import('/src/module_bindings/index.ts');
    let conn;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        conn?.disconnect();
        resolve(false);
      }, 8000);
      const finish = (value) => {
        clearTimeout(timer);
        conn?.disconnect();
        resolve(value);
      };
      conn = DbConnection.builder()
        .withUri('http://127.0.0.1:3000')
        .withDatabaseName(database)
        .onConnect((c) => {
          c.subscriptionBuilder()
            .onApplied(() => finish(false))
            .onError(() => finish(true))
            .subscribe('SELECT * FROM card_vote');
        })
        .onConnectError(() => finish(false))
        .build();
    });
  }, database);
  assert.equal(denied, true);
  pass('A fresh local SDK identity cannot subscribe to individual private vote records');
  await a.goto(bottleUrl);
  await waitForGameConnection(a);
  await a.setViewportSize({ width: 320, height: 740 });
  await count(a, rowVote(a, prompt.exampleReply), 1);
  await count(a, rowVote(a, secondText), 0);
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const scan = await new AxeBuilder({ page: a })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => v.id),
    [],
  );
  await a.screenshot({
    path: new URL(`ending-votes-${engine.toLowerCase()}-320.png`, out).pathname,
    fullPage: true,
  });
  for (const p of [d, e, f])
    assert.equal((await p.evaluate(() => window.driftTestGame.snapshot().rounds)).length, 0);
  pass(
    'Public readers vote without writing turns, and the full ending/thanks/date/vote layout fits a narrow phone with selected accessibility checks',
  );
  await a.evaluate((id) => window.driftTestGame.withdraw(id), beginning);
  await e.getByRole('heading', { name: 'Reply unavailable', exact: true }).waitFor();
  await e.waitForFunction(
    () =>
      window.driftTestGame.snapshot().voteTotals.length === 0 &&
      window.driftTestGame.snapshot().votes.length === 0,
  );
  assert.equal(await mainVote(e).count(), 0);
  pass(
    'A real author withdrawal removes both public pairs, live totals, personal selections and vote controls for subscribed readers',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`ending-votes-${engine.toLowerCase()}.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        checks,
        errors,
        scope:
          'Real disposable keyless local multi-writer/reader flow, SDK privacy denial, real local pause/withdrawal, lost acknowledgement, injected verification state and denied empty-pass preflight. No paid model, production story, solved challenge or physical-phone claim.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
