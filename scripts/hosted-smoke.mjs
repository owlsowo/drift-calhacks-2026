import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.DRIFT_WEB_URL;
if (!origin?.startsWith('https://drift-game.') || !origin.endsWith('.workers.dev'))
  throw Error('Use the intended Drift HTTPS deployment.');
let response;
for (let i = 0; i < 10; i++) {
  try {
    response = await fetch(origin);
    if (response.ok) break;
  } catch {}
  console.log('Waiting for new HTTPS certificate propagation…');
  await new Promise((r) => setTimeout(r, 15000));
}
if (!response?.ok)
  throw Error('HTTPS deployment is not reachable yet; no bypass or paid calls attempted.');
const headers = {
  csp: response.headers.get('content-security-policy'),
  nosniff: response.headers.get('x-content-type-options'),
  permissions: response.headers.get('permissions-policy'),
};
assert.ok(headers.csp?.includes("default-src 'self'"));
assert.equal(headers.nosniff, 'nosniff');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = new URL('../docs/evidence/', import.meta.url).pathname;
const errors = [],
  checks = [];
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
const contexts = await Promise.all(
  [360, 1440].map((width) =>
    browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
      acceptDownloads: true,
    }),
  ),
);
const [A, B] = await Promise.all(contexts.map((c) => c.newPage()));
const button = (p, name) => p.getByRole('button', { name, exact: true });
try {
  for (const p of [A, B]) {
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(origin);
    await button(p, 'Write my six words').waitFor();
    await p.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
    assert.equal(await p.locator('.sandbox-banner').count(), 0);
  }
  pass('Two independent identities connect over real HTTPS with AI enabled and no sandbox banner');
  for (const [p, text] of [
    [A, 'I gave the octopus my homework.'],
    [B, 'Their penguin stole my student discount.'],
  ]) {
    await button(p, 'Write my six words').click();
    await p.getByRole('textbox').fill(text);
    await button(p, 'Toss my bottle').click();
    await button(p, 'Catch a bottle').waitFor();
  }
  pass('Fresh synthetic inputs pass real hosted Claude setup moderation');
  await button(A, 'Catch a bottle').click();
  await A.getByRole('button', { name: 'Open bottle', exact: false }).click();
  await A.getByText('Their penguin stole my student discount.', { exact: true }).waitFor();
  await A.getByRole('button', { name: 'A little nudge', exact: false }).click();
  await A.locator('.nudge p').waitFor();
  const hint = await A.locator('.nudge p').innerText();
  assert.ok(hint.length > 0 && hint.length <= 220);
  pass('A real Sonnet nudge appears inside the hosted writing flow');
  await A.getByRole('textbox').fill('Our lawyers demand your student ID.');
  await button(A, 'Seal our postcard').click();
  await A.getByRole('heading', { name: 'Well, look what we made.' }).waitFor();
  await button(B, 'My postcards 1').waitFor();
  await A.screenshot({ path: out + 'hosted-reveal-360.png', fullPage: true });
  pass(
    'Real pair moderation creates a canonical postcard and returns it live to the original writer',
  );
  const download = A.waitForEvent('download');
  await button(A, 'Save image').click();
  await (await download).saveAs(out + 'hosted-postcard.png');
  pass('Hosted postcard exports as a real downloadable PNG');
  const cardId = await A.locator('.postcard').getAttribute('data-card-id');
  await button(A, 'Hide this postcard').click();
  await button(A, 'Hide postcard').click();
  pass('Synthetic hosted postcard is hidden after verification');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    out + 'hosted-smoke.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        origin,
        mode: 'Real hosted SpacetimeDB + Claude; synthetic writers, no attendee study; ran before Turnstile gate enablement',
        headers,
        checks,
        hint,
        cardId,
        errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await A.screenshot({ path: out + 'hosted-failure.png', fullPage: true }).catch(() => {});
  console.error('Hosted visible state:', (await A.locator('body').innerText()).slice(0, 1600));
  throw error;
} finally {
  await browser.close();
}
