import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use the isolated demo runner.');
const root = path.resolve(new URL('../', import.meta.url).pathname);
const rehearsal = process.argv.includes('--rehearse');
const work = path.resolve(root, '../work/demo');
const output = path.resolve(root, '../outputs');
const rehearsalFile = path.join(work, 'rehearsal.json');
await fs.mkdir(work, { recursive: true });
await fs.mkdir(output, { recursive: true });
if (!rehearsal) {
  const last = JSON.parse(await fs.readFile(rehearsalFile, 'utf8'));
  if (!last.passed || Date.now() - Date.parse(last.checkedAt) > 3600000)
    throw Error('Run demo:rehearse successfully before recording.');
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fieldMap = [];
const steps = [];
const errors = [];
const contexts = [];
const wait = async (ms) => {
  if (!rehearsal) await new Promise((r) => setTimeout(r, ms));
};
async function context() {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true,
    reducedMotion: 'no-preference',
    ...(!rehearsal
      ? { recordVideo: { dir: path.join(work, 'raw'), size: { width: 1280, height: 720 } } }
      : {}),
  });
  contexts.push(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, started: Date.now() };
}
async function discover(page, stage) {
  const fields = await page.evaluate(() =>
    [...document.querySelectorAll('button,textarea,input,select')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({
        tag: el.tagName,
        type: el.type || '',
        text: el.textContent.trim().slice(0, 60),
        label: el.getAttribute('aria-label') || '',
      })),
  );
  fieldMap.push({ stage, fields });
}
async function ready(page, label) {
  await page.goto(origin);
  await page.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('.sandbox-banner').innerText(), /AI checks are off/);
  await discover(page, label + ' / home');
  if (!rehearsal)
    await page.evaluate((writer) => {
      const style = document.createElement('style');
      style.textContent = `#demo-note{position:fixed;bottom:0;left:0;right:0;z-index:999998;padding:13px 24px;background:#173e40;color:#fffdf6;font:15px 'DM Sans',sans-serif;pointer-events:none;display:flex;justify-content:space-between;gap:20px}#demo-cursor{position:fixed;z-index:999999;pointer-events:none;left:10px;top:10px;filter:drop-shadow(1px 1px 2px #0005)}`;
      document.head.appendChild(style);
      const bar = document.createElement('div');
      bar.id = 'demo-note';
      const caption = document.createElement('span');
      caption.id = 'demo-caption';
      caption.textContent = writer;
      const provenance = document.createElement('span');
      provenance.textContent = 'LOCAL SANDBOX · AI CHECKS OFF · SYNTHETIC WRITERS';
      bar.append(caption, provenance);
      document.body.appendChild(bar);
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="#173e40" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.body.appendChild(cursor);
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
    }, label);
}
async function caption(page, text) {
  if (!rehearsal)
    await page.locator('#demo-caption').evaluate((el, value) => {
      el.textContent = value;
    }, text);
}
async function click(page, locator, label) {
  await locator.waitFor({ state: 'visible' });
  assert.equal(await locator.count(), 1, label + ' is unique');
  if (!rehearsal) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    await wait(300);
  }
  await locator.click();
  steps.push(label);
  await wait(1200);
}
async function type(page, text) {
  const box = page.getByRole('textbox');
  await click(page, box, 'Focus editable six-word line');
  await box.fill('');
  if (rehearsal) await box.fill(text);
  else await box.pressSequentially(text, { delay: 35 });
  await wait(700);
}
async function shake(page, label) {
  await page.waitForFunction(() => !document.querySelector('.bottle-grip')?.disabled);
  await page.locator('.bottle-grip').scrollIntoViewIfNeeded();
  const box = await page.locator('.bottle-grip').boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 15 });
  await page.mouse.down();
  for (const dx of [65, -65, 65, -65, 65]) {
    await page.waitForTimeout(120);
    await page.mouse.move(x + dx, y);
  }
  await page.mouse.up();
  steps.push(label);
  await wait(1200);
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
let success = false;
try {
  // Writer B contributes a real fixture through the UI before the filmed Writer A begins.
  const B = await context();
  await ready(B.page, 'Writer B · an independent guest identity');
  await click(B.page, button(B.page, 'Write my six words'), 'B starts a round');
  await B.page.getByRole('textbox').waitFor();
  await discover(B.page, 'write / real textarea');
  await type(B.page, 'I challenged their shark to poker.');
  await click(B.page, button(B.page, 'Toss my bottle'), 'B tosses a setup');
  await button(B.page, 'Catch a bottle').waitFor();
  const A = await context();
  await ready(A.page, 'Step 1 · Write six words');
  await wait(2500);
  await shake(A.page, 'A shakes the bottle to start a round');
  await type(A.page, 'I taught the octopus insider trading.');
  await click(A.page, button(A.page, 'Toss my bottle'), 'A tosses a setup');
  await button(A.page, 'Catch a bottle').waitFor();
  await caption(A.page, 'Step 2 · Catch another writer’s setup');
  await discover(A.page, 'catch / approved setup is waiting');
  await shake(A.page, 'A shakes the bottle to catch B’s setup');
  await click(
    A.page,
    A.page.getByRole('button', { name: 'Open bottle', exact: false }),
    'A unfolds the note over the sea',
  );
  await A.page.getByText('I challenged their shark to poker.', { exact: true }).waitFor();
  await discover(A.page, 'reply / assignment and editable ending');
  await wait(2200);
  await caption(A.page, 'Step 3 · Write your own six-word ending');
  await type(A.page, 'Our lawyers would like another hand.');
  await wait(1200);
  const returnStart = Math.max(0, (Date.now() - B.started) / 1000 - 2);
  await caption(B.page, 'Meanwhile · Writer B receives the return live');
  await click(A.page, button(A.page, 'Seal our postcard'), 'A seals the canonical postcard');
  await A.page.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
  await button(B.page, 'My postcards 1').waitFor();
  await caption(A.page, 'Step 4 · Keep the postcard you made together');
  await discover(A.page, 'reveal / actual public postcard');
  assert.equal(await A.page.locator('.human-seal').count(), 1);
  await wait(4000);
  const download = A.page.waitForEvent('download');
  await click(A.page, button(A.page, 'Save image'), 'A downloads the real postcard image');
  await (await download).saveAs(path.join(work, 'recorded-postcard.png'));
  await wait(2000);
  const aVideo = A.page.video();
  await A.ctx.close();
  await click(B.page, button(B.page, 'My postcards 1'), 'B opens the live returned postcard');
  await discover(B.page, 'collection / returned card from another identity');
  await click(B.page, B.page.locator('.collection-card'), 'B reads the same canonical postcard');
  await B.page.getByText('Our lawyers would like another hand.', { exact: true }).waitFor();
  await caption(B.page, 'Same postcard · returned without refreshing');
  await wait(4000);
  const bVideo = B.page.video();
  await B.ctx.close();
  assert.deepEqual(errors, []);
  if (rehearsal) {
    await fs.writeFile(
      rehearsalFile,
      JSON.stringify(
        { passed: true, checkedAt: new Date().toISOString(), fieldMap, steps },
        null,
        2,
      ),
    );
    console.log('Discovery and rehearsal passed:', steps.length, 'actions');
  } else {
    const aPath = await aVideo.path(),
      bPath = await bVideo.path();
    const result = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        aPath,
        '-ss',
        String(returnStart),
        '-i',
        bPath,
        '-filter_complex',
        '[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]',
        '-map',
        '[v]',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        path.join(output, 'drift-local-demo.mp4'),
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) throw Error('Video assembly failed: ' + result.stderr);
    const record = {
      checkedAt: new Date().toISOString(),
      environment: 'isolated local SpacetimeDB sandbox',
      aiChecks: false,
      syntheticWriters: true,
      authoredVia: 'browser UI automation',
      inputLines: [
        'I challenged their shark to poker.',
        'I taught the octopus insider trading.',
        'Our lawyers would like another hand.',
      ],
      preparation: 'Writer B contributed a setup before Writer A’s clip began.',
      edit: 'Writer A’s flow followed by Writer B’s overlapping live-return view from the same run. No generated application frames or model outputs.',
      steps,
      errors,
      artifact: 'drift-local-demo.mp4',
    };
    await fs.writeFile(
      path.join(output, 'drift-local-demo-evidence.json'),
      JSON.stringify(record, null, 2),
    );
    console.log('Recorded real sandbox flow:', path.join(output, 'drift-local-demo.mp4'));
  }
  success = true;
} finally {
  await browser.close();
  if (!success) console.error('Demo failed; no completed artifact is claimed.');
}
