import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';

// Browser-only state projections, using a recorded Claude composition and synthetic
// exchange. These checks do not generate art or claim to test backend persistence.
const origin = process.env.DRIFT_WEB_URL || 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error('Use a local sandbox preview.');
const examples = JSON.parse(
  await fs.readFile(new URL('../evals/scene-results.json', import.meta.url), 'utf8'),
);
const example = examples.find(
  (item) => item.status === 'valid' && item.scene && item.model === 'claude-sonnet-5-5',
);
assert.ok(example, 'A recorded, valid Sonnet composition is required.');
const cardId = 'synthetic-scene-results-pair';
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const out = new URL(`../test-results/scene-results-ui/${engine.toLowerCase()}/`, import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser =
  engine === 'WebKit'
    ? await webkit.launch()
    : await chromium.launch({
        channel: 'chrome',
        headless: true,
        ...(process.env.DRIFT_CHROMIUM_PATH
          ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
          : {}),
      });
const errors = [];
const checks = [];
const pass = (message) => {
  checks.push(message);
  console.log('PASS', message);
};
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function project(page, patch) {
  await page.evaluate((value) => window.renderSyntheticSceneState(value), patch);
}

async function noOverflow(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'Results must not overflow horizontally.',
  );
  const paper = await page.locator('.reveal-art .postcard').boundingBox();
  assert.ok(paper && paper.x >= -1 && paper.x + paper.width <= 391);
}

async function installProjection(page, role) {
  await waitForGameConnection(page);
  assert.equal(
    await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox),
    true,
    'Only a keyless local sandbox is allowed.',
  );
  await page.evaluate(
    async ({ example, role, cardId }) => {
      const game = window.driftTestGame;
      const originalSnapshot = game.snapshot;
      const beginningId = 'synthetic-scene-results-beginning';
      const card = { ...example.fixture, id: cardId, beginningId, seeded: false, starterKind: '' };
      let projected = { state: 'pending', connected: true };
      let previous;
      let decorated;
      window.syntheticIllustrationCalls = 0;
      window.syntheticNativeShares = [];
      game.illustrate = async () => {
        window.syntheticIllustrationCalls++;
        throw Error('Result views must never dispatch scene generation.');
      };
      // Synthetic authorship must not write analytics for a nonexistent postcard.
      game.cardAction = async () => {};
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (args) => {
          window.syntheticNativeShares.push({ files: args.files?.length || 0, url: args.url });
          return Promise.resolve();
        },
      });
      game.snapshot = () => {
        const next = originalSnapshot();
        if (next !== previous) {
          previous = next;
          decorated = {
            ...next,
            connected: projected.connected,
            connecting: !projected.connected,
            rounds: [],
            assignments: [],
            ownership: [{ id: cardId, role, hidden: false }],
            unopenedReturns: [],
            outgoing:
              role === 'setup'
                ? [{ id: beginningId, text: card.setup, cardId, day: next.today.day }]
                : [],
            cards: [card],
            beginnings: [
              {
                id: beginningId,
                day: next.today.day,
                promptId: card.promptId,
                promptJson: next.today.promptJson,
                text: card.setup,
                seeded: false,
                starterKind: '',
                createdMs: card.createdMs,
              },
            ],
            scenes:
              projected.state === 'ready'
                ? [
                    {
                      cardId,
                      packId: example.scene.packId,
                      sceneJson: JSON.stringify(example.scene),
                      createdMs: card.createdMs,
                    },
                  ]
                : [],
            sceneStatuses: [
              { cardId, state: projected.state, message: '', updatedMs: card.createdMs },
            ],
            book: {
              beginningIds: role === 'setup' ? [beginningId] : [],
              pairIds: role === 'reply' ? [cardId] : [],
            },
            hellos: [],
            reported: [],
            service: next.service && { ...next.service, helloEnabled: false },
          };
        }
        return decorated;
      };
      window.renderSyntheticSceneState = async (patch) => {
        projected = { ...projected, ...patch };
        previous = undefined;
        // Clock refresh emits an ordinary store notification. Fixture rows remain
        // entirely in this browser and never enter the SpacetimeDB database.
        await game.refresh();
      };
      await window.renderSyntheticSceneState({});
    },
    { example, role, cardId },
  );
}

