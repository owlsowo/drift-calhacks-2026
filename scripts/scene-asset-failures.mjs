import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL;
if (
  !origin?.startsWith('http://127.0.0.1:') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use the disposable local test-room harness.');
const examples = JSON.parse(
  await fs.readFile(new URL('../evals/scene-results.json', import.meta.url), 'utf8'),
);
const example = examples.find(
  (row) => row.status === 'valid' && row.scene?.nodes.some((node) => node.asset === 'city-hall'),
);
assert.ok(
  example,
  'A recorded, validated composition with the shipped city-hall asset is required.',
);
await fs.access(new URL('../apps/web/public/assets/scenes/city-hall.svg', import.meta.url));
const checks = [];
const errors = [];
const out = new URL('../docs/evidence/scene-asset-failures/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const pass = (engine, fault, message) => {
  checks.push({ engine, fault, message });
  console.log('PASS', engine, fault, message);
};

for (const [engine, launcher] of process.env.DRIFT_TEST_ENGINE === 'webkit'
  ? [['WebKit', webkit]]
  : process.env.DRIFT_TEST_ENGINE === 'chrome'
    ? [['Chrome', chromium]]
    : [
        ['Chrome', chromium],
        ['WebKit', webkit],
      ]) {
  const browser = await launcher.launch(
    engine === 'Chrome'
      ? {
          headless: true,
          ...(process.env.DRIFT_CHROMIUM_PATH
            ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
            : { channel: 'chrome' }),
        }
      : { headless: true },
  );
  try {
    for (const fault of ['aborted', 'stalled']) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
        acceptDownloads: true,
      });
      try {
        let recovered = false;
        let requests = 0;
        let heldRoute;
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push({ engine, fault, message: error.message }));
        await page.goto(origin);
        await waitForGameConnection(page);
        assert.equal(
          await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox),
          true,
          'No live database or paid provider is allowed.',
        );
        await context.route('**/assets/scenes/city-hall.svg', async (route) => {
          requests++;
          if (recovered) return route.continue();
          // One held same-origin static asset exercises the renderer's real 8s
          // timeout. Later export attempts fail quickly until recovery is enabled.
          if (fault === 'stalled' && requests === 1) {
            heldRoute = route;
            return;
          }
          await route.abort();
        });
        await page.goto(`${origin}/scene-preview.html`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(async ({ fixture, scene }) => {
          window.sceneFailureExample = { fixture, scene };
          window.sceneExportText = [];
          const originalText = CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
            if (this.canvas.width === 1080) window.sceneExportText.push({ text, x, y });
            return originalText.call(this, text, x, y, ...rest);
          };
          const { preparePostcard } = await import('/src/export.ts');
          window.sceneExportStarted = performance.now();
          window.sceneFallbackPromise = preparePostcard(fixture, scene);
        }, example);
        const card = page.locator(`[data-card-id="${example.fixture.id}"]`);
        await card
          .locator('.scene-illustration[data-state="failed"]')
          .waitFor({ state: 'attached' });
        await card
          .getByText('Illustration unavailable. Your words are saved.', { exact: true })
          .waitFor();
        assert.equal(await card.locator('.scene-placeholder').getAttribute('aria-busy'), 'false');
        assert.equal(await card.locator('.setup-half p').textContent(), example.fixture.setup);
        assert.equal(
          await card.locator('.card-half:not(.setup-half) p').textContent(),
          example.fixture.reply,
        );
        const result = await page.evaluate(async () => {
          const blob = await window.sceneFallbackPromise;
          const bitmap = await createImageBitmap(blob);
          const texts = window.sceneExportText;
          return {
            width: bitmap.width,
            height: bitmap.height,
            bytes: blob.size,
            type: blob.type,
            elapsedMs: Math.round(performance.now() - window.sceneExportStarted),
            texts,
          };
        });
        assert.equal(result.width, 1080);
        assert.equal(result.height, 1350);
        assert.equal(result.type, 'image/png');
        assert.ok(result.bytes > 1000);
        assert.ok(result.elapsedMs < 12000, JSON.stringify(result));
        for (const [text, center] of [
          [example.fixture.setup, 390],
          [example.fixture.reply, 920],
        ]) {
          const rows = result.texts.filter((row) => Math.abs(row.y - center) < 190);
          assert.equal(rows.map((row) => row.text).join(' '), text);
          assert.equal(rows.reduce((sum, row) => sum + row.y, 0) / rows.length, center);
        }
        assert.equal(
          result.texts.some((row) => row.text.startsWith('AI composition')),
          false,
        );
        pass(
          engine,
          fault,
          'Asset failure settles within the load bound; a readable 1080×1350 PNG retains both original lines and the UI explains its fallback',
        );

        await page.evaluate(async () => {
          const { shareCard } = await import('/src/export.ts');
          window.sceneShareCalls = [];
          Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
          Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: (args) => {
              window.sceneShareCalls.push({
                files: args.files?.length || 0,
                duringClick: window.sceneShareClickActive,
                type: args.files?.[0]?.type,
              });
              return Promise.resolve();
            },
          });
          const button = document.createElement('button');
          button.textContent = 'Test share fallback';
          button.onclick = () => {
            window.sceneShareClickActive = true;
            const { fixture, scene } = window.sceneFailureExample;
            window.sceneSharePromise = shareCard(fixture, scene);
            window.sceneShareClickActive = false;
          };
          document.body.prepend(button);
        });
        await page.getByRole('button', { name: 'Test share fallback', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.sceneShareCalls), [
          { files: 1, duringClick: true, type: 'image/png' },
        ]);
        await page.evaluate(() => window.sceneSharePromise);
        const downloadEvent = page.waitForEvent('download');
        await page.evaluate(async () => {
          const { savePng } = await import('/src/export.ts');
          const { fixture, scene } = window.sceneFailureExample;
          await savePng(fixture, scene);
        });
        const download = await downloadEvent;
        const path = new URL(`${engine.toLowerCase()}-${fault}.png`, out).pathname;
        await download.saveAs(path);
        const png = await fs.readFile(path);
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(png.readUInt32BE(16), 1080);
        assert.equal(png.readUInt32BE(20), 1350);
        pass(
          engine,
          fault,
          'Fallback shares synchronously inside the click and downloads a valid PNG without art or provider calls',
        );

        recovered = true;
        if (heldRoute) {
          // Restore the network before retrying. A timed-out Image can still
          // share a pending browser request; timeout is not network cancellation.
          const failed = page.waitForEvent('requestfailed', (request) =>
            request.url().endsWith('/assets/scenes/city-hall.svg'),
          );
          await heldRoute.abort();
          await failed;
        }
        await page.evaluate(async () => {
          const { preparePostcard, shareCard } = await import('/src/export.ts');
          const button = [...document.querySelectorAll('button')].find(
            (element) => element.textContent === 'Test share fallback',
          );
          button.onclick = () => {
            window.sceneExportText = [];
            const { fixture, scene } = window.sceneFailureExample;
            window.sceneRecoveryPromise = preparePostcard(fixture, scene);
            window.sceneShareClickActive = true;
            window.sceneSharePromise = shareCard(fixture, scene);
            window.sceneShareClickActive = false;
          };
        });
        await page.getByRole('button', { name: 'Test share fallback', exact: true }).click();
        assert.deepEqual(
          await page.evaluate(() => window.sceneShareCalls[1]),
          {
            files: 1,
            duringClick: true,
            type: 'image/png',
          },
          'The cached fallback remains immediately shareable during recovery preparation.',
        );
        const recoveredExport = await page.evaluate(async () => {
          const blob = await window.sceneRecoveryPromise;
          await window.sceneSharePromise;
          const { preparePostcard } = await import('/src/export.ts');
          const { fixture, scene } = window.sceneFailureExample;
          const same = await preparePostcard(fixture, scene);
          const rows = window.sceneExportText.filter((row) => Math.abs(row.y - 870) < 90);
          return {
            cached: blob === same,
            illustrated: window.sceneExportText.some((row) =>
              row.text.startsWith('AI composition'),
            ),
            setup: rows.map((row) => row.text).join(' ') === fixture.setup,
          };
        });
        assert.deepEqual(recoveredExport, { cached: true, illustrated: true, setup: true });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page
          .locator(`[data-card-id="${example.fixture.id}"] .scene-illustration[data-state="ready"]`)
          .waitFor();
        assert.equal(
          await page.locator(`[data-card-id="${example.fixture.id}"] .scene-placeholder`).count(),
          0,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        pass(
          engine,
          fault,
          'The same recorded composition upgrades after explicit preparation retry and renders normally after refresh',
        );

        // An observer callback runs outside the preparation Promise chain. Inject
        // a canvas failure only after a healthy initial paint, then force resize.
        await page.evaluate(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (...args) {
            if (this.closest?.('.scene-illustration'))
              throw Error('Synthetic resize canvas failure');
            return original.apply(this, args);
          };
        });
        await page.setViewportSize({ width: 430, height: 844 });
        await page
          .locator(`[data-card-id="${example.fixture.id}"] .scene-placeholder.is-unavailable`)
          .waitFor();
        assert.equal(
          await page.locator(`[data-card-id="${example.fixture.id}"] .setup-half p`).textContent(),
          example.fixture.setup,
        );
        pass(
          engine,
          fault,
          'A later ResizeObserver paint exception becomes a coherent fallback without an uncaught page error',
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
assert.deepEqual(errors, []);
await fs.writeFile(
  new URL('report.json', out),
  JSON.stringify(
    {
      mode: 'Disposable keyless local database; recorded Claude composition; injected static asset abort/stall and resize error; synthetic native share; no live model calls or challenge passes.',
      checkedAt: new Date().toISOString(),
      checks,
      errors,
    },
    null,
    2,
  ) + '\n',
);
