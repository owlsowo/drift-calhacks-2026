import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use the isolated test-room runner.');
const out = 'docs/evidence/recovery/';
await fs.mkdir(out, { recursive: true });
const checks = [],
  errors = [];
const line = 'Our lawyers would like another hand.';
const priorLine = 'I should have stayed on land.';
const button = (page, name) => page.getByRole('button', { name, exact: true });
function pass(engine, name) {
  checks.push({ engine, name });
  console.log('PASS', engine, name);
}
async function capture(page, name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  await page.screenshot({ path: out + name + '.png', fullPage: true });
}
for (const [engine, launcher] of [
  ['Chrome', chromium],
  ['WebKit', webkit],
]) {
  const browser = await launcher.launch(
    engine === 'Chrome' ? { channel: 'chrome', headless: true } : { headless: true },
  );
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin);
    await page.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
    await page.evaluate(async () => (await import('/src/game.ts')).game.refresh());
    await page.clock.install();
    await page.evaluate(() => {
      window.__draftCopies = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text) => window.__draftCopies.push(text) },
      });
    });
    await button(page, 'Pick up a bottle').click();
    await page.getByRole('button', { name: 'Open bottle', exact: false }).click();
    await page.getByRole('textbox').fill(priorLine);
    await button(page, 'Skip this bottle').click();
    await button(page, 'Catch a bottle').click();
    await page.getByRole('button', { name: 'Open bottle', exact: false }).click();
    await page.getByRole('textbox').fill(line);
    await button(page, 'My postcards').click();
    await page.getByText('Your earlier words', { exact: true }).click();
    assert.equal(await page.locator('.earlier-draft blockquote').innerText(), priorLine);
    await button(page, 'Copy this draft').click();
    await button(page, 'Today’s bottle').click();
    assert.equal(await page.getByRole('textbox').inputValue(), line);
    pass(
      engine,
      'A real skipped catch remains copyable in local earlier words, without duplicating or replacing the active draft',
    );
    await page.setViewportSize({ width: 390, height: 430 });
    await page.getByRole('textbox').focus();
    await button(page, 'Seal our postcard').scrollIntoViewIfNeeded();
    const actionBox = await button(page, 'Seal our postcard').boundingBox();
    assert.ok(actionBox && actionBox.y >= -1 && actionBox.y + actionBox.height <= 431);
    assert.equal(await page.getByRole('textbox').inputValue(), line);
    await capture(page, engine.toLowerCase() + '-short-screen');
    pass(
      engine,
      'A short 390×430 viewport preserves the draft and reachable controls without horizontal overflow',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await page.evaluate(async () => {
      const s = (await import('/src/game.ts')).game.snapshot();
      return {
        identity: s.identity,
        round: s.rounds.find((r) => r.stage === 'reply'),
        offset: s.clockOffsetMs,
      };
    });
    // Anchor the UI-only deadline around noon so the expiry case remains
    // deterministic even when this regression runs just before midnight.
    const pastDeadline = state.round.day * 86400000 + 12 * 3600000 + 61000;
    await page.evaluate(
      async ({ roundId, leaseMs }) => {
        const round = (await import('/src/game.ts')).game
          .snapshot()
          .rounds.find((r) => r.id === roundId);
        round.leaseMs = leaseMs;
      },
      { roundId: state.round.id, leaseMs: pastDeadline - 1000 },
    );
    await page.clock.setFixedTime(new Date(pastDeadline - state.offset));
    await page.locator('.expiry-recovery').waitFor();
    assert.equal(await button(page, 'Seal our postcard').isDisabled(), true);
    assert.equal(await page.locator('.nudge-button').isDisabled(), true);
    assert.equal(await page.getByRole('textbox').inputValue(), line);
    await button(page, 'Copy my draft').click();
    assert.deepEqual(await page.evaluate(() => window.__draftCopies), [priorLine, line]);
    // The module regression verifies the real reassignment transition.
    // Inject its UI projection here without waiting ten minutes.
    await page.evaluate(async () => {
      (await import('/src/game.ts')).game.snapshot().assignments.splice(0);
    });
    await page.clock.setFixedTime(new Date(pastDeadline + 1000 - state.offset));
    await page.waitForFunction(() => !document.querySelector('.caught-note'));
    assert.equal(await page.locator('.expiry-recovery').isVisible(), true);
    assert.equal(await page.getByRole('textbox').inputValue(), line);
    await capture(page, engine.toLowerCase() + '-expired-catch');
    pass(
      engine,
      'Injected past-deadline/withheld-assignment UI disables paid actions, explains expiry and copies the retained ending',
    );
    await page.evaluate(({ identity, round }) => {
      localStorage.setItem(
        `drift:draft:another-identity:${round.id}:private`,
        JSON.stringify({
          driftDraft: 1,
          text: 'OTHER IDENTITY PRIVATE DRAFT',
          expiresAt: Date.now() + 86400000,
        }),
      );
      localStorage.setItem(
        `drift:draft:${identity}:${round.id}:expired-fixture`,
        JSON.stringify({
          driftDraft: 1,
          text: 'EXPIRED PRIVATE DRAFT',
          expiresAt: Date.now() - 1,
        }),
      );
    }, state);
    await page.clock.setFixedTime(
      new Date(
        Math.max((state.round.day + 1) * 86400000 + 60000, pastDeadline + 60000) - state.offset,
      ),
    );
    await page.getByRole('heading', { name: 'A fresh tide.', exact: true }).waitFor();
    assert.equal(await page.locator('.steps').count(), 0);
    await page.getByText('Your earlier words', { exact: true }).click();
    await page.locator('.earlier-draft blockquote').filter({ hasText: line }).waitFor();
    assert.equal(await page.getByText('OTHER IDENTITY PRIVATE DRAFT', { exact: true }).count(), 0);
    assert.equal(await page.getByText('EXPIRED PRIVATE DRAFT', { exact: true }).count(), 0);
    await page
      .locator('.earlier-draft')
      .filter({ hasText: line })
      .getByRole('button', { name: 'Copy this draft', exact: true })
      .click();
    assert.equal((await page.evaluate(() => window.__draftCopies)).at(-1), line);
    await capture(page, engine.toLowerCase() + '-daily-reset');
    await button(page, 'My postcards').click();
    await page.getByText('Your earlier words', { exact: true }).click();
    assert.deepEqual(
      (await page.locator('.earlier-draft blockquote').allTextContents()).sort(),
      [priorLine, line].sort(),
    );
    pass(
      engine,
      'An injected daily reset exposes only this identity’s unexpired words, with copying available in the closed round and collection',
    );
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
      mode: 'Isolated local sandbox, AI off, real database catch/skip with synthetic input. UI clock, lease/withheld-assignment projection and clipboard injected; server clock is unchanged.',
      checks,
      errors,
      limits: [
        'No physical keyboard/device check',
        'Not an actual ten-minute or overnight wait',
        'Authoritative server expiry is covered separately by the module time-boundary tests',
      ],
    },
    null,
    2,
  ) + '\n',
);