try {
  const renderedScenes = [];
  for (const role of ['reply', 'setup']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(role === 'reply' ? `${origin}/?card=${cardId}` : origin);
    await installProjection(page, role);
    if (role === 'setup') {
      await page.getByRole('button', { name: /^My bottles/ }).click();
      await page.locator('.beginning-preview').click();
      await page.locator('.ending-preview').click();
    }
    await page.locator('.scene-placeholder.is-drawing').waitFor();
    assert.equal(await page.getByText('Drawing your postcard…', { exact: true }).count(), 1);
    assert.equal(await button(page, 'Drawing…').isDisabled(), true);
    assert.equal(await button(page, 'Share').isEnabled(), true);
    assert.equal(await page.locator('.scene-placeholder').getAttribute('aria-busy'), 'true');
    assert.equal(
      await page
        .locator('.scene-sketch-bottle')
        .evaluate((el) => getComputedStyle(el).animationName),
      'none',
      'Reduced motion must leave the drawing indicator still.',
    );
    const pending = await page.locator('.scene-placeholder').boundingBox();
    const savePending = await page.locator('.postcard-save').boundingBox();
    assert.ok(Math.abs(pending.width / pending.height - 1.5) < 0.01);
    await noOverflow(page);
    await page.screenshot({ path: new URL(`${role}-pending.png`, out).pathname, fullPage: true });

    // Even a prewarmed words-only image must not win the pending share path.
    await page.evaluate(async () => {
      const { preparePostcard } = await import('/src/export.ts');
      await preparePostcard(window.driftTestGame.snapshot().cards[0]);
    });
    await button(page, 'Share').click();
    await page.waitForFunction(() => window.syntheticNativeShares.length === 1);
    assert.deepEqual(
      await page.evaluate(() => window.syntheticNativeShares[0]),
      { files: 0, url: `${origin}/?card=${cardId}` },
      'Pending share sends the canonical live card link, never a stale PNG.',
    );
    pass(`${role} author sees pending art and shares its live link while image export waits`);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(
      await page
        .locator('.scene-sketch-bottle')
        .evaluate((el) => getComputedStyle(el).animationName),
      'scene-bottle-sway',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await project(page, { connected: false });
    await page.getByText('Reconnecting to your postcard…', { exact: true }).waitFor();
    assert.equal(await page.locator('.scene-placeholder').getAttribute('aria-busy'), 'true');
    assert.equal(await button(page, 'Save words').isEnabled(), true);
    const offlineDownload = page.waitForEvent('download');
    await button(page, 'Save words').click();
    const offlineBytes = await fs.readFile(await (await offlineDownload).path());
    assert.equal(offlineBytes.readUInt32BE(16), 1080);
    assert.equal(offlineBytes.readUInt32BE(20), 1650);
    pass(`${role} author can download the original words while reconnecting to pending art`);
    await project(page, { connected: true, state: 'ready' });
    await page.locator('.scene-illustration[data-state="ready"]').waitFor();
    assert.equal(await page.locator('.scene-placeholder').count(), 0);
    assert.equal(await button(page, 'Save image').isEnabled(), true);
    const ready = await page.locator('.scene-illustration').boundingBox();
    const saveReady = await page.locator('.postcard-save').boundingBox();
    assert.ok(Math.abs(pending.width - ready.width) < 1);
    assert.ok(Math.abs(pending.height - ready.height) < 1);
    assert.ok(Math.abs(savePending.width - saveReady.width) < 1);
    renderedScenes.push(
      await page.locator('.scene-illustration canvas').evaluate((el) => el.toDataURL()),
    );
    await noOverflow(page);
    await page.screenshot({ path: new URL(`${role}-ready.png`, out).pathname, fullPage: true });
    pass(`${role} author reconnects into the same illustration without layout shifts or overflow`);

    await project(page, { state: 'pending' });
    await page.locator('.scene-placeholder.is-drawing').waitFor();
    await project(page, { state: 'failed' });
    await page
      .getByText('Illustration unavailable. Your words are saved.', { exact: true })
      .waitFor();
    assert.equal(await page.locator('.scene-placeholder').getAttribute('aria-busy'), 'false');
    assert.equal(await page.locator('.scene-placeholder.is-drawing').count(), 0);
    assert.equal(await button(page, 'Save image').isEnabled(), true);
    assert.equal(await page.locator('.setup-half p').textContent(), example.fixture.setup);
    assert.equal(
      await page.locator('.card-half:not(.setup-half) p').textContent(),
      example.fixture.reply,
    );
    assert.equal(await page.evaluate(() => window.syntheticIllustrationCalls), 0);
    await noOverflow(page);
    await page.screenshot({ path: new URL(`${role}-failed.png`, out).pathname, fullPage: true });
    pass(`${role} author retains both lines and export access after a failed illustration`);
    await context.close();
  }
  assert.equal(
    renderedScenes[0],
    renderedScenes[1],
    'Both authors must render the same saved scene.',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('report.json', out),
    JSON.stringify(
      {
        engine,
        checkedAt: new Date().toISOString(),
        mode: 'Synthetic browser snapshot projections; recorded Sonnet layout; no provider calls or fixture database writes.',
        checks,
        sharedSceneMatches: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS both author perspectives render the identical recorded scene; no generation calls',
  );
} finally {
  await browser.close();
}
