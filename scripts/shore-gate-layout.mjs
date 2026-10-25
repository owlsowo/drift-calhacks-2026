import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL,
  database = process.env.DRIFT_TEST_DATABASE;
if (!origin?.startsWith('http://127.0.0.1:') || !database?.startsWith('drift-test-'))
  throw Error('Use npm run test:gate-layout.');
const checks = [],
  errors = [],
  out = new URL('../docs/evidence/', import.meta.url);
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
const button = (p, name) => p.getByRole('button', { name, exact: true });
const chrome = await chromium.launch({ channel: 'chrome' });
let safari;
async function context(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    window.testWidgetRenders = 0;
    window.turnstile = {
      render(node) {
        window.testWidgetRenders++;
        const box = document.createElement('div');
        box.className = 'mock-human-check';
        box.textContent = 'Human check placeholder (local test)';
        Object.assign(box.style, {
          width: '300px',
          height: '65px',
          display: 'grid',
          placeItems: 'center',
          background: '#fafafa',
          color: '#172331',
          font: '12px Arial',
        });
        node.append(box);
        return 'mock-widget';
      },
      remove() {
        document.querySelectorAll('.mock-human-check').forEach((el) => el.remove());
      },
      reset() {},
    };
  });
  return ctx;
}
async function ready(ctx, url = origin) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await waitForGameConnection(p);
  return p;
}
async function capture(p, name) {
  await p.screenshot({ path: new URL(`shore-gate-${name}.png`, out).pathname, fullPage: true });
  const result = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No horizontal overflow',
  );
}
try {
  const authorContext = await context(chrome, 1440, 1000);
  const A = await ready(authorContext);
  await A.getByRole('button', { name: /^Release a bottle/ }).click();
  const example = await A.evaluate(
    () => JSON.parse(window.driftTestGame.snapshot().today.promptJson).exampleSetup,
  );
  await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(example);
  await button(A, 'Release').click();
  await A.locator('.shore-home').waitFor();
  const id = await A.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
  await A.getByRole('button', { name: /^Release a bottle/ }).click();
  await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(
    'A saved local draft',
  );
  const writer = await context(chrome, 390, 844),
    W = await ready(writer, `${origin}/?bottle=${encodeURIComponent(id)}`);
  await button(W, 'Write an ending').click();
  await button(W, 'Open bottle').click();
  await W.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(
    'Our lawyers would like another hand.',
  );
  await button(W, 'Send reply').click();
  await W.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  await button(A, 'Open returned postcard').waitFor();
  const update = spawnSync(process.execPath, ['scripts/spacetime.mjs', 'publish-test', database], {
    env: { ...process.env, DRIFT_TEST_GATE: 'true' },
    encoding: 'utf8',
  });
  assert.equal(update.status, 0, 'Only this disposable local module receives a synthetic secret');
  await A.locator('.shore-gate--inline .mock-human-check').waitFor();
  await capture(A, 'open-draft');
  assert.equal(
    await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).inputValue(),
    'A saved local draft',
  );
  pass('A newly required human check stays inside the writing view and preserves its local draft');
  await button(A, 'Drift home').click();
  await A.setViewportSize({ width: 390, height: 844 });
  await button(A, 'Open returned postcard').waitFor();
  assert.equal(await A.locator('.shore-gate').count(), 0);
  assert.equal(await A.getByRole('button', { name: /^Release a bottle/ }).isDisabled(), true);
  assert.ok(await A.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  await capture(A, 'return-before-check');
  await button(A, 'Dismiss returned bottle notice').click();
  await A.locator('.shore-gate--shore .mock-human-check').waitFor();
  assert.equal(await A.getByRole('button', { name: /^Release a bottle/ }).isDisabled(), true);
  pass(
    'A real return takes shore notice priority; dismissing it reveals the pending check, with writing protected throughout',
  );
  for (const [width, height] of [
    [390, 844],
    [320, 740],
    [740, 360],
  ]) {
    const ctx = await context(chrome, width, height),
      p = await ready(ctx);
    await p.locator('.shore-gate--shore .mock-human-check').waitFor();
    const boxes = await p.evaluate(() => {
      const r = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, bottom: b.bottom, right: b.right };
      };
      return {
        header: r('.site-header'),
        gate: r('.shore-gate'),
        widget: r('.mock-human-check'),
        dock: r('.shore-dock'),
        height: innerHeight,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    assert.ok(boxes.gate.y >= boxes.header.bottom + 8, JSON.stringify(boxes));
    assert.ok(boxes.dock.bottom <= height + 1, JSON.stringify(boxes));
    assert.ok(boxes.pageHeight <= height + 1, JSON.stringify(boxes));
    assert.ok(boxes.widget.x >= 0 && boxes.widget.right <= width, JSON.stringify(boxes));
    assert.ok(boxes.gate.bottom <= height, JSON.stringify(boxes));
    assert.equal(await p.getByRole('button', { name: /^Release a bottle/ }).isDisabled(), true);
    assert.equal(
      await p
        .getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true })
        .isDisabled(),
      true,
    );
    await button(p, 'Retry shore check').click();
    await p.locator('.mock-human-check').waitFor();
    await capture(p, `chrome-${width}x${height}`);
  }
  pass(
    'Portrait, narrow-phone and short-landscape shore checks leave the header and dock in view without moving the page or enabling writes',
  );
  const guest = await context(chrome, 320, 740),
    B = await ready(guest, `${origin}/?bottle=${encodeURIComponent(id)}`);
  await B.locator('.paper-open .letter-text').waitFor();
  await B.locator('.shore-gate--inline .mock-human-check').waitFor();
  const positions = await B.evaluate(() => {
    const note = document.querySelector('.paper-open').getBoundingClientRect(),
      gate = document.querySelector('.shore-gate').getBoundingClientRect(),
      widget = document.querySelector('.mock-human-check').getBoundingClientRect();
    return {
      noteBottom: note.bottom,
      gateTop: gate.top,
      widgetX: widget.x,
      widgetRight: widget.right,
    };
  });
  assert.ok(positions.gateTop >= positions.noteBottom);
  assert.ok(positions.widgetX >= 0 && positions.widgetRight <= 320);
  assert.equal(await button(B, 'Write an ending').isDisabled(), true);
  await capture(B, 'public-invitation');
  pass(
    'A public invitation shows its words before the inline check, with the write action still protected and the 300px widget fitting a narrow phone',
  );
  const reader = await context(chrome, 390, 844),
    R = await ready(reader, `${origin}/?card=missing-read-only`);
  await R.getByRole('heading', { name: 'Reply unavailable', exact: true }).waitFor();
  assert.equal(await R.locator('.shore-gate').count(), 0);
  assert.equal(await R.evaluate(() => window.testWidgetRenders), 0);
  await button(R, 'Back to bottles').click();
  await button(R, 'Start at the sea').click();
  await R.locator('.shore-gate--shore .mock-human-check').waitFor();
  assert.equal(await R.getByRole('button', { name: /^Release a bottle/ }).isDisabled(), true);
  pass(
    'Read-only postcards load no challenge, and an empty shelf leads back to verification without a dead writing button',
  );
  safari = await webkit.launch();
  const S = await ready(await context(safari, 390, 844));
  await S.locator('.shore-gate--shore .mock-human-check').waitFor();
  assert.ok(await S.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  await capture(S, 'webkit-phone');
  pass('WebKit preserves the phone-sized shore with the same blocked-write layout');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('shore-gate-layout.json', out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'Isolated local sandbox, synthetic gate secret and inert 300px widget placeholder. No challenge solved, valid pass issued, external Turnstile request or provider call; this is layout/accessibility verification, not production human-check verification.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await chrome.close();
  await safari?.close();
}
