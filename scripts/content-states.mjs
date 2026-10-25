import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.DRIFT_WEB_URL;
const room = process.env.DRIFT_TEST_DATABASE;
if (!origin || !room?.startsWith('drift-test-'))
  throw Error('Run through the isolated test-room runner.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = new URL('../docs/evidence/', import.meta.url).pathname;
const evidence = [];
function pause(paused) {
  const r = spawnSync(
    process.execPath,
    ['scripts/spacetime.mjs', paused ? 'pause-test' : 'resume-test', room],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw Error('Could not change test-room pause state: ' + r.stderr);
}
async function capture(page, viewport, state, observation) {
  await page.screenshot({ path: out + `${state}-${viewport}.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const a = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    a.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  evidence.push({ viewport, state, artifact: `${state}-${viewport}.png`, observation });
  console.log('PASS', viewport, state);
}
try {
  for (const [width, height] of [
    [360, 800],
    [1440, 1000],
  ]) {
    pause(false);
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const sockets = [];
    let holdHandshake = true;
    await page.routeWebSocket('ws://127.0.0.1:3000/**', (route) => {
      sockets.push(route);
      if (!holdHandshake) route.connectToServer();
    });
    await page.goto(origin);
    await page.getByText('Finding the shore…', { exact: true }).waitFor();
    await capture(
      page,
      `${width}x${height}`,
      'loading',
      'Real WebSocket handshake held; prompt/action remain unavailable until server state arrives.',
    );
    holdHandshake = false;
    for (const socket of sockets) socket.connectToServer();
    await page.waitForFunction(() => !document.querySelector('.shore-dock button')?.disabled);
    await page.getByRole('button', { name: 'Write my six words', exact: true }).click();
    await page.getByRole('textbox').fill('I taught the octopus insider trading.');
    pause(true);
    await page.getByRole('button', { name: 'Release', exact: true }).click();
    await page
      .getByRole('alert')
      .filter({ hasText: 'The tide is taking a short break.' })
      .waitFor();
    assert.equal(
      await page.getByRole('textbox').inputValue(),
      'I taught the octopus insider trading.',
    );
    await capture(
      page,
      `${width}x${height}`,
      'error',
      'Authoritative emergency pause rejects submission with a clear saved-draft message.',
    );
    pause(false);
    await page.getByRole('button', { name: 'Dismiss message' }).click();
    await context.setOffline(true);
    for (const socket of sockets)
      await socket.close({ code: 1001, reason: 'Synthetic offline check' });
    await page.getByText('Reconnecting. Your words are safe here.', { exact: true }).waitFor();
    assert.equal(
      await page.getByRole('textbox').inputValue(),
      'I taught the octopus insider trading.',
    );
    assert.equal(
      await page.getByRole('button', { name: 'Release', exact: true }).isDisabled(),
      true,
    );
    await capture(
      page,
      `${width}x${height}`,
      'offline',
      'Disconnected session preserves editable words, disables submission and names reconnection.',
    );
    await context.setOffline(false);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some(
          (b) => b.textContent.includes('Release') && !b.disabled,
        ),
      undefined,
      { timeout: 15000 },
    );
    assert.equal(
      await page.getByRole('textbox').inputValue(),
      'I taught the octopus insider trading.',
    );
    await page.getByRole('button', { name: 'Release', exact: true }).click();
    await page.getByRole('button', { name: 'Catch a bottle', exact: true }).waitFor();
    await capture(
      page,
      `${width}x${height}`,
      'reconnected',
      'Restored subscription resumes the same identity and draft; a new submission completes after reconnection.',
    );
    await context.close();
    const limited = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    await limited.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new DOMException('Synthetic blocked storage', 'SecurityError');
      };
      Storage.prototype.setItem = () => {
        throw new DOMException('Synthetic blocked storage', 'SecurityError');
      };
    });
    const limitedPage = await limited.newPage();
    await limitedPage.goto(origin);
    await limitedPage
      .getByText(
        'This browser can’t save progress. Keep this tab open; refreshing may lose your words.',
        { exact: true },
      )
      .waitFor();
    await limitedPage.getByRole('button', { name: 'Write my six words', exact: true }).click();
    await limitedPage.getByRole('textbox').fill('I taught the octopus insider trading.');
    const retainedRequest = await limitedPage.evaluate(async () => {
      const { persist, saved, game } = await import('/src/game.ts');
      const value = JSON.stringify({ text: 'unchanged draft', id: crypto.randomUUID() });
      persist('drift:synthetic-request-retention', value);
      return {
        retained: saved('drift:synthetic-request-retention') === value,
        storageAvailable: game.snapshot().storageAvailable,
      };
    });
    assert.deepEqual(retainedRequest, { retained: true, storageAvailable: false });
    await limitedPage.getByText('Unsaved', { exact: false }).waitFor();
    await capture(
      limitedPage,
      `${width}x${height}`,
      'storage-unavailable',
      'Blocked browser storage is named honestly; draft and immutable request metadata remain in memory within the current tab.',
    );
    await limitedPage.getByRole('button', { name: 'Release', exact: true }).click();
    await limitedPage.getByRole('button', { name: 'Catch a bottle', exact: true }).waitFor();
    await limitedPage.evaluate(async () => {
      const { game } = await import('/src/game.ts');
      const round = game.snapshot().rounds.find((r) => r.stage !== 'done');
      await game.abandon(round.id);
    });
    await limitedPage.getByRole('button', { name: 'My postcards', exact: true }).click();
    await limitedPage.getByText('Your earlier words', { exact: true }).click();
    assert.equal(
      await limitedPage.locator('.earlier-draft blockquote').innerText(),
      'I taught the octopus insider trading.',
    );
    await capture(
      limitedPage,
      `${width}x${height}`,
      'storage-draft-recovery',
      'With storage blocked, a closed-round draft remains available from memory in this tab; no reload persistence is claimed.',
    );
    await limited.close();
  }
  await fs.writeFile(
    out + 'content-states.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'isolated local sandbox; synthetic fault injection',
        evidence,
      },
      null,
      2,
    ),
  );
} finally {
  pause(false);
  await browser.close();
}
