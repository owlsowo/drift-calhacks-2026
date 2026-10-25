import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-paper-fallbacks-'))
  throw Error('Use the isolated runner.');
const out = 'docs/evidence/paper-perf/';
await fs.mkdir(out, { recursive: true });
const checks = [],
  errors = [];
for (const [engine, launcher] of [
  ['Chrome', chromium],
  ['WebKit', webkit],
]) {
  const browser = await launcher.launch(
    engine === 'Chrome' ? { channel: 'chrome', headless: true } : { headless: true },
  );
  try {
    for (const fault of ['no-webgl', 'image-failure', 'context-loss', 'reduce-mid-opening']) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'no-preference',
        hasTouch: true,
      });
      if (fault === 'no-webgl')
        await context.addInitScript(() => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (name, ...args) {
            if (name === 'webgl' || name === 'experimental-webgl') return null;
            return get.call(this, name, ...args);
          };
        });
      if (fault === 'image-failure')
        await context.route('**/assets/paper-texture.jpg', (route) => route.abort('failed'));
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin);
      await page.getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true }).click();
      await page.getByRole('button', { name: 'Open bottle', exact: false }).click();
      if (fault === 'context-loss' || fault === 'reduce-mid-opening') {
        await page.locator('.paper-unfolding.has-paper-mesh').waitFor();
        if (fault === 'context-loss')
          await page.evaluate(() => {
            const surface = document.querySelector('.paper-surface');
            const loss = surface.getContext('webgl').getExtension('WEBGL_lose_context');
            if (!loss) throw Error('Context-loss extension unavailable in this test engine');
            loss.loseContext();
          });
        else await page.emulateMedia({ reducedMotion: 'reduce' });
      }
      await page.locator('.paper-open textarea').waitFor({ timeout: 4000 });
      assert.equal(await page.locator('.paper-content').getAttribute('inert'), null);
      assert.equal(await page.locator('.paper-surface').count(), 0);
      await page.getByRole('textbox').fill('Our lawyers would like another hand.');
      assert.equal(
        await page.getByRole('button', { name: 'Send reply', exact: true }).isEnabled(),
        true,
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      assert.deepEqual(
        scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        [],
      );
      if (fault === 'reduce-mid-opening')
        await page.locator('.sea-surface[data-motion="paused"]').waitFor();
      await page.screenshot({ path: `${out}${engine.toLowerCase()}-${fault}.png`, fullPage: true });
      checks.push({
        engine,
        fault,
        result:
          'Readable, editable note with enabled submission; surface disposed and selected accessibility checks pass',
      });
      console.log('PASS', engine, fault);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
assert.deepEqual(errors, []);
await fs.writeFile(
  out + 'fallbacks.json',
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      mode: 'Actual desktop Chrome/WebKit with touch viewport, injected rendering/image/preference faults; local sandbox, AI off, synthetic input, no provider calls',
      checks,
      errors,
      limits: ['Not a physical-phone, OS preference, GPU-loss or assistive-technology user test'],
    },
    null,
    2,
  ) + '\n',
);
