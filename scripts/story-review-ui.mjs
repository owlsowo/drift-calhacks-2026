import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use the disposable keyless local room.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const out = new URL(`../test-results/story-review/${engine.toLowerCase()}/`, import.meta.url);
const checks = [],
  errors = [],
  contexts = [];
const button = (p, name) => p.getByRole('button', { name, exact: true });
const dialog = (p) => p.getByRole('dialog', { name: 'Give this note another look?', exact: true });
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
async function make(url = origin) {
  const c = await browser.newContext({
    viewport: { width: 320, height: 740 },
    reducedMotion: 'reduce',
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await waitForGameConnection(p);
  assert.equal(await p.evaluate(() => window.driftTestGame.snapshot().service.aiReady), false);
  assert.equal(await p.evaluate(() => window.driftTestGame.snapshot().service.sandbox), true);
  await p.evaluate(() => {
    const game = window.driftTestGame;
    window.reviewCalls = [];
    window.basePaid = game.paid;
    game.paid = async (...args) => {
      window.reviewCalls.push(args);
      if (window.denyReview && args[0] === 'reply')
        throw Error(
          'Keep the joke about the fictional situation, rather than a real person or group.',
        );
      return window.basePaid(...args);
    };
  });
  return p;
}
async function calls(p) {
  return p.evaluate(() => window.reviewCalls);
}
try {
  await fs.mkdir(out, { recursive: true });
  const a = await make();
  const prompt = await a.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  await a.getByRole('button', { name: /^Release a bottle/ }).click();
  const setup = a.getByRole('textbox', { name: 'Your six-word beginning', exact: true });
  const filler = 'hello hello hello hello hello hello';
  await setup.fill(filler);
  await button(a, 'Release').click();
  await expect(dialog(a)).toBeVisible();
  await expect(dialog(a).locator('.review-words')).toHaveText(filler);
  assert.deepEqual(await calls(a), []);
  assert.equal(await a.evaluate(() => window.driftTestGame.snapshot().rounds[0].setupAttempts), 0);
  await dialog(a).press('Escape');
  await expect(dialog(a)).toHaveCount(0);
  await expect(setup).toHaveValue(filler);
  assert.deepEqual(await calls(a), []);
  pass(
    'Repeated setup filler opens a free local review; Escape keeps the exact draft and consumes no server check',
  );
  await setup.fill(prompt.exampleSetup);
  await button(a, 'Release').click();
  await a.locator('.shore-home').waitFor();
  assert.equal((await calls(a)).length, 1);
  const beginningId = await a.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
  pass(
    'An edited ordinary absurd beginning uses the unchanged submission path and reaches a real second writer',
  );
  const b = await make(origin + '/?bottle=' + beginningId);
  await button(b, 'Write an ending').click();
  await button(b, 'Open bottle').click();
  const ending = b.getByRole('textbox', { name: 'Your six-word ending', exact: true });
  const meta = 'what are you saying bruh what';
  await ending.fill(meta);
  await button(b, 'Send reply').click();
  await expect(dialog(b)).toBeVisible();
  await expect(dialog(b)).toContainText(prompt.reply);
  await expect(dialog(b)).toContainText(prompt.exampleSetup);
  assert.deepEqual(await calls(b), []);
  await button(b, 'Keep editing').click();
  await expect(ending).toHaveValue(meta);
  await button(b, 'Send reply').click();
  const scan = await new AxeBuilder({ page: b })
    .include('dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => v.id),
    [],
  );
  assert.equal(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await b.screenshot({ path: new URL('review-320.png', out).pathname, fullPage: true });
  pass(
    'A limited prompt-comment advisory shows the caught beginning and instruction, supports editing, and fits 320px with selected accessibility checks',
  );
  const pause = (paused) => {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/spacetime.mjs',
        paused ? 'pause-test' : 'resume-test',
        process.env.DRIFT_TEST_DATABASE,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, 'Only this disposable database can be paused.');
  };
  pause(true);
  await expect(button(b, 'Send these words anyway')).toBeDisabled();
  assert.deepEqual(await calls(b), []);
  await expect(dialog(b).locator('.review-words')).toHaveText(meta);
  pause(false);
  await expect(button(b, 'Send these words anyway')).toBeEnabled();
  pass(
    'A real local service pause disables send-anyway without discarding the review or bypassing the pause',
  );
  await b.evaluate(async () => {
    const game = window.driftTestGame;
    window.reviewBaseSnapshot = game.snapshot;
    const cache = new WeakMap();
    game.snapshot = () => {
      const base = window.reviewBaseSnapshot();
      let changed = cache.get(base);
      if (!changed) {
        changed = {
          ...base,
          rounds: base.rounds.map((r) =>
            r.stage === 'reply' ? { ...r, version: r.version + 1 } : r,
          ),
        };
        cache.set(base, changed);
      }
      return changed;
    };
    await game.refresh();
  });
  await expect(dialog(b)).toHaveCount(0);
  await expect(b.getByRole('alert')).toContainText('Your bottle changed');
  assert.deepEqual(await calls(b), []);
  await expect(ending).toHaveValue(meta);
  await b.evaluate(async () => {
    window.driftTestGame.snapshot = window.reviewBaseSnapshot;
    await window.driftTestGame.refresh();
  });
  pass(
    'An injected assignment-version change cancels old review approval without dispatching or losing the draft',
  );
  await button(b, 'Send reply').click();
  await b.evaluate(() => {
    window.denyReview = true;
  });
  await button(b, 'Send these words anyway').click();
  await expect(b.getByRole('alert')).toContainText('fictional situation');
  await expect(ending).toHaveValue(meta);
  assert.equal(await b.evaluate(() => window.driftTestGame.snapshot().cards.length), 0);
  let sent = await calls(b);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].length, 3);
  assert.equal(sent[0][0], 'reply');
  assert.equal(sent[0][2], meta);
  pass(
    'An injected safety denial still blocks explicit send-anyway, preserves the draft and sends no override flag or alternate endpoint',
  );
  await b.evaluate(() => {
    window.denyReview = false;
  });
  await button(b, 'Send reply').click();
  await button(b, 'Send these words anyway').click();
  await b.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  await expect(b.locator('.postcard .card-half:not(.setup-half) p')).toHaveText(meta);
  await a.getByRole('button', { name: /^My bottles/ }).click();
  await a.locator('.beginning-preview').click();
  await expect(a.locator('.ending-preview').filter({ hasText: meta })).toBeVisible();
  sent = await calls(b);
  assert.equal(sent.length, 2);
  assert.ok(sent.every((args) => args.length === 3 && args[0] === 'reply' && args[2] === meta));
  assert.equal(await b.evaluate(() => window.driftTestGame.snapshot().rounds.length), 1);
  pass(
    'A deliberate safe send reaches the ordinary keyless local backend and original author once, without rewriting words or allocating a new round',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('checks.json', out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        checks,
        errors,
        scope:
          'Disposable keyless local two-writer room. Real release/reply; injected client version and paid-call denial. No real model safety decision, semantic relevance evaluation, hosted story, human challenge or physical-phone claim.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
}
