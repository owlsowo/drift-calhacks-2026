import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use isolated test-room.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = await Promise.all(
  [360, 1440].map((width) =>
    browser.newContext({
      viewport: { width, height: width === 360 ? 800 : 1000 },
      reducedMotion: 'reduce',
    }),
  ),
);
const [A, B] = await Promise.all(contexts.map((c) => c.newPage()));
const button = (p, name) => p.getByRole('button', { name, exact: true });
const checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
async function screen(p, name) {
  await p.screenshot({ path: 'docs/evidence/' + name, fullPage: true });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const report = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    report.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
}
try {
  for (const p of [A, B]) {
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(origin);
    await p.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
  }
  await button(B, 'Write my six words').click();
  await B.getByRole('textbox').fill('I challenged their shark to poker.');
  await button(B, 'Toss my bottle').click();
  await button(B, 'Catch a bottle').waitFor();
  const box = await A.locator('.bottle-grip').boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await A.mouse.move(x, y);
  await A.mouse.down();
  for (const dx of [65, -65, 65, -65, 65]) {
    await A.waitForTimeout(95);
    await A.mouse.move(x + dx, y);
  }
  await A.mouse.up();
  await A.getByRole('button', { name: 'Open bottle', exact: false }).click();
  await A.getByText('I challenged their shark to poker.', { exact: true }).waitFor();
  pass('A fresh identity shakes to catch a real peer beginning before writing anything');
  await A.getByRole('textbox').fill('Our lawyers would like another hand.');
  await button(A, 'Seal our postcard').click();
  await A.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
  await button(B, 'My postcards 1').waitFor();
  const visualOrder = await A.evaluate(() => {
    const bottom = (selector) => document.querySelector(selector).getBoundingClientRect().bottom;
    const top = (selector) => document.querySelector(selector).getBoundingClientRect().top;
    return (
      bottom('.reveal-copy h1') <= top('.reveal-art') &&
      bottom('.reveal-art') <= top('.share-actions') &&
      bottom('.share-actions') <= top('.pass-it-on')
    );
  });
  assert.ok(
    visualOrder,
    'The completed postcard and sharing controls precede the optional contribution',
  );
  await screen(A, 'catch-first-reveal-360.png');
  await screen(B, 'returned-bottle-1440.png');
  pass(
    'Finishing immediately creates a postcard, returns it live, and offers an optional beginning',
  );
  pass(
    'The mobile postcard appears before its sharing controls and optional next-beginning invitation',
  );
  await button(A, 'Toss my own bottle').click();
  await A.getByRole('textbox').fill('I taught the octopus insider trading.');
  await button(A, 'Toss my bottle').click();
  await button(A, 'Write another little story').waitFor();
  assert.equal(
    await A.evaluate(async () => (await import('/src/game.ts')).game.snapshot().rounds.length),
    1,
  );
  pass('Passing on a beginning completes the same round and returns to the shore');
  await A.locator('.shore-dock button').nth(1).click();
  await A.getByRole('button', { name: 'Open bottle', exact: false }).click();
  await A.getByRole('textbox').fill('Your account has been permanently frozen.');
  await button(A, 'Seal our postcard').click();
  await button(A, 'Keep this story. Maybe later.').click();
  await A.locator('.shore-home').waitFor();
  assert.equal(
    await A.evaluate(
      async () =>
        (await import('/src/game.ts')).game.snapshot().rounds.filter((r) => r.stage !== 'done')
          .length,
    ),
    0,
  );
  pass('The writer can keep a completed postcard and decline to toss a beginning');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'docs/evidence/catch-first.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'Isolated local sandbox; synthetic writers; no paid model calls',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
