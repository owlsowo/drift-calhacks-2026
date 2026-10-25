import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (
  !origin?.startsWith('http://127.0.0.1:') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-paper-continuity-')
)
  throw Error('Use npm run test:paper-continuity.');
const out = new URL('../docs/evidence/paper-continuity/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const baseline = process.env.DRIFT_PAPER_VISUAL_BASELINE === 'before';
const checks = [],
  errors = [];
for (const [engine, launcher] of baseline
  ? [['chrome', chromium]]
  : [
      ['chrome', chromium],
      ['webkit', webkit],
    ]) {
  const browser = await launcher.launch(engine === 'chrome' ? { channel: 'chrome' } : {});
  try {
    for (const mode of baseline ? ['fallback'] : ['mesh', 'fallback']) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'no-preference',
      });
      if (mode === 'fallback')
        await context.addInitScript(() => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (name, ...args) {
            if (name === 'webgl' || name === 'experimental-webgl') return null;
            return get.call(this, name, ...args);
          };
        });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin);
      await waitForGameConnection(page);
      await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = resolve;
            image.onerror = reject;
            image.src = '/assets/paper-texture.jpg';
          }),
      );
      await page
        .getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true })
        .click();
      await page.getByRole('button', { name: 'Open bottle', exact: true }).click();
      await page
        .locator(
          mode === 'mesh'
            ? '.paper-unfolding.has-paper-mesh'
            : '.paper-unfolding:not(.paper-waiting)',
        )
        .waitFor();
      const sample = await page.evaluate(() => {
        const ball = document.querySelector('.unfolding-ball'),
          sheet = document.querySelector('.paper-content');
        const balls = ball.getAnimations(),
          sheets = sheet.getAnimations();
        const phases = [];
        for (const ms of [0, 200, 600, 1400]) {
          for (const a of [...balls, ...sheets]) {
            a.pause();
            a.currentTime = ms;
          }
          const b = getComputedStyle(ball),
            s = getComputedStyle(sheet),
            r = sheet.getBoundingClientRect();
          phases.push({
            at: ms,
            ballOpacity: Number(b.opacity),
            sheetOpacity: Number(s.opacity),
            sheetVisibility: s.visibility,
            sheetWidth: r.width,
            sheetHeight: r.height,
            transform: s.transform,
            clip: s.clipPath,
          });
        }
        for (const a of [...balls, ...sheets]) a.currentTime = 600;
        return { ballAnimations: balls.length, sheetAnimations: sheets.length, phases };
      });
      const name = `${engine}-${mode}-${baseline ? 'before' : 'after'}`;
      await fs.writeFile(new URL(name + '.json', out), JSON.stringify(sample, null, 2) + '\n');
      await page.screenshot({ path: new URL(name + '.png', out).pathname, fullPage: true });
      assert.ok(
        sample.ballAnimations > 0,
        'The ball must have a real animation, not an undefined keyframe name',
      );
      assert.ok(
        sample.phases[0].ballOpacity > 0.9 && sample.phases[2].ballOpacity < 0.01,
        'The ball fades away during the handoff rather than remaining over the opening sheet',
      );
      if (mode === 'fallback') {
        assert.ok(sample.sheetAnimations > 0, 'Fallback must have real opening keyframes');
        assert.ok(
          sample.phases[0].sheetWidth < sample.phases[2].sheetWidth * 0.6,
          'Fallback begins crumpled and spreads into a sheet',
        );
        assert.ok(
          sample.phases[2].sheetWidth < sample.phases[3].sheetWidth,
          'Sheet continues relaxing through the opening',
        );
      } else
        assert.equal(
          sample.phases[2].sheetVisibility,
          'hidden',
          'The DOM sheet stays hidden while the connected mesh draws',
        );
      await page.evaluate(() =>
        document
          .querySelectorAll('.unfolding-ball,.paper-content')
          .forEach((el) => el.getAnimations().forEach((a) => a.play())),
      );
      await page.locator('.paper-open textarea').waitFor({ timeout: 4500 });
      assert.equal(await page.locator('.unfolding-ball,.paper-surface').count(), 0);
      await page
        .getByRole('textbox', { name: 'Your six-word ending', exact: true })
        .fill('Our lawyers would like another hand.');
      assert.equal(
        await page.getByRole('button', { name: 'Send reply', exact: true }).isEnabled(),
        true,
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      checks.push({
        engine,
        mode,
        check:
          'Actual CSS handoff and intermediate sheet shape, then readable/editable note with disposed animation layers',
      });
      console.log('PASS', engine, mode);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
assert.deepEqual(errors, []);
await fs.writeFile(
  new URL('checks.json', out),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      mode: 'Isolated synthetic local sandbox; actual desktop Chrome/WebKit renderers, 390px viewport. CSS animation clocks sampled at controlled positions; fallback WebGL support is injected off. No provider calls or production data.',
      checks,
      errors,
    },
    null,
    2,
  ) + '\n',
);
