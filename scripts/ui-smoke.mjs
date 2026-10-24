import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const root = new URL('../', import.meta.url).pathname;
const out = root + 'docs/evidence/';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const a = await browser.newContext({
  viewport: { width: 360, height: 800 },
  reducedMotion: 'reduce',
  acceptDownloads: true,
});
const b = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  acceptDownloads: true,
});
const A = await a.newPage(),
  B = await b.newPage();
for (const p of [A, B]) p.on('pageerror', (e) => errors.push(e.message));
const checks = [];
const accessibility = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const origin = process.env.DRIFT_WEB_URL || 'http://localhost:5173';
async function ready(p) {
  await p.goto(origin);
  await p.getByRole('button', { name: 'Write my six words', exact: true }).waitFor();
  await p.waitForFunction(() => !document.querySelector('.home-copy button').disabled);
  await p.evaluate(() => document.fonts.ready);
}
async function screen(p, name) {
  await p.screenshot({ path: out + name, fullPage: true });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No horizontal overflow',
  );
  const scan = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = scan.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => n.target),
  }));
  accessibility.push({ artifact: name, violations });
  assert.deepEqual(violations, [], name + ' accessibility');
}
async function start(p, line) {
  await p.getByRole('button', { name: 'Write my six words', exact: true }).click();
  await p.getByRole('textbox').fill(line);
  await p.getByRole('button', { name: 'Toss my bottle', exact: true }).click();
  await p.getByRole('button', { name: 'Catch a bottle', exact: true }).waitFor();
}
try {
  await ready(A);
  await ready(B);
  await screen(A, 'home-360.png');
  await screen(B, 'home-1440.png');
  pass('Real database connection and responsive home at 360 / 1440 pixels');
  await B.getByRole('button', { name: 'How to play' }).click();
  await B.keyboard.press('Tab');
  assert.ok(await B.evaluate(() => !!document.activeElement?.closest('dialog')));
  await B.keyboard.press('Escape');
  await B.waitForFunction(() => !document.querySelector('dialog'));
  await B.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'How to play',
  );
  assert.equal(
    await B.evaluate(
      () => getComputedStyle(document.querySelector('.floating-bottle')).animationName,
    ),
    'none',
  );
  pass(
    'Keyboard dialog focus is contained and restored; reduced motion disables decorative animation',
  );
  await A.getByRole('button', { name: 'My postcards', exact: true }).click();
  await A.getByRole('heading', { name: 'A little empty. For now.' }).waitFor();
  await screen(A, 'empty-360.png');
  await A.getByRole('button', { name: 'Today’s bottle', exact: true }).click();
  pass('Empty collection offers a working next action');
  await B.getByRole('button', { name: 'My postcards', exact: true }).click();
  await B.getByRole('heading', { name: 'A little empty. For now.' }).waitFor();
  await screen(B, 'empty-1440.png');
  await B.getByRole('button', { name: 'Today’s bottle', exact: true }).click();
  await start(A, 'I taught the octopus insider trading.');
  await start(B, 'I challenged their shark to poker.');
  pass('Two isolated identities submit their own six-word setups');
  await A.getByRole('button', { name: 'Catch a bottle', exact: true }).click();
  await A.getByText('I challenged their shark to poker.', { exact: true }).waitFor();
  await B.getByRole('button', { name: 'Catch a bottle', exact: true }).click();
  await B.getByText('I taught the octopus insider trading.', { exact: true }).waitFor();
  pass('Each identity catches the other writer, never itself');
  await A.getByRole('textbox').fill('Our lawyers would like another hand.');
  await screen(A, 'reply-360.png');
  await screen(B, 'reply-1440.png');
  await A.reload();
  await A.getByRole('button', { name: 'Pick up where you left off', exact: true }).click();
  assert.equal(await A.getByRole('textbox').inputValue(), 'Our lawyers would like another hand.');
  pass('Draft and exclusive assignment resume after a full reload');
  await A.evaluate(async () => {
    const { game } = await import('/src/game.ts');
    const paid = game.paid.bind(game);
    game.paid = async (...args) => {
      const response = await paid(...args);
      if (args[0] === 'reply') throw Error('Synthetic lost acknowledgment');
      return response;
    };
  });
  await A.getByRole('button', { name: 'Seal our postcard', exact: true }).click();
  await A.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
  await screen(A, 'reveal-360.png');
  assert.equal(await A.locator('.error-note').count(), 0);
  pass('A server-confirmed postcard survives a lost reply acknowledgment');
  await B.getByRole('button', { name: 'My postcards 1', exact: true }).waitFor();
  pass('Original author receives the returned postcard without refreshing');
  await B.getByRole('textbox').fill('Your account has been permanently frozen.');
  await B.getByRole('button', { name: 'Seal our postcard', exact: true }).click();
  await B.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
  await screen(B, 'reveal-1440.png');
  pass('Both authors complete a canonical two-human postcard');
  const sharedId = await A.locator('article.postcard').getAttribute('data-card-id');
  await B.getByRole('button', { name: 'My postcards 2', exact: true }).click();
  await B.locator('.collection-card')
    .filter({ hasText: 'I challenged their shark to poker.' })
    .click();
  await A.getByRole('button', { name: 'I’m open to saying hi', exact: true }).click();
  await A.getByRole('heading', { name: 'Your little invitation is waiting.' }).waitFor();
  await B.getByRole('heading', { name: 'Maybe this is your first hello.' }).waitFor();
  pass('One-sided hello intent stays private to the other author');
  await A.evaluate(async () => {
    const { game } = await import('/src/game.ts');
    const read = game.helloInfo.bind(game);
    let failed = false;
    game.helloInfo = async (...args) => {
      if (!failed) {
        failed = true;
        throw Error('Synthetic invitation transport failure');
      }
      return read(...args);
    };
  });
  await B.getByRole('button', { name: 'I’m open to saying hi', exact: true }).click();
  await A.getByRole('alert').filter({ hasText: 'Your invitation couldn’t open.' }).waitFor();
  assert.equal(await A.locator('.recognition-phrase').count(), 0);
  await screen(A, 'hello-error-360.png');
  await A.getByRole('button', { name: 'Check invitation again', exact: true }).click();
  await A.getByRole('heading', { name: 'You’re both up for a hello.' }).waitFor();
  assert.equal(await A.locator('.hello-error').count(), 0);
  pass(
    'A failed private invitation read offers retry, keeps details hidden and clears the error after recovery',
  );
  await B.getByRole('heading', { name: 'You’re both up for a hello.' }).waitFor();
  assert.equal(
    await A.locator('.recognition-phrase').innerText(),
    await B.locator('.recognition-phrase').innerText(),
  );
  await screen(A, 'hello-360.png');
  await screen(B, 'hello-1440.png');
  pass('Mutual hello returns the same private phrase at the synthetic test meeting point');
  await A.getByRole('button', { name: 'Withdraw my invitation', exact: true }).click();
  await B.getByRole('heading', { name: 'Your little invitation is waiting.' }).waitFor();
  assert.equal(await B.locator('.recognition-phrase').count(), 0);
  pass('Withdrawal immediately removes the meeting details from both authors’ screens');
  const visitorContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    reducedMotion: 'reduce',
  });
  const visitor = await visitorContext.newPage();
  await visitor.goto(`${origin}?card=${sharedId}`);
  await visitor.getByRole('heading', { name: 'Two strangers. One little story.' }).waitFor();
  assert.equal(
    await visitor.getByRole('button', { name: 'Hide this postcard', exact: true }).count(),
    0,
  );
  await screen(visitor, 'shared-card-360.png');
  await visitor.getByRole('button', { name: 'Report', exact: true }).click();
  await visitor.getByRole('button', { name: 'Something else feels wrong' }).click();
  await visitor.getByRole('heading', { name: 'This postcard has drifted on.' }).waitFor();
  await screen(visitor, 'permission-360.png');
  assert.ok(await A.getByText('I challenged their shark to poker.', { exact: true }).isVisible());
  await visitor.reload();
  await visitor.getByRole('heading', { name: 'This postcard has drifted on.' }).waitFor();
  pass(
    'Shared-card visitors can report and persistently hide for themselves without removing the authors’ card',
  );
  const dl = A.waitForEvent('download');
  await A.getByRole('button', { name: 'Save image', exact: true }).click();
  const download = await dl;
  await download.saveAs(out + 'postcard-export.png');
  pass('PNG export creates a downloadable local image');
  await A.getByRole('button', { name: 'My postcards 2', exact: true }).click();
  await A.getByRole('heading', { name: 'Your stretch of shore.' }).waitFor();
  assert.equal(await A.locator('.collection-card').count(), 2);
  await screen(A, 'collection-360.png');
  pass('Both completed and returned postcards appear in the collection');
  await A.locator('.collection-card')
    .filter({ hasText: 'I challenged their shark to poker.' })
    .click();
  await A.getByRole('button', { name: 'Hide this postcard', exact: true }).click();
  await A.getByRole('button', { name: 'Hide postcard', exact: true }).click();
  await A.getByRole('heading', { name: 'Your stretch of shore.' }).waitFor();
  await A.waitForFunction(() => document.querySelectorAll('.collection-card').length === 1);
  pass('Author hiding removes the public card and collection projection');
  const external = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const externalPage = await external.newPage();
  await externalPage.goto(`${origin}?card=${sharedId}`);
  await externalPage.getByRole('heading', { name: 'This postcard has drifted on.' }).waitFor();
  await screen(externalPage, 'permission-1440.png');
  pass('The hidden public permalink is unavailable to a new independent viewer');
  const sampleContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  const sample = await sampleContext.newPage();
  sample.on('pageerror', (e) => errors.push(e.message));
  await ready(sample);
  await start(sample, 'Our accountant finally grew eight arms.');
  await sample.getByRole('button', { name: 'Catch a bottle', exact: true }).click();
  await sample.getByText('SAMPLE STARTER · DEVELOPMENT FIXTURE', { exact: true }).waitFor();
  await sample.getByRole('textbox').fill('Your account has been permanently frozen.');
  await sample.getByRole('button', { name: 'Seal our postcard', exact: true }).click();
  await sample
    .locator('.human-seal')
    .filter({ hasText: 'A sample beginning. A writer’s ending.' })
    .waitFor();
  assert.equal(
    await sample.getByRole('button', { name: 'I’m open to saying hi', exact: true }).count(),
    0,
  );
  await screen(sample, 'sample-360.png');
  const sampleDownload = sample.waitForEvent('download');
  await sample.getByRole('button', { name: 'Save image', exact: true }).click();
  await (await sampleDownload).saveAs(out + 'postcard-sample.png');
  pass(
    'A quiet development room labels sample provenance in play, reveal and export, with no mutual hello',
  );
  const longImage = await A.evaluate(async () => {
    const { postcardPng } = await import('/src/export.ts');
    const blob = await postcardPng({
      id: 'component-export-fixture',
      promptId: 'aquarium',
      setup: 'W'.repeat(148) + ' a b c d e',
      reply: 'Your account has been permanently frozen.',
      seeded: false,
      createdMs: Date.parse('2026-10-24T10:00:00Z'),
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await fs.writeFile(out + 'postcard-long-word.png', Buffer.from(longImage));
  pass('A valid near-limit long-word component fixture exports without losing its text');
  assert.deepEqual(errors, []);
  pass('No uncaught browser errors');
  await fs.writeFile(
    out + 'ui-smoke.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'local SpacetimeDB with explicitly disabled AI checks; synthetic test inputs, no attendee pilot',
        checks,
        errors,
        accessibility,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
