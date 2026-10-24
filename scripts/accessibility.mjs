import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
try {
  for (const [width, height] of [
    [360, 800],
    [1440, 1000],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(process.env.DRIFT_WEB_URL || 'http://localhost:5173');
    await page.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
    await page.evaluate(() => document.fonts.ready);
    for (const state of ['home', 'how', 'write']) {
      if (state === 'how') await page.getByRole('button', { name: 'How to play' }).click();
      if (state === 'write') {
        await page.getByRole('button', { name: 'Close dialog' }).click();
        await page.getByRole('button', { name: 'Write my six words', exact: true }).click();
      }
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      checks.push({
        viewport: `${width}x${height}`,
        state,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      });
    }
    await context.close();
  }
  await fs.writeFile(
    new URL('../docs/evidence/accessibility.json', import.meta.url),
    JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2),
  );
  console.log(JSON.stringify(checks, null, 2));
  if (checks.some((c) => c.violations.length)) process.exitCode = 1;
} finally {
  await browser.close();
}
