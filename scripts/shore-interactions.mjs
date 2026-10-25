import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Run through the isolated test-room runner.');
const out = new URL('../docs/evidence/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [],
  errors = [];
const release = (page) => page.getByRole('button', { name: /^Release a bottle/ });
const pickUp = (page) => page.getByRole('button', { name: /^Pick up a bottle/ });
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
async function ready(page) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin);
  await page.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
  await page.evaluate(() => document.fonts.ready);
}
async function screen(page, name) {
  await page.screenshot({ path: out + name, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    report.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    name,
  );
}
async function shake(page, offsets = [65, -65, 65, -65, 65]) {
  await page.waitForFunction(() => {
    const bottle = document.querySelector('.bottle-grip');
    return bottle && !bottle.disabled;
  });
  const box = await page.locator('.bottle-grip').boundingBox();
  assert.ok(box, 'A physical bottle is available in the catch state');
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const offset of offsets) {
    await page.waitForTimeout(95);
    await page.mouse.move(x + offset, y);
  }
  await page.mouse.up();
}
async function phoneShake(page) {
  for (const x of [12, -12, 12, -12, 12, -12]) {
    await page.evaluate((x) => {
      const event = new Event('devicemotion');
      Object.defineProperty(event, 'acceleration', { value: { x, y: 0, z: 0 } });
      window.dispatchEvent(event);
    }, x);
    await page.waitForTimeout(95);
  }
}
async function setSeaMotion(page, paused) {
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('button', {
      name: paused ? 'Pause sea motion' : 'Resume sea motion',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.locator(`.sea-surface[data-motion="${paused ? 'paused' : 'running'}"]`).waitFor();
}
async function assertCoastImage(page) {
  const asset = await page.locator('.ocean-photograph').evaluate(async (element) => {
    const background = getComputedStyle(element).backgroundImage;
    const url = background.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!url) return { background, loaded: false };
    const image = new Image();
    const loaded = await new Promise((resolve) => {
      image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
      image.onerror = () => resolve(false);
      image.src = url;
    });
    return { background, loaded };
  });
  assert.match(asset.background, /coast-night-(wide|mobile)\.webp/);
  assert.equal(asset.loaded, true, 'The painted coastline fallback is an actual loaded asset');
}
async function openBottle(page) {
  await page.getByRole('button', { name: 'Open bottle', exact: false }).waitFor();
  assert.equal(await page.getByRole('textbox').count(), 0);
  await page.getByRole('button', { name: 'Open bottle', exact: false }).click();
  await page.locator('.paper-open textarea').waitFor();
  assert.equal(await page.locator('.paper-unfolding, .paper-surface, .unfolding-ball').count(), 0);
}
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
    recordVideo: { dir: out + 'shore-video/', size: { width: 1440, height: 1000 } },
  });
  const page = await desktop.newPage();
  await ready(page);
  assert.equal(await page.locator('.bottle-grip').count(), 0, 'Home leaves the sea unobstructed');
  assert.equal(await page.locator('.shore-dock button').count(), 3);
  assert.equal(
    await page.getByRole('button', { name: 'Pause sea motion', exact: true }).count(),
    0,
  );
  await assertCoastImage(page);
  await page.locator('.sea-surface[data-motion="running"]').waitFor();
  await page.locator('.coast-headland img').waitFor();
  const waterClip = { x: 0, y: 650, width: 90, height: 70 };
  const waveA = await page.screenshot({ clip: waterClip });
  await page.waitForTimeout(500);
  const waveB = await page.screenshot({ clip: waterClip });
  assert.notDeepEqual(waveA, waveB, 'Procedural water pixels change with time');
  await setSeaMotion(page, true);
  const stillA = await page.screenshot({ clip: waterClip });
  await page.waitForTimeout(500);
  const stillB = await page.screenshot({ clip: waterClip });
  assert.deepEqual(stillA, stillB, 'Paused water pixels remain stable');
  await setSeaMotion(page, false);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('.sea-surface[data-motion="paused"]').waitFor();
  const hiddenA = await page.screenshot({ clip: waterClip });
  await page.waitForTimeout(400);
  assert.deepEqual(hiddenA, await page.screenshot({ clip: waterClip }));
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('.sea-surface[data-motion="running"]').waitFor();
  pass('Procedural water moves, pauses through Help, resumes, and stops while the tab is hidden');
  await screen(page, 'shore-desktop.png');
  await page.setViewportSize({ width: 360, height: 740 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
    'The resting shore fits a short phone viewport',
  );
  await screen(page, 'shore-home-mobile.png');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await release(page).click();
  await page.locator('.paper-open textarea').waitFor();
  assert.equal(
    await page.evaluate(async () => (await import('/src/game.ts')).game.snapshot().rounds.length),
    1,
  );
  pass('The Release object opens a writing note directly, without an unfolding delay');
  await page.getByRole('textbox').fill('I taught the octopus insider trading.');
  await page.getByRole('button', { name: 'Release', exact: true }).click();
  await page.locator('.shore-catch').waitFor();
  await screen(page, 'shore-catch.png');
  await shake(page, [25, 50, 75, 100, 125]);
  assert.equal(await page.locator('.shore-catch').count(), 1);
  assert.equal(await page.locator('.open-bottle').count(), 0);
  pass('Single-direction dragging does not count as shaking or accidentally click the bottle');
  await page.evaluate(async () => {
    const { game } = await import('/src/game.ts');
    const claim = game.claim.bind(game);
    let failed = false;
    game.claim = async (...args) => {
      if (!failed) {
        failed = true;
        throw Error('Synthetic catch transport failure');
      }
      return claim(...args);
    };
  });
  await shake(page);
  await page.getByRole('alert').waitFor();
  assert.ok(await page.getByRole('alert').isVisible());
  await screen(page, 'shore-catch-error.png');
  pass('A failed catch leaves a visible error and permits another deliberate shake');
  await shake(page);
  await page.getByRole('button', { name: 'Open bottle', exact: false }).waitFor();
  await screen(page, 'bottle-closed.png');
  await openBottle(page);
  assert.equal(await page.locator('.ocean-world').isVisible(), true);
  await assertCoastImage(page);
  await screen(page, 'paper-open-desktop.png');
  await page.setViewportSize({ width: 360, height: 800 });
  await screen(page, 'paper-open-mobile.png');
  pass('A caught bottle opens immediately into readable paper over the same coast at both sizes');
  await page.getByRole('textbox').fill('Our lawyers would like another hand.');
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await page.locator('.postcard-paper.paper-open').waitFor();
  await screen(page, 'shore-postcard-mobile.png');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /\.png$/);
  const image = await fs.readFile(await download.path());
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  pass('Writing, catching, and sealing produces a postcard that saves as a real PNG');
  await page.evaluate(() => {
    document
      .querySelector('.sea-surface')
      .getContext('webgl')
      ?.getExtension('WEBGL_lose_context')
      ?.loseContext();
  });
  await page.locator('.sea-surface[data-motion="fallback"]').waitFor();
  await assertCoastImage(page);
  assert.equal(await page.locator('.coast-headland').count(), 0);
  pass('Losing the graphics context returns to the painted coast without a duplicate headland');
  const video = page.video();
  await desktop.close();
  await video.saveAs(out + 'shore-video.webm');

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await mobile.addInitScript(() => {
    window.__motionRequests = 0;
    Object.defineProperty(DeviceMotionEvent, 'requestPermission', {
      configurable: true,
      value: async () => (++window.__motionRequests === 1 ? 'denied' : 'granted'),
    });
  });
  const phone = await mobile.newPage();
  await ready(phone);
  await phone.locator('.sea-surface[data-motion="paused"]').waitFor();
  assert.equal(await phone.locator('.phone-shake').count(), 0);
  await phoneShake(phone);
  assert.equal(await phone.locator('.shore-home').count(), 1);
  assert.equal(await phone.evaluate(() => window.__motionRequests), 0);
  await release(phone).click();
  await phone.getByRole('textbox').fill('I challenged their shark to poker.');
  await phone.getByRole('button', { name: 'Release', exact: true }).click();
  await phone.locator('.shore-catch').waitFor();
  await phoneShake(phone);
  assert.equal(await phone.locator('.shore-catch').count(), 1);
  await phone.getByRole('button', { name: 'Enable phone shake', exact: true }).click();
  await phone.getByRole('status').filter({ hasText: 'Motion wasn’t enabled.' }).waitFor();
  await screen(phone, 'phone-motion-denied.png');
  await phoneShake(phone);
  assert.equal(await phone.locator('.shore-catch').count(), 1);
  pass('Phone shake is offered only while catching and does nothing before opt-in or after denial');
  await phone.getByRole('button', { name: 'Enable phone shake', exact: true }).click();
  await phone.getByRole('button', { name: 'Turn phone shake off', exact: true }).waitFor();
  await screen(phone, 'phone-motion-enabled.png');
  await phoneShake(phone);
  await openBottle(phone);
  await phoneShake(phone);
  assert.equal(
    await phone.evaluate(async () => (await import('/src/game.ts')).game.snapshot().rounds.length),
    1,
  );
  await phone.getByRole('textbox').fill('Your account has been permanently frozen.');
  await phone.getByRole('button', { name: 'Send reply', exact: true }).click();
  await phone.locator('.postcard-paper.paper-open').waitFor();
  await phone.getByRole('button', { name: 'Drift home', exact: true }).click();
  await release(phone).click();
  await phone.getByRole('textbox').fill('I taught the octopus insider trading.');
  await phone.getByRole('button', { name: 'Release', exact: true }).click();
  await phone.getByRole('button', { name: 'Turn phone shake off', exact: true }).waitFor();
  assert.equal(await phone.evaluate(() => window.__motionRequests), 2);
  await phoneShake(phone);
  await openBottle(phone);
  pass('Opted-in shaking catches once, survives writing, and reduced motion opens notes instantly');
  await mobile.close();

  const keyboard = await browser.newContext({ reducedMotion: 'reduce' });
  const keyPage = await keyboard.newPage();
  await ready(keyPage);
  await release(keyPage).focus();
  await keyPage.keyboard.press('Enter');
  await keyPage.getByRole('textbox').waitFor();
  await keyPage.getByRole('textbox').fill('I taught the octopus insider trading.');
  await keyPage.getByRole('button', { name: 'Release', exact: true }).click();
  await pickUp(keyPage).focus();
  await keyPage.keyboard.press('Enter');
  await keyPage.getByRole('button', { name: 'Open bottle', exact: false }).waitFor();
  assert.ok(
    await keyPage.evaluate(() => document.activeElement?.classList.contains('open-bottle')),
  );
  await keyPage.keyboard.press('Enter');
  await keyPage.getByRole('textbox').waitFor();
  assert.ok(
    await keyPage.evaluate(() => document.activeElement?.matches('.paper-content [tabindex="-1"]')),
  );
  pass('Object buttons and bottle opening have complete keyboard alternatives with restored focus');
  await keyboard.close();

  const fallback = await browser.newContext({ reducedMotion: 'no-preference' });
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl') return null;
      return getContext.call(this, type, ...args);
    };
  });
  const fallbackPage = await fallback.newPage();
  await ready(fallbackPage);
  await fallbackPage.locator('.sea-surface[data-motion="fallback"]').waitFor();
  await assertCoastImage(fallbackPage);
  assert.equal(
    await fallbackPage.locator('.coast-headland').count(),
    0,
    'Fallback art already contains the headland, so a second overlay is not rendered',
  );
  assert.equal(
    await fallbackPage.locator('.sea-surface').evaluate((el) => getComputedStyle(el).opacity),
    '0',
  );
  await screen(fallbackPage, 'painted-coast-fallback.png');
  await release(fallbackPage).click();
  await fallbackPage.locator('.paper-open textarea').waitFor();
  assert.equal(await fallbackPage.locator('.paper-unfolding').count(), 0);
  await fallbackPage.getByRole('textbox').fill('I challenged their shark to poker.');
  await fallbackPage.getByRole('button', { name: 'Release', exact: true }).click();
  await fallbackPage
    .getByRole('button', { name: 'Pick up the drifting bottle', exact: true })
    .click();
  await openBottle(fallbackPage);
  await screen(fallbackPage, 'motion-fallback.png');
  await fallback.close();
  pass('Unavailable WebGL preserves the painted coast, writing, and tap-to-pick-up bottle flow');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    out + 'shore-interactions.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'Isolated local database; synthetic pointer and motion events; no physical-phone verification or paid AI calls',
        checks,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
