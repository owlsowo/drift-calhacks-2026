import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL || 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error('Use a local test server.');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.DRIFT_CHROMIUM_PATH ? { executablePath: process.env.DRIFT_CHROMIUM_PATH } : {}),
});
try {
  const errors = [];
  async function page(url = origin) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await waitForGameConnection(page);
    assert.equal(
      await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox),
      true,
      'Only a keyless local sandbox is allowed.',
    );
    return page;
  }
  const author = await page();
  await author.getByRole('button', { name: /^Release a bottle/ }).click();
  await author
    .getByRole('textbox', { name: 'Your six-word beginning', exact: true })
    .fill('I taught dolphins to play poker.');
  await author.getByRole('button', { name: 'Release', exact: true }).click();
  await author.locator('.shore-home').waitFor();
  const beginningId = await author.evaluate(
    () => window.driftTestGame.snapshot().book.beginningIds[0],
  );
  assert.ok(beginningId);
  const writer = await page(`${origin}/?bottle=${encodeURIComponent(beginningId)}`);
  await writer.getByRole('button', { name: 'Write an ending', exact: true }).click();
  await writer.getByRole('button', { name: 'Open bottle', exact: true }).click();
  await writer
    .getByRole('textbox', { name: 'Your six-word ending', exact: true })
    .fill('Our lawyers would like another hand.');
  await writer.getByRole('button', { name: 'Send reply', exact: true }).click();
  await writer.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  await writer
    .getByText('Illustration unavailable. Your words are saved.', { exact: true })
    .waitFor();
  assert.equal(
    await writer.locator('.setup-half p').textContent(),
    'I taught dolphins to play poker.',
  );
  assert.equal(
    await writer.locator('.card-half:not(.setup-half) p').textContent(),
    'Our lawyers would like another hand.',
  );
  const cardId = await writer.locator('[data-card-id]').getAttribute('data-card-id');
  const snapshot = await writer.evaluate(() => {
    const s = window.driftTestGame.snapshot();
    return { scenes: s.scenes.length, cards: s.cards.length };
  });
  assert.equal(snapshot.scenes, 0, 'A keyless test database must not fabricate AI art.');
  assert.ok(snapshot.cards > 0);
  const viewer = await page(`${origin}/?card=${encodeURIComponent(cardId)}`);
  await viewer.locator('[data-card-id]').waitFor();
  await viewer
    .getByText('Illustration unavailable. Your words are saved.', { exact: true })
    .waitFor();
  const sharedStatus = await viewer.evaluate(
    (id) => window.driftTestGame.snapshot().sceneStatuses.find((row) => row.cardId === id),
    cardId,
  );
  assert.equal(sharedStatus.state, 'failed');
  assert.match(sharedStatus.message, /aren’t connected/, 'The actual scheduled worker ran.');
  await author.getByRole('button', { name: /^My bottles/ }).click();
  await author.locator('.beginning-preview').filter({ hasText: 'I taught dolphins' }).click();
  await author.locator('.ending-preview').filter({ hasText: 'Our lawyers' }).click();
  await author
    .getByText('Illustration unavailable. Your words are saved.', { exact: true })
    .waitFor();
  assert.equal(await author.locator('[data-card-id]').getAttribute('data-card-id'), cardId);
  await writer.getByRole('button', { name: 'Thank your co-writer', exact: true }).click();
  await author.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  await author.getByRole('button', { name: 'Thank your co-writer', exact: true }).click();
  await writer.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  const result = await viewer.evaluate((id) => window.driftTestGame.illustrate(id), cardId);
  assert.equal(result.state, 'failed');
  assert.match(result.message, /Only this postcard/);

  // A second writer submits through the real client API from an empty page with
  // no results component. Close both authors immediately after acceptance, then
  // observe the real scheduler through an unrelated reader's subscription.
  const backgroundContext = await browser.newContext();
  const background = await backgroundContext.newPage();
  // A real local static document keeps Chromium's local-network classification;
  // route.fulfill HTML would incorrectly block its websocket as a public origin.
  await background.goto(`${origin}/credits.html`);
  await background.evaluate(async () => {
    window.driftTestGame = (await import('/src/game.ts')).game;
    window.driftTestGame.subscribe(() => {});
  });
  await waitForGameConnection(background);
  await author.goto('about:blank');
  await background.evaluate(async (id) => {
    const game = window.driftTestGame;
    const round = await game.startInvited(id);
    await game.paid('reply', round, 'The shark demanded collateral in sardines.');
  }, beginningId);
  await background.waitForFunction(() =>
    window.driftTestGame.snapshot().rounds.some((round) => round.stage === 'done' && round.cardId),
  );
  const secondId = await background.evaluate(
    () => window.driftTestGame.snapshot().rounds.find((round) => round.stage === 'done').cardId,
  );
  assert.ok(secondId);
  await backgroundContext.close();
  await viewer.waitForFunction(
    (id) =>
      window.driftTestGame
        .snapshot()
        .sceneStatuses.some((row) => row.cardId === id && row.state === 'failed'),
    secondId,
    { timeout: 10000 },
  );
  assert.equal(
    await viewer.evaluate((id) => {
      const s = window.driftTestGame.snapshot();
      return (
        !!s.cards.find((card) => card.id === id) && !s.scenes.find((scene) => scene.cardId === id)
      );
    }, secondId),
    true,
  );

  await author.goto(`${origin}/?bottle=${encodeURIComponent(beginningId)}`);
  await waitForGameConnection(author);
  await author.evaluate((id) => window.driftTestGame.withdraw(id), beginningId);
  await viewer.waitForFunction(
    (ids) => {
      const s = window.driftTestGame.snapshot();
      return (
        !s.cards.some((card) => ids.includes(card.id)) &&
        !s.sceneStatuses.some((row) => ids.includes(row.cardId)) &&
        !s.scenes.some((row) => ids.includes(row.cardId))
      );
    },
    [cardId, secondId],
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS real submission queues art; keyless scheduler resolves without a result visit or connected writers; both authors share status via My bottles/results; private thanks still work; failure preserves words; readers cannot generate; withdrawal removes cards and scene state.',
  );
} finally {
  await browser.close();
}
