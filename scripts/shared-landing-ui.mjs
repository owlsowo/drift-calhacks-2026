import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL;
if (
  !origin?.startsWith('http://127.0.0.1:') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use the disposable local test-room harness.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit'
    ? await webkit.launch()
    : await chromium.launch(
        process.env.DRIFT_CHROMIUM_PATH
          ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
          : { channel: 'chrome' },
      );
const contexts = [];
const errors = [];
const checks = [];
const out = new URL('../docs/evidence/', import.meta.url);
const button = (page, name) => page.getByRole('button', { name, exact: true });
const pass = (message) => {
  checks.push(message);
  console.log('PASS', message);
};
async function make(url = origin) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await waitForGameConnection(page);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox), true);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().service?.aiReady), false);
  return page;
}
async function noPrivateAccess(page) {
  assert.deepEqual(
    await page.evaluate(() => {
      const s = window.driftTestGame.snapshot();
      return { rounds: s.rounds, ownership: s.ownership, appreciation: s.appreciation };
    }),
    { rounds: [], ownership: [], appreciation: [] },
  );
  assert.equal(await page.locator('.co-writer-thanks').count(), 0);
  assert.equal(await button(page, 'Hide').count(), 0);
}
try {
  const author = await make();
  const prompt = await author.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  await author.getByRole('button', { name: /^Release a bottle/ }).click();
  await author
    .getByRole('textbox', { name: 'Your six-word beginning', exact: true })
    .fill(prompt.exampleSetup);
  await button(author, 'Release').click();
  await author
    .getByText('Bottle released. Replies will appear in My bottles.', { exact: true })
    .waitFor();
  await author.locator('.shore-home').waitFor();
  const beginningId = await author.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
  assert.ok(beginningId);
  pass(
    'First release names My bottles as the destination for eventual replies while returning to the sea',
  );

  const writer = await make(`${origin}/?bottle=${beginningId}`);
  await button(writer, 'Write an ending').click();
  await button(writer, 'Open bottle').click();
  await writer
    .getByRole('textbox', { name: 'Your six-word ending', exact: true })
    .fill(prompt.exampleReply);
  await button(writer, 'Send reply').click();
  await writer.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  const cardId = await writer.locator('[data-card-id]').getAttribute('data-card-id');
  const cardUrl = `${origin}/?card=${cardId}`;
  await expect(button(writer, 'Thank your co-writer')).toBeEnabled();
  await button(writer, 'Thank your co-writer').click();

  await author.goto(cardUrl);
  await waitForGameConnection(author);
  await author.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  await expect(button(author, 'Thank your co-writer')).toBeEnabled();
  const authorBefore = await author.evaluate(() => {
    const s = window.driftTestGame.snapshot();
    return {
      roundIds: s.rounds.map((row) => row.id),
      ownership: s.ownership,
      appreciation: s.appreciation,
    };
  });
  for (const page of [author, writer]) {
    assert.equal(await button(page, 'Try today’s bottle').count(), 0);
    await expect(button(page, 'Back to bottles')).toBeVisible();
    await expect(button(page, 'Hide')).toBeVisible();
  }
  pass(
    'Both original authors retain their collection return, private thank-you controls and received receipt',
  );

  const reader = await make(cardUrl);
  await reader.locator(`[data-card-id="${cardId}"]`).waitFor();
  await expect(
    reader.getByText('A beginning and an ending, six words each. Make one with someone else.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(button(reader, 'Try today’s bottle')).toBeVisible();
  await expect(button(reader, 'Back to the sea')).toBeVisible();
  await expect(button(reader, 'Back to bottles')).toHaveCount(0);
  await noPrivateAccess(reader);
  for (const label of ['Share', 'Save image', 'Copy text', 'Report'])
    await expect(button(reader, label)).toBeVisible();
  await reader.evaluate(() => {
    window.sharedLandingGateCalls = 0;
    window.sharedLandingWrites = 0;
    const game = window.driftTestGame;
    const originalGate = game.verifyGate;
    game.verifyGate = (...args) => {
      window.sharedLandingGateCalls++;
      return originalGate(...args);
    };
    for (const method of ['start', 'startCatching', 'startInvited', 'paid', 'thank']) {
      game[method] = async () => {
        window.sharedLandingWrites++;
        throw Error('Reading a shared postcard must not start a turn or write private state.');
      };
    }
  });
  await reader.screenshot({
    path: new URL(`shared-landing-${engine.toLowerCase()}.png`, out).pathname,
    fullPage: true,
  });
  assert.equal(
    await reader.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  pass(
    'A fresh public reader sees the human six-word premise and a route into today, with no author-only controls or receipts',
  );

  await button(reader, 'Try today’s bottle').click();
  await reader.locator('.shore-home').waitFor();
  assert.equal(new URL(reader.url()).search, '');
  await noPrivateAccess(reader);
  assert.deepEqual(
    await reader.evaluate(() => ({
      writes: window.sharedLandingWrites,
      gateCalls: window.sharedLandingGateCalls,
    })),
    { writes: 0, gateCalls: 0 },
  );
  await reader.goBack();
  await button(reader, 'Try today’s bottle').waitFor();
  await button(reader, 'Back to the sea').click();
  await reader.locator('.shore-home').waitFor();
  await noPrivateAccess(reader);
  pass(
    'Both public-reader controls return home without consuming a turn or calling a gate in the keyless local sandbox',
  );

  assert.deepEqual(
    await author.evaluate(() => {
      const s = window.driftTestGame.snapshot();
      return {
        roundIds: s.rounds.map((row) => row.id),
        ownership: s.ownership,
        appreciation: s.appreciation,
      };
    }),
    authorBefore,
  );
  await author.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  await button(author, 'Back to bottles').click();
  await author.getByRole('heading', { name: 'My bottles', exact: true }).waitFor();
  await author.locator('.beginning-preview').filter({ hasText: prompt.exampleSetup }).click();
  await author.locator('.ending-preview').filter({ hasText: prompt.exampleReply }).click();
  await author.getByText('Your co-writer sent a little thanks.', { exact: true }).waitFor();
  pass(
    'Public-reader visits leave author ownership, turns and received private thanks unchanged; the author still returns through My bottles',
  );
  assert.deepEqual(errors, []);
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(
    new URL(`shared-landing-${engine.toLowerCase()}.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        mode: 'Disposable keyless local sandbox; real local two-writer exchange and independent public reader; no paid provider calls, fake pass or external account actions.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
