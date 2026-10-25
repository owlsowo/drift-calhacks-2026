import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use the disposable local test room.');
const baseline = process.env.DRIFT_SHELF_BASELINE === 'true';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.shelfFormatting = 0;
  for (const name of ['toLocaleDateString', 'toLocaleString']) {
    const original = Date.prototype[name];
    Date.prototype[name] = function (...args) {
      window.shelfFormatting++;
      return original.apply(this, args);
    };
  }
});
try {
  await page.goto(origin + '/?view=bottles');
  await waitForGameConnection(page);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox), true);
  await page.evaluate(async () => {
    const game = window.driftTestGame,
      original = game.snapshot;
    const day = original().today.day;
    const prompt = JSON.parse(original().today.promptJson);
    let cards = Array.from({ length: 30 }, (_, i) => ({
      id: `shelf-fixture-${i}`,
      beginningId: `shelf-beginning-${i}`,
      promptId: prompt.id,
      setup: prompt.exampleSetup,
      reply: prompt.exampleReply,
      createdMs: day * 86400000 + i * 60000,
      seeded: false,
    }));
    let appreciation = [];
    let cache = new WeakMap();
    game.snapshot = () => {
      const base = original();
      let changed = cache.get(base);
      if (!changed) {
        changed = {
          ...base,
          cards,
          appreciation,
          outgoing: [],
          ownership: [],
          reported: [],
          rounds: [],
          book: { beginningIds: [], pairIds: cards.map((c) => c.id) },
        };
        cache.set(base, changed);
      }
      return changed;
    };
    window.changeShelfFixture = async () => {
      cards = cards.map((c, i) =>
        i ? c : { ...c, reply: 'Your secret was actually a lighthouse.' },
      );
      cards.push({ ...cards[0], id: 'shelf-fixture-30', createdMs: day * 86400000 + 31 * 60000 });
      appreciation = [{ cardId: cards[0].id, sent: false, received: true }];
      cache = new WeakMap();
      await game.refresh();
    };
    await game.refresh();
  });
  await expect(page.locator('.collection-card')).toHaveCount(30);
  await page.evaluate(() => {
    window.shelfFormatting = 0;
  });
  await page.waitForTimeout(2300);
  const repeatedDateFormats = await page.evaluate(() => window.shelfFormatting);
  if (baseline)
    assert.ok(
      repeatedDateFormats >= 60,
      'The baseline reproduces repeated formatting over at least two clock ticks.',
    );
  else
    assert.ok(
      repeatedDateFormats < 6,
      'Unchanged postcards must not repeat their date formatting on each parent clock tick.',
    );
  await page.evaluate(() => window.changeShelfFixture());
  await expect(page.locator('.collection-card')).toHaveCount(31);
  await expect(
    page
      .locator('.collection-card')
      .filter({ has: page.locator('[data-card-id="shelf-fixture-0"]') }),
  ).toContainText('Your secret was actually a lighthouse.');
  await expect(page.locator('.collection-card .thanks-label')).toHaveCount(1);
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    variant: baseline ? 'baseline' : 'memoized',
    cards: 30,
    sampleMs: 2300,
    repeatedDateFormats,
    newCardVisible: true,
    changedStoryVisible: true,
    receivedThanksVisible: true,
    errors,
    scope:
      'Local synthetic client projection with stable immutable card rows and actual parent clock ticks; date-format calls only, not FPS, GPU, physical-phone or population performance. No story writes or provider calls.',
  };
  await fs.writeFile(
    new URL(
      `../docs/evidence/shelf-render-${baseline ? 'baseline' : 'after'}.json`,
      import.meta.url,
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
