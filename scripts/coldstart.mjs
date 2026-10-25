import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-coldstart-'))
  throw Error('Use the isolated cold-start runner.');
const out = 'docs/evidence/coldstart/';
await fs.mkdir(out, { recursive: true });
const checks = [],
  errors = [];
const button = (p, name) => p.getByRole('button', { name, exact: true });
const snapshot = (p) => p.evaluate(async () => (await import('/src/game.ts')).game.snapshot());
function pass(engine, width, message) {
  checks.push({ engine, width, message });
  console.log('PASS', engine, width, message);
}
async function capture(p, name, quiet = false) {
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const scan = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  await p.screenshot({ path: out + name + '.png', fullPage: true });
  if (quiet) {
    const note = await p.locator('.quiet-tide-note').boundingBox();
    const dock = await p.locator('.shore-dock').boundingBox();
    assert.ok(note.y + note.height <= dock.y, 'Recovery note leaves the dock usable');
    const phone = (await p.locator('.phone-shake').count())
      ? await p.locator('.phone-shake').boundingBox()
      : null;
    if (phone)
      assert.ok(
        note.y + note.height <= phone.y || phone.y + phone.height <= note.y,
        'Recovery note leaves phone controls usable',
      );
  }
}
for (const [engine, launcher] of [
  ['Chrome', chromium],
  ['WebKit', webkit],
]) {
  const browser = await launcher.launch(
    engine === 'Chrome' ? { channel: 'chrome', headless: true } : { headless: true },
  );
  try {
    for (const width of [390, 1440]) {
      const options = {
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: 'reduce',
        hasTouch: width === 390,
        isMobile: width === 390,
      };
      const contextA = await browser.newContext(options),
        contextB = await browser.newContext(options);
      const A = await contextA.newPage(),
        B = await contextB.newPage();
      for (const page of [A, B]) {
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(origin);
        await page.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
        assert.match(await page.locator('.sandbox-banner').innerText(), /AI checks are off/);
      }
      await button(A, 'Pick up a bottle').click();
      await A.getByRole('heading', { name: 'The water is quiet.', exact: true }).waitFor();
      assert.equal((await snapshot(A)).rounds.length, 0);
      await button(A, 'Toss a beginning').click();
      await A.getByRole('textbox').fill('I taught the octopus insider trading.');
      await button(A, 'Toss my bottle').click();
      await button(A, 'Catch a bottle').click();
      await button(A, 'Leave it drifting').waitFor();
      assert.match(
        await A.locator('.quiet-tide-note p').innerText(),
        /Your beginning is still drifting/,
      );
      assert.equal(await button(A, 'Toss a beginning').count(), 0);
      await capture(A, `${engine.toLowerCase()}-${width}-waiting`, true);
      await button(A, 'Drift home').click();
      await button(A, 'Pick up a bottle').click();
      await button(A, 'Leave it drifting').waitFor();
      assert.match(
        await A.locator('.quiet-tide-note p').innerText(),
        /Your beginning is still drifting/,
      );
      await button(A, 'Leave it drifting').click();
      await button(A, 'Write my six words').waitFor();
      await button(A, 'Pick up a bottle').waitFor();
      const closed = await snapshot(A);
      assert.equal(closed.rounds.length, 1);
      assert.equal(closed.rounds[0].stage, 'done');
      assert.equal(closed.outgoing.length, 1);
      assert.equal(closed.outgoing[0].cardId, '');
      pass(
        engine,
        width,
        'An empty first catch consumes no round; leaving a published beginning closes one counted round without removing the bottle',
      );

      await button(B, 'Pick up a bottle').click();
      await B.getByRole('button', { name: 'Open bottle', exact: false }).click();
      assert.equal(
        await B.locator('.caught-note p').innerText(),
        'I taught the octopus insider trading.',
      );
      await B.getByRole('textbox').fill('Your account has been permanently frozen.');
      await button(B, 'Seal our postcard').click();
      await B.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
      await button(A, 'Open returned postcard').click();
      await A.locator('.postcard-paper.paper-open').waitFor();
      const firstId = await B.locator('article.postcard').getAttribute('data-card-id');
      assert.equal(await A.locator('article.postcard').getAttribute('data-card-id'), firstId);
      assert.equal((await snapshot(A)).cards.find((c) => c.id === firstId).seeded, false);
      await capture(A, `${engine.toLowerCase()}-${width}-return`);
      pass(
        engine,
        width,
        'A second independent identity completes the real peer bottle and its canonical postcard returns after the original round was closed',
      );

      await button(B, 'Keep this story. Maybe later.').click();
      await button(B, 'Pick up a bottle').waitFor();
      await button(A, 'Drift home').click();
      await button(A, 'Write my six words').click();
      await A.getByRole('textbox').fill('I challenged their shark to poker.');
      await button(A, 'Toss my bottle').click();
      await button(A, 'Catch a bottle').click();
      await button(A, 'Leave it drifting').waitFor();
      await button(B, 'Pick up a bottle').click();
      await B.getByRole('button', { name: 'Open bottle', exact: false }).click();
      await B.getByRole('textbox').fill('Our lawyers would like another hand.');
      await button(B, 'Seal our postcard').click();
      await B.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
      await button(A, 'Keep my returned story').waitFor();
      assert.match(
        await A.locator('.quiet-tide-note p').innerText(),
        /Your bottle found an ending/,
      );
      await capture(A, `${engine.toLowerCase()}-${width}-already-returned`, true);
      await button(A, 'Keep my returned story').click();
      await button(A, 'Write my six words').waitFor();
      await button(A, 'Pick up a bottle').waitFor();
      const kept = await snapshot(A);
      assert.equal(kept.rounds.length, 2);
      assert.ok(kept.rounds.every((r) => r.stage === 'done'));
      assert.equal(kept.ownership.filter((c) => !c.hidden).length, 2);
      await button(A, 'Open returned postcard').click();
      await A.locator('.postcard-paper.paper-open').waitFor();
      assert.equal(
        await A.locator('article.postcard').getAttribute('data-card-id'),
        await B.locator('article.postcard').getAttribute('data-card-id'),
      );
      pass(
        engine,
        width,
        'A return that arrives while the author waits changes the recovery copy; keeping it preserves both postcards and the daily round count',
      );
      await contextA.close();
      await contextB.close();
    }
  } finally {
    await browser.close();
  }
}
assert.deepEqual(errors, []);
await fs.writeFile(
  out + 'checks.json',
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      mode: 'Real local Spacetime transitions with two isolated synthetic identities. AI off and all sample/team starters disabled. No provider calls, public test stories or attendee participation.',
      checks,
      errors,
      limits: [
        'Desktop browser engines with mobile/touch emulation; no physical phone or attendee outcome claim',
      ],
    },
    null,
    2,
  ) + '\n',
);
