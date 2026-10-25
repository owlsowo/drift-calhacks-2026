import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL;
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-')
)
  throw Error('Use a disposable local test room.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'webkit' : 'chrome';
const browser = await (engine === 'webkit' ? webkit : chromium).launch(
  engine === 'chrome'
    ? process.env.DRIFT_CHROMIUM_PATH
      ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
      : { channel: 'chrome' }
    : {},
);
const checks = [],
  errors = [];
const out = new URL(`../test-results/pickup-flow/${engine}/`, import.meta.url);
const button = (p, name) => p.getByRole('button', { name, exact: true });
const step = (p, name) => p.locator(`.bottle-ritual[data-pickup-step="${name}"]`);
const editor = (p) => p.getByRole('textbox', { name: 'Your six-word ending', exact: true });
const pass = (name) => {
  checks.push(name);
  console.log('PASS', engine, name);
};
async function make() {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await c.addInitScript(() => {
    window.pickupSteps = [];
    new MutationObserver(() => {
      const value = document.querySelector('.bottle-ritual')?.getAttribute('data-pickup-step');
      if (value && window.pickupSteps.at(-1) !== value) window.pickupSteps.push(value);
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-pickup-step'],
    });
  });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(origin);
  await waitForGameConnection(p);
  assert.equal(await p.evaluate(() => window.driftTestGame.snapshot().service?.sandbox), true);
  return p;
}
async function release(p, text) {
  await p.getByRole('button', { name: /^Release a bottle/ }).click();
  assert.equal(
    await p.locator('#six-words').evaluate((input) => {
      const context = [...document.querySelectorAll('.writing-context')].find((node) =>
        node.textContent.includes('How someone will respond'),
      );
      return (
        !!context && !!(input.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    }),
    true,
    'Response guidance belongs below the beginning textbox.',
  );
  await p.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(text);
  await button(p, 'Release').click();
  await p.locator('.shore-home').waitFor();
  return p.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
}
async function single(p) {
  await expect(step(p, 'open')).toHaveClass(/bottle-ritual--arrived/);
  await expect(p.locator('[data-bottle-choice]')).toHaveCount(0);
  await expect(p.getByText('Drag to shake, or tap to open.', { exact: true })).toBeVisible();
  await expect(editor(p)).toHaveCount(0);
}
async function choose(p) {
  await expect(step(p, 'choose')).toHaveClass(/bottle-ritual--arrived/);
  const count = await p.locator('[data-bottle-choice]').count();
  assert.ok(count >= 3 && count <= 5);
  await expect(editor(p)).toHaveCount(0);
  await p.locator('[data-bottle-choice]').first().click();
  await single(p);
}
try {
  await fs.mkdir(out, { recursive: true });
  const a = await make();
  const prompt = await a.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  const id = await release(a, prompt.exampleSetup);
  const other = await make();
  const otherId = await release(other, 'I taught the octopus insider trading.');
  const guest = await make();
  await guest.goto(`${origin}/?bottle=${id}`);
  await waitForGameConnection(guest);
  await button(guest, 'Write an ending').click();
  await single(guest);
  assert.deepEqual(await guest.evaluate(() => window.pickupSteps), ['open']);
  await guest.screenshot({ path: new URL('invitation-shake.png', out).pathname, fullPage: true });
  pass(
    'An invitation goes straight to the single-bottle shake stage, never flashes the chooser, and holds the editor closed',
  );
  const box = await button(guest, 'Open bottle').boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await guest.mouse.move(x, y);
  await guest.mouse.down();
  for (const offset of [60, -60, 60, -60, 60]) {
    await guest.waitForTimeout(95);
    await guest.mouse.move(x + offset, y);
  }
  await guest.mouse.up();
  await editor(guest).waitFor();
  assert.equal(await guest.evaluate(() => window.driftTestGame.snapshot().assignments[0].id), id);
  await expect(guest.locator('.caught-note')).toContainText(prompt.exampleSetup);
  pass('Four deliberate pointer reversals open the exact invited beginning before writing');
  await button(guest, 'Report').click();
  await button(guest, 'Something else feels wrong').click();
  await guest.locator('.shore-home').waitFor();
  await expect(guest.locator('.bottle-ritual, .shore-catch')).toHaveCount(0);
  pass('Reporting returns to the normal sea without an unsolicited shake screen or chooser');
  await button(guest, 'Pick up a bottle. Write an ending').click();
  await choose(guest);
  await guest.screenshot({ path: new URL('selected-shake.png', out).pathname, fullPage: true });
  await button(guest, 'Open bottle').click();
  await editor(guest).waitFor();
  const replacement = await guest.evaluate(() => window.driftTestGame.snapshot().assignments[0].id);
  assert.notEqual(replacement, id);
  pass(
    'A fresh pickup after reporting shows chooser → single-bottle shake → editor and excludes the reported beginning',
  );
  await button(guest, 'Skip this bottle').click();
  await choose(guest);
  await button(guest, 'Open bottle').click();
  await editor(guest).waitFor();
  assert.equal(
    await guest.evaluate(
      () => window.driftTestGame.snapshot().rounds.find((r) => r.stage === 'reply').skips,
    ),
    1,
  );
  pass('Skipping follows the same chooser/open sequence and uses exactly one skip');
  const invited = await make();
  await invited.goto(`${origin}/?bottle=${otherId}`);
  await waitForGameConnection(invited);
  await button(invited, 'Write an ending').click();
  await single(invited);
  await button(invited, 'Back to sea').click();
  await button(invited, 'Resume your ending').waitFor();
  await button(invited, 'Resume your ending').click();
  await single(invited);
  await button(invited, 'Open bottle').focus();
  await invited.keyboard.press('Enter');
  await editor(invited).waitFor();
  assert.deepEqual(await invited.evaluate(() => window.pickupSteps), ['open']);
  assert.equal(await invited.evaluate(() => window.driftTestGame.snapshot().rounds.length), 1);
  pass(
    'Invitation cancel/resume preserves its one round, skips the chooser again, and allows keyboard opening',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('checks.json', out),
    JSON.stringify(
      {
        checks,
        errors,
        scope:
          'Disposable keyless local multiwriter flow, real report/skip/invitation reducers; pointer shake, tap and keyboard. No provider calls or production stories.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
