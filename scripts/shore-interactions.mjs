import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Run through the isolated test-room runner.');
const out = new URL('../docs/evidence/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
const errors = [];
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
async function screen(page, name, scan = true) {
  await page.screenshot({ path: out + name, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (scan) {
    const report = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.deepEqual(
      report.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
      name,
    );
  }
}
async function shake(page, offsets = [65, -65, 65, -65, 65]) {
  await page.waitForFunction(() => !document.querySelector('.bottle-grip')?.disabled);
  const box = await page.locator('.bottle-grip').boundingBox();
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
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
    recordVideo: { dir: out + 'shore-video/', size: { width: 1440, height: 1000 } },
  });
  const page = await desktop.newPage();
  await ready(page);
  await screen(page, 'shore-desktop.png');
  await shake(page, [25, 50, 75, 100, 125]);
  assert.equal(await page.locator('.shore-home').count(), 1);
  pass('Single-direction cursor movement does not activate a bottle');
  await shake(page);
  await page.locator('.paper-open textarea').waitFor();
  const roundCount = await page.evaluate(
    async () => (await import('/src/game.ts')).game.snapshot().rounds.length,
  );
  assert.equal(roundCount, 1);
  pass('Deliberate cursor shaking starts one round');
  await page.getByRole('textbox').fill('I taught the octopus insider trading.');
  await page.getByRole('button', { name: 'Toss my bottle', exact: true }).click();
  await page.getByRole('button', { name: 'Catch a bottle', exact: true }).waitFor();
  await screen(page, 'shore-catch.png');
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
  pass('A failed catch stays on the shore with a visible error and permits another shake');
  await shake(page);
  await page.getByRole('button', { name: 'Open bottle', exact: false }).waitFor();
  assert.equal(await page.getByRole('textbox').count(), 0);
  await screen(page, 'paper-crumpled.png');
  await page.getByRole('button', { name: 'Open bottle', exact: false }).click();
  await page.locator('.paper-unfolding').waitFor();
  await page.waitForTimeout(250);
  await screen(page, 'paper-unfolding.png', false);
  await page.locator('.paper-open textarea').waitFor();
  assert.equal(await page.locator('.ocean-world').isVisible(), true);
  assert.ok(
    await page.evaluate(() =>
      getComputedStyle(document.querySelector('.ocean-photograph')).backgroundImage.includes(
        'sea-shore.jpg',
      ),
    ),
  );
  await screen(page, 'paper-open-desktop.png');
  await page.setViewportSize({ width: 360, height: 800 });
  await screen(page, 'paper-open-mobile.png');
  pass(
    'Caught paper begins crumpled, unfolds, and leaves the real sea behind the readable note at both viewports',
  );
  await page.getByRole('textbox').fill('Our lawyers would like another hand.');
  await page.getByRole('button', { name: 'Seal our postcard', exact: true }).click();
  await page.locator('.postcard-paper.paper-open').waitFor();
  await screen(page, 'shore-postcard-mobile.png');
  pass('Finished postcard opens on paper over the same sea');
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
  await phoneShake(phone);
  assert.equal(await phone.locator('.shore-home').count(), 1);
  await phone.getByRole('button', { name: 'Enable phone shake', exact: true }).click();
  await phone.getByRole('status').filter({ hasText: 'Motion wasn’t enabled.' }).waitFor();
  await screen(phone, 'phone-motion-denied.png');
  await phoneShake(phone);
  assert.equal(await phone.locator('.shore-home').count(), 1);
  pass(
    'Phone motion before opt-in and after denial does not activate; drag and buttons remain available',
  );
  await phone.getByRole('button', { name: 'Enable phone shake', exact: true }).click();
  await phone.getByRole('button', { name: 'Turn phone shake off', exact: true }).waitFor();
  await screen(phone, 'phone-motion-enabled.png');
  await phoneShake(phone);
  await phone.getByRole('textbox').waitFor();
  assert.equal(await phone.locator('.paper-unfolding').count(), 0);
  await phoneShake(phone);
  assert.equal(
    await phone.evaluate(async () => (await import('/src/game.ts')).game.snapshot().rounds.length),
    1,
  );
  await phone.getByRole('textbox').fill('I challenged their shark to poker.');
  await phone.getByRole('button', { name: 'Toss my bottle', exact: true }).click();
  await phone.getByRole('button', { name: 'Turn phone shake off', exact: true }).waitFor();
  assert.equal(await phone.evaluate(() => window.__motionRequests), 2);
  await phoneShake(phone);
  await phone.getByRole('button', { name: 'Open bottle', exact: false }).click();
  await phone.getByRole('textbox').waitFor();
  assert.equal(await phone.locator('.paper-unfolding').count(), 0);
  pass(
    'Opted-in synthetic phone shaking starts and catches once, survives writing, and reduced motion opens instantly',
  );
  await mobile.close();

  const keyboard = await browser.newContext({ reducedMotion: 'reduce' });
  const keyPage = await keyboard.newPage();
  await ready(keyPage);
  await keyPage
    .getByRole('button', { name: 'Shake the bottle to start writing', exact: true })
    .focus();
  await keyPage.keyboard.press('Enter');
  await keyPage.getByRole('textbox').waitFor();
  await keyPage.getByRole('textbox').fill('I taught the octopus insider trading.');
  await keyPage.getByRole('button', { name: 'Toss my bottle', exact: true }).click();
  await keyPage.getByRole('button', { name: 'Catch a bottle', exact: true }).click();
  await keyPage.getByRole('button', { name: 'Open bottle', exact: false }).waitFor();
  assert.ok(
    await keyPage.evaluate(() => document.activeElement?.classList.contains('open-bottle')),
  );
  await keyPage.keyboard.press('Enter');
  await keyPage.getByRole('textbox').waitFor();
  assert.ok(
    await keyPage.evaluate(() => document.activeElement?.matches('.paper-content [tabindex="-1"]')),
  );
  pass('Keyboard Enter provides a complete gesture alternative');
  await keyboard.close();
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
