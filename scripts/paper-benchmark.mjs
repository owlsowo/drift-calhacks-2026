import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { waitForGameConnection } from './browser-game-state.mjs';
const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-paper-benchmark-'))
  throw Error('Use the isolated benchmark runner.');
const label = process.env.DRIFT_BENCHMARK_LABEL || 'before';
if (!['before', 'after'].includes(label)) throw Error('Use before or after.');
await fs.mkdir('.ecc/benchmarks', { recursive: true });
await fs.mkdir('docs/evidence/paper-perf', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const cases = [],
  errors = [];
try {
  for (const delayMs of [0, 650, 2500]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      reducedMotion: 'no-preference',
    });
    await context.addInitScript(() => {
      window.__paperTiming = { frames: [], phases: [] };
      const names = new WeakMap();
      const location = WebGLRenderingContext.prototype.getUniformLocation;
      WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
        const value = location.call(this, program, name);
        if (value) names.set(value, name);
        return value;
      };
      const uniform = WebGLRenderingContext.prototype.uniform1f;
      WebGLRenderingContext.prototype.uniform1f = function (location, value) {
        if (names.get(location) === 'uProgress')
          window.__paperTiming.frames.push({ at: performance.now(), progress: value });
        return uniform.call(this, location, value);
      };
      let previous;
      new MutationObserver(() => {
        const phase = document.querySelector('.paper-note')?.getAttribute('data-paper-phase');
        if (phase && phase !== previous) {
          previous = phase;
          window.__paperTiming.phases.push({ phase, at: performance.now() });
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-paper-phase'],
      });
    });
    let releaseTexture;
    const opening = new Promise((resolve) => {
      releaseTexture = resolve;
    });
    let textureFinished;
    const fulfilled = new Promise((resolve) => {
      textureFinished = resolve;
    });
    await context.route('**/assets/paper-texture.jpg', async (route) => {
      await opening;
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.fulfill({ response: await route.fetch() });
      textureFinished();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin);
    await waitForGameConnection(page);
    await page
      .getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true })
      .click();
    const open = page.getByRole('button', { name: 'Open bottle', exact: false });
    await open.waitFor();
    releaseTexture();
    await open.click();
    await page.locator('.paper-open textarea').waitFor();
    const timing = await page.evaluate(() => window.__paperTiming);
    const seaContext = await page.evaluate(() =>
      document.querySelector('.sea-surface')?.getContext('webgl')?.getContextAttributes(),
    );
    await fulfilled;
    await page.screenshot({
      path: `docs/evidence/paper-perf/${label}-${delayMs}ms.png`,
      fullPage: true,
    });
    const started = timing.phases.find((p) => p.phase === 'unfolding').at;
    const ended = timing.phases.find((p) => p.phase === 'open').at;
    const first = timing.frames[0],
      last = timing.frames.at(-1);
    const result = {
      textureDelayMs: delayMs,
      openMs: Math.round(ended - started),
      meshFrames: timing.frames.length,
      firstMeshProgress: first?.progress ?? null,
      lastMeshProgress: last?.progress ?? null,
      meshVisibleMs: first ? Math.round(ended - first.at) : 0,
      seaAntialias: seaContext?.antialias ?? null,
    };
    cases.push(result);
    console.log(JSON.stringify(result));
    assert.ok(result.openMs < 3500, 'The note becomes usable without an unbounded asset wait');
    if (label === 'after' && first) {
      assert.ok(first.progress < 0.05, 'An available mesh starts at its crumpled beginning');
      assert.equal(last.progress, 1, 'A mesh reaches its final sheet before content opens');
    }
    if (label === 'after' && delayMs > 200) {
      assert.equal(result.meshFrames, 0, 'A late image cannot switch into a half-finished mesh');
      assert.ok(result.openMs >= 2000, 'The selected CSS fallback gets its complete opening');
    }
    await context.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(errors, []);
const sources = {};
for (const name of [
  'apps/web/src/PaperNote.tsx',
  'apps/web/src/PaperSurface.tsx',
  'apps/web/src/surface.ts',
  'apps/web/src/shore.css',
])
  sources[name] = crypto
    .createHash('sha256')
    .update(await fs.readFile(name))
    .digest('hex');
await fs.writeFile(
  `.ecc/benchmarks/paper-${label}.json`,
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      sourceState: 'Working tree at measurement; sourceHashes identify the tested content',
      sourceHashes: sources,
      viewport: [390, 844],
      engine: 'Actual desktop Chrome, touch viewport',
      mode: 'Isolated Vite development harness; AI off, synthetic input, texture delay injected. Animation scheduling diagnostic, not production Web Vitals, field FPS or a physical-phone benchmark.',
      cases,
      errors,
    },
    null,
    2,
  ) + '\n',
);
