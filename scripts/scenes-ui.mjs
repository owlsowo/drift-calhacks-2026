import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const origin = process.env.DRIFT_WEB_URL || 'http://localhost:5182';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw Error('Use a local preview.');
const out = new URL('../test-results/scenes-ui/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const examples = JSON.parse(
  await fs.readFile(new URL('../evals/scene-results.json', import.meta.url), 'utf8'),
);
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
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
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/scene-preview.html`);
  await page
    .locator('.scene-illustration[data-state="ready"]')
    .nth(examples.length - 1)
    .waitFor();
  for (const example of examples) {
    const output = await page.evaluate(async ({ fixture, scene }) => {
      const { preparePostcard } = await import('/src/export.ts');
      const { prepareScene, drawScene } = await import('/src/scene-renderer.ts');
      await preparePostcard(fixture);
      const blob = await preparePostcard(fixture, scene);
      const bitmap = await createImageBitmap(blob);
      const exported = document.createElement('canvas');
      exported.width = 900;
      exported.height = 600;
      const e = exported.getContext('2d');
      e.drawImage(bitmap, 90, 150, 900, 600, 0, 0, 900, 600);
      const canonical = document.createElement('canvas');
      canonical.width = 900;
      canonical.height = 600;
      const c = canonical.getContext('2d');
      drawScene(c, await prepareScene(scene), 0, 0, 900, 600);
      const a = e.getImageData(0, 0, 900, 600).data;
      const b = c.getImageData(0, 0, 900, 600).data;
      let differingPixels = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (
          Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >
          3
        )
          differingPixels++;
      }
      const png = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      return { png, width: bitmap.width, height: bitmap.height, differingPixels };
    }, example);
    assert.equal(output.width, 1080);
    assert.equal(output.height, 1350);
    assert.equal(output.differingPixels, 0, 'The shared PNG must contain the same rendered scene.');
    await fs.writeFile(
      new URL(`postcard-${example.fixture.promptId}.png`, out),
      Buffer.from(output.png.split(',')[1], 'base64'),
    );
  }
  const sharing = await page.evaluate(async ({ fixture, scene }) => {
    const { preparePostcard, shareCard } = await import('/src/export.ts');
    const plain = await preparePostcard(fixture);
    const illustrated = await preparePostcard(fixture, scene);
    const cached = await preparePostcard(fixture, JSON.parse(JSON.stringify(scene)));
    const calls = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (args) => {
        calls.push({ files: args.files?.length || 0, url: args.url });
        return Promise.resolve();
      },
    });
    const first = shareCard(fixture, scene);
    const synchronousImage = calls.length === 1 && calls[0].files === 1;
    await first;
    const changed = { ...scene, backdrop: scene.backdrop === 'sky' ? 'paper' : 'sky' };
    const second = shareCard(fixture, changed);
    const synchronousLink = calls.length === 2 && calls[1].files === 0 && !!calls[1].url;
    await second;
    const pending = shareCard(fixture, undefined, { preferLink: true });
    const pendingLink = calls.length === 3 && calls[2].files === 0 && !!calls[2].url;
    await pending;
    return {
      distinct: plain !== illustrated,
      cached: cached === illustrated,
      synchronousImage,
      synchronousLink,
      pendingLink,
    };
  }, examples[0]);
  assert.deepEqual(sharing, {
    distinct: true,
    cached: true,
    synchronousImage: true,
    synchronousLink: true,
    pendingLink: true,
  });
  await page.screenshot({ path: new URL('desktop.png', out).pathname, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.scene-illustration')].every(
      (item) => item.dataset.state === 'ready',
    ),
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'Mobile must not overflow horizontally.',
  );
  await page.screenshot({ path: new URL('mobile.png', out).pathname, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${examples.length} actual Claude scenes render, export to 1080×1350, match exported pixels, and fit mobile.`,
  );
} finally {
  await browser.close();
}
