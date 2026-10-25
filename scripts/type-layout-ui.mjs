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
  throw Error('Use the local test room.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const checks = [],
  errors = [];
const out = new URL('../docs/evidence/', import.meta.url);
const button = (p, name) => p.getByRole('button', { name, exact: true });
async function make() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const p = await context.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(origin);
  await waitForGameConnection(p);
  assert.equal(await p.evaluate(() => window.driftTestGame.snapshot().service?.sandbox), true);
  return p;
}
async function noOverflow(p) {
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
try {
  await fs.mkdir(out, { recursive: true });
  const a = await make();
  const sizes = [
    [1440, 1000],
    [390, 844],
    [320, 740],
    [740, 360],
  ];
  for (const [width, height] of sizes) {
    await a.setViewportSize({ width, height });
    const title = await a.locator('.daily-tide h2').boundingBox();
    const dock = await a.locator('.shore-dock').boundingBox();
    assert.ok(
      title && dock && title.y >= 50 && title.y + title.height <= dock.y + 8,
      'The daily title remains below the header and above the dock.',
    );
    await noOverflow(a);
    await a.screenshot({
      path: new URL(`type-${engine.toLowerCase()}-home-${width}.png`, out).pathname,
      fullPage: true,
    });
  }
  pass(
    'Larger handwritten daily instructions and dock labels remain readable between header and dock across desktop, narrow phones and short landscape',
  );
  await a.setViewportSize({ width: 390, height: 844 });
  const prompt = await a.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  await a.getByRole('button', { name: /^Release a bottle/ }).click();
  await a
    .getByRole('textbox', { name: 'Your six-word beginning', exact: true })
    .fill(prompt.exampleSetup);
  await button(a, 'Release').click();
  await a.locator('.shore-home').waitFor();
  const id = await a.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
  const b = await make();
  await b.goto(origin + '/?bottle=' + id);
  await waitForGameConnection(b);
  await button(b, 'Write an ending').click();
  await button(b, 'Open bottle').click();
  await b
    .getByRole('textbox', { name: 'Your six-word ending', exact: true })
    .fill(prompt.exampleReply);
  await button(b, 'Send reply').click();
  await b.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  await button(b, 'Thank your co-writer').click();
  await a.goto(origin + '/?bottle=' + id);
  await waitForGameConnection(a);
  await a.locator('.ending-preview .thanks-label').waitFor();
  for (const [width, height] of sizes) {
    await a.setViewportSize({ width, height });
    const row = a.locator('.ending-preview');
    const meta = row.locator('small');
    const thanks = await meta.locator('.thanks-label').boundingBox();
    const date = await meta.locator('time').boundingBox();
    assert.ok(thanks && date);
    assert.ok(
      thanks.x + thanks.width + 6 <= date.x ||
        thanks.y + thanks.height + 4 <= date.y ||
        date.y + date.height + 4 <= thanks.y,
      'Private thanks and date have a visible gap rather than concatenated text.',
    );
    await expect(row).toContainText(prompt.exampleReply);
    await noOverflow(a);
    await a.screenshot({
      path: new URL(`type-${engine.toLowerCase()}-ending-${width}.png`, out).pathname,
      fullPage: true,
    });
  }
  const scan = await new AxeBuilder({ page: a })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => v.id),
    [],
  );
  pass(
    'A real local private thank-you, unopened marker and date remain separate beneath the full ending at all four widths, without horizontal overflow or selected accessibility violations',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`type-layout-${engine.toLowerCase()}.json`, out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        checks,
        errors,
        scope:
          'Disposable keyless local two-writer story/private thanks and responsive browser layouts. No provider call, production story, real phone, camera or native share claim.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
