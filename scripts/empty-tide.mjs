import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
if (!process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-empty-'))
  throw Error('Use isolated test-room.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
try {
  for (const width of [360, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 360 ? 800 : 1000 },
      reducedMotion: 'reduce',
    });
    const p = await context.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(process.env.DRIFT_WEB_URL);
    const pick = p.getByRole('button', { name: 'Pick up a bottle', exact: true });
    await pick.click();
    await p.getByRole('heading', { name: 'The water is quiet.', exact: true }).waitFor();
    assert.equal(
      await p.evaluate(async () => (await import('/src/game.ts')).game.snapshot().rounds.length),
      0,
    );
    await p.getByRole('button', { name: 'Try again', exact: true }).click();
    await p.getByRole('heading', { name: 'The water is quiet.', exact: true }).waitFor();
    assert.equal(
      await p.evaluate(async () => (await import('/src/game.ts')).game.snapshot().rounds.length),
      0,
    );
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const axe = await new AxeBuilder({ page: p })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.deepEqual(
      axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
    await p.screenshot({ path: `docs/evidence/empty-tide-${width}.png`, fullPage: true });
    await p.getByRole('button', { name: 'Toss a beginning', exact: true }).click();
    const input = p.getByRole('textbox');
    await input.fill('Synthetic test draft stays with me.');
    await p.reload();
    await p.getByRole('button', { name: 'Pick up where you left off', exact: true }).click();
    await input.waitFor();
    assert.equal(await input.inputValue(), 'Synthetic test draft stays with me.');
    assert.deepEqual(errors, []);
    checks.push(
      `${width}px: empty pool and retry consume no round, accessible note offers write flow, draft survives reload`,
    );
    await context.close();
  }
  await fs.writeFile(
    'docs/evidence/empty-tide.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'Isolated empty production-mode database, synthetic identities, no provider key or paid calls',
        checks,
      },
      null,
      2,
    ) + '\n',
  );
  checks.forEach((c) => console.log('PASS', c));
} finally {
  await browser.close();
}
