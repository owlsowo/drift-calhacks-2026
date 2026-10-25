import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.DRIFT_WEB_URL;
if (
  !origin?.startsWith('http://127.0.0.1:') ||
  !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-keepsake-')
)
  throw Error('Use npm run test:keepsake.');
const baseline = process.env.DRIFT_KEEP_BASELINE === 'before',
  checks = [],
  errors = [];
const out = new URL('../docs/evidence/', import.meta.url);
for (const [engine, launcher] of baseline
  ? [['Chrome', chromium]]
  : [
      ['Chrome', chromium],
      ['WebKit', webkit],
    ]) {
  const browser = await launcher.launch(engine === 'Chrome' ? { channel: 'chrome' } : {});
  try {
    for (const fault of baseline
      ? ['stalled-paper']
      : ['stalled-paper', 'failed-paper', 'stalled-font', 'stalled-unrelated-font']) {
      const context = await browser.newContext();
      if (fault === 'stalled-paper') await context.route('**/assets/paper-texture.jpg', () => {});
      if (fault === 'failed-paper')
        await context.route('**/assets/paper-texture.jpg', (r) => r.abort());
      const p = await context.newPage();
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(origin);
      const result = await p.evaluate(async (fault) => {
        const { postcardPng } = await import('/src/export.ts');
        if (fault === 'stalled-font') document.fonts.load = () => new Promise(() => {});
        if (fault === 'stalled-unrelated-font')
          Object.defineProperty(document.fonts, 'ready', {
            get: () => new Promise(() => {}),
            configurable: true,
          });
        const text = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
          text.push(value);
          return original.call(this, value, ...args);
        };
        const card = {
          id: 'synthetic-keep-' + fault,
          promptId: 'aquarium',
          setup: 'I challenged their shark to poker.',
          reply: 'Our lawyers would like another hand.',
          seeded: false,
          createdMs: Date.parse('2026-10-24T12:00:00Z'),
        };
        const started = performance.now();
        const result = await Promise.race([
          postcardPng(card).then(async (blob) => {
            const bitmap = await createImageBitmap(blob);
            return {
              state: 'complete',
              width: bitmap.width,
              height: bitmap.height,
              type: blob.type,
              bytes: blob.size,
              text,
            };
          }),
          new Promise((resolve) => setTimeout(() => resolve({ state: 'still-pending' }), 4000)),
        ]);
        return { ...result, elapsedMs: Math.round(performance.now() - started) };
      }, fault);
      if (baseline)
        await fs.writeFile(
          new URL('keepsake-before.json', out),
          JSON.stringify({ engine, fault, result }, null, 2) + '\n',
        );
      assert.equal(result.state, 'complete', JSON.stringify(result));
      assert.equal(result.width, 1080);
      assert.equal(result.height, 1350);
      assert.equal(result.type, 'image/png');
      assert.ok(
        result.text.join(' ').includes('shark') && result.text.join(' ').includes('lawyers'),
      );
      if (fault.includes('paper'))
        assert.ok(
          !result.text.some((s) => s.startsWith('Paper photo:')),
          'No photograph attribution claim when no photograph was drawn',
        );
      checks.push({ engine, fault, result });
      console.log('PASS', engine, fault);
      await context.close();
    }
    const context = await browser.newContext(),
      p = await context.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(origin);
    await p.evaluate(async () => {
      const { shareCard, preparePostcard } = await import('/src/export.ts');
      window.keepCard = {
        id: 'synthetic-native-share',
        promptId: 'aquarium',
        setup: 'I challenged their shark to poker.',
        reply: 'Our lawyers would like another hand.',
        seeded: false,
        createdMs: Date.parse('2026-10-24T12:00:00Z'),
      };
      window.sharePayloads = [];
      window.copiedLinks = [];
      window.shareMode = 'success';
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (payload) => {
          window.sharePayloads.push({
            files: payload.files?.map((f) => ({ type: f.type, size: f.size })),
            url: payload.url,
            active: navigator.userActivation?.isActive,
          });
          if (window.shareMode === 'cancel')
            throw new DOMException('Synthetic cancellation', 'AbortError');
          if (window.shareMode === 'deny')
            throw new DOMException('Synthetic denial', 'NotAllowedError');
        },
      });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (value) => window.copiedLinks.push(value) },
      });
      const b = document.createElement('button');
      b.textContent = 'Share fixture';
      b.id = 'share-fixture';
      b.onclick = () => {
        window.shareResult = shareCard(window.keepCard).then(
          (result) => ({ result }),
          (e) => ({ error: e.name }),
        );
      };
      document.body.append(b);
      window.prepareKeep = () => preparePostcard(window.keepCard);
    });
    await p.getByRole('button', { name: 'Share fixture', exact: true }).click();
    let r = await p.evaluate(async () => ({
      result: await window.shareResult,
      payload: window.sharePayloads.at(-1),
    }));
    assert.equal(r.result.result, 'Shared');
    assert.equal(r.payload.active, true);
    assert.ok(r.payload.url.endsWith('?card=synthetic-native-share'));
    assert.equal(r.payload.files, undefined);
    await p.evaluate(() => window.prepareKeep());
    await p.getByRole('button', { name: 'Share fixture', exact: true }).click();
    r = await p.evaluate(async () => ({
      result: await window.shareResult,
      payload: window.sharePayloads.at(-1),
    }));
    assert.equal(r.result.result, 'Shared');
    assert.equal(r.payload.active, true);
    assert.equal(r.payload.files[0].type, 'image/png');
    assert.ok(r.payload.files[0].size > 1000);
    checks.push({
      engine,
      check:
        'Native Share is invoked with active user activation immediately: URL before image preparation, actual PNG once prepared',
    });
    console.log('PASS', engine, 'native activation and prepared image');
    await p.evaluate(() => (window.shareMode = 'cancel'));
    await p.getByRole('button', { name: 'Share fixture', exact: true }).click();
    assert.deepEqual(await p.evaluate(() => window.shareResult), { error: 'AbortError' });
    assert.equal(await p.evaluate(() => window.copiedLinks.length), 0);
    await p.evaluate(() => (window.shareMode = 'deny'));
    await p.getByRole('button', { name: 'Share fixture', exact: true }).click();
    assert.deepEqual(await p.evaluate(() => window.shareResult), { result: 'Link copied' });
    assert.equal(
      await p.evaluate(() => window.copiedLinks.at(-1)),
      origin + '/?card=synthetic-native-share',
    );
    checks.push({
      engine,
      check:
        'Native cancellation stays cancelled without copying; denial falls back to the exact public story URL',
    });
    console.log('PASS', engine, 'cancel and denied share');
    await context.close();
  } finally {
    await browser.close();
  }
}
assert.deepEqual(errors, []);
await fs.writeFile(
  new URL('keepsake-checks.json', out),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      mode: 'Isolated browser export functions with synthetic story text. Image/font stalls and native sharing/clipboard adapters are injected; actual PNG is encoded and decoded. This is not a physical OS share-sheet check.',
      checks,
      errors,
    },
    null,
    2,
  ) + '\n',
);
