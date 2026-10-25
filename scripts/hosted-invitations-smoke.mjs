// One bounded hosted application smoke test. Never solves or bypasses a human challenge.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const origin = 'https://drift-game.drift-calhacks-2026-owlsowo.workers.dev';
const mode = process.argv[2];
if (!['--run-once', '--preflight-only'].includes(mode))
  throw Error(
    'Use --preflight-only for a zero-story/zero-model check, or --run-once for up to four normal application model calls.',
  );
const tag = crypto.randomUUID().slice(0, 6),
  setup = `Demo-${tag} flight: our captain misplaced gravity.`;
const firstReply = 'Demo reply: gravity filed for retirement.',
  secondReply = 'Demo reply: captain blames the glitter.';
const out = process.env.DRIFT_HOSTED_E2E_OUT
    ? pathToFileURL(process.env.DRIFT_HOSTED_E2E_OUT.replace(/\/$/, '') + '/')
    : new URL('../docs/evidence/', import.meta.url),
  checks = [],
  errors = [];
const report = {
  startedAt: new Date().toISOString(),
  origin,
  mode: 'Normal hosted application preflight; no model call occurs before human checks finish. No bypass, forged token or increased evaluation budget.',
  applicationActionsAttempted: 0,
  status: 'starting',
  checks,
  errors,
  cleanup: { retired: false },
};
const button = (p, name) => p.getByRole('button', { name, exact: true });
const release = (p) => p.getByRole('button', { name: /^Release a bottle/ });
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
await fs.mkdir(out, { recursive: true });
const headed = process.argv.includes('--headed');
const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
const pages = [];
let createdId = '';
function owner(args) {
  const r = spawnSync(process.execPath, ['scripts/spacetime.mjs', ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0) throw Error('Owner smoke cleanup/readback command failed.');
  return r.stdout;
}
function demoIds() {
  const raw = owner([
    'sql',
    '--server',
    'maincloud',
    '--format',
    'json',
    'drift-calhacks-2026',
    `SELECT id FROM bottle WHERE text = '${setup}'`,
  ]);
  const data = JSON.parse(raw.split('\n').find((line) => line.startsWith('[')))[0];
  return data.rows.map((row) => row[0]);
}
async function run() {
  if (mode === '--run-once')
    assert.equal(demoIds().length, 0, 'The unique demo marker does not exist before this run');
  for (const width of [1440, 390, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: 'reduce',
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    pages.push(page);
  }
  await Promise.all(pages.map((p) => p.goto(origin, { waitUntil: 'domcontentloaded' })));
  if (headed) {
    await Promise.all(
      pages.map((page, index) =>
        page
          .screenshot({ path: new URL(`preflight-window-${index + 1}.png`, out).pathname })
          .catch(() => {}),
      ),
    );
    await fs.writeFile(
      new URL('live-progress.json', out),
      JSON.stringify({
        phase: 'normal_human_check_preflight',
        windows: 3,
        noStoryOrProviderCallYet: true,
      }),
    );
    console.log(
      'Three Chrome test windows opened for normal verification; no challenge is solved by the agent.',
    );
  }
  const gateMonitor = headed
    ? setInterval(() => {
        void Promise.all(
          pages.map(async (page, index) => ({
            window: index + 1,
            shore: await page
              .locator('.shore-gate')
              .innerText({ timeout: 500 })
              .catch(() => 'No gate shown'),
          })),
        )
          .then((windows) =>
            fs.writeFile(
              new URL('live-progress.json', out),
              JSON.stringify({
                phase: 'normal_human_check_preflight',
                windows,
                noStoryOrProviderCallYet: true,
              }),
            ),
          )
          .catch(() => {});
      }, 5000)
    : undefined;
  const gates = await Promise.all(
    pages.map(async (p, index) => {
      try {
        await release(p).waitFor();
        await p.waitForFunction(
          () => {
            const b = document.querySelector('button[aria-label^="Release a bottle"]');
            return b && !b.disabled;
          },
          {},
          { timeout: headed ? 600000 : 30000 },
        );
        return true;
      } catch {
        const status = await p
          .locator('.shore-gate')
          .innerText()
          .catch(() => 'The normal page did not become ready.');
        report[`preflight${index + 1}`] = status.slice(0, 300);
        await p
          .screenshot({
            path: new URL(
              `${mode === '--preflight-only' ? 'hosted-invitation-current-preflight' : 'hosted-invitation-preflight'}-${index + 1}.png`,
              out,
            ).pathname,
            fullPage: true,
          })
          .catch(() => {});
        return false;
      }
    }),
  );
  clearInterval(gateMonitor);
  if (gates.some((g) => !g)) {
    report.status = 'human_check_or_connection_needed';
    throw Error(
      'The normal browser preflight did not finish automatically. No test story or provider call was started.',
    );
  }
  for (const p of pages) assert.equal(await p.locator('.preview-mark').count(), 0);
  pass(
    'Three independent hosted browser identities connect with the normal shore checks and no sandbox banner',
  );
  if (mode === '--preflight-only') {
    report.status = 'preflight_passed';
    return;
  }
  await fs.writeFile(
    new URL('live-progress.json', out),
    JSON.stringify({ phase: 'human_checks_passed_running_application' }),
  );
  report.mode =
    'Real hosted application with synthetic browser identities and tagged demo words. Not attendee evidence.';
  const [A, B, C] = pages;
  await release(A).click();
  await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(setup);
  report.applicationActionsAttempted++;
  await button(A, 'Release').click();
  await A.locator('.shore-home').waitFor({ timeout: 60000 });
  await A.getByRole('button', { name: /^My bottles/ }).click();
  await A.locator('.beginning-preview').filter({ hasText: setup }).click();
  await A.locator('.paper-open .letter-text').waitFor();
  await A.getByText('Bottle ID', { exact: true }).click();
  createdId = await A.locator('.bottle-receipt code').innerText();
  assert.ok(demoIds().includes(createdId));
  report.beginningId = createdId;
  pass(
    'A tagged six-word demo beginning passes real hosted setup moderation and exposes the invitation control',
  );
  await button(A, 'Invite someone to finish').waitFor();
  const link = `${origin}/?bottle=${encodeURIComponent(createdId)}`;
  for (const p of [B, C]) {
    await p.goto(link);
    await button(p, 'Write an ending').waitFor();
    await p.waitForFunction(
      () => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.some(
          (b) => b.textContent.trim().startsWith('Write an ending') && !b.disabled,
        );
      },
      {},
      { timeout: 30000 },
    );
    await button(p, 'Write an ending').click();
    await button(p, 'Open bottle').click();
    await p.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
    assert.equal(await p.locator('.caught-note p').innerText(), setup);
  }
  pass(
    'Both recipients accept the exact hosted invitation and receive the same selected beginning in separate writing assignments',
  );
  report.applicationActionsAttempted++;
  await B.getByRole('button', { name: /^Hint/ }).click();
  await B.locator('.nudge p').waitFor({ timeout: 30000 });
  report.hint = await B.locator('.nudge p').innerText();
  assert.ok(report.hint.length > 0 && report.hint.length <= 220);
  assert.equal(
    await B.getByRole('textbox', { name: 'Your six-word ending', exact: true }).inputValue(),
    '',
  );
  pass('A real contextual Claude hint appears without filling the human ending');
  for (const [p, text] of [
    [B, firstReply],
    [C, secondReply],
  ]) {
    await p.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(text);
    report.applicationActionsAttempted++;
    await button(p, 'Send reply').click();
    await p.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor({ timeout: 60000 });
  }
  await A.getByRole('heading', { name: '2 replies', exact: true }).waitFor({ timeout: 20000 });
  assert.equal(await A.locator('.ending-preview').count(), 2);
  await A.screenshot({
    path: new URL('hosted-invitation-two-endings.png', out).pathname,
    fullPage: true,
  });
  await B.screenshot({
    path: new URL('hosted-invitation-reply.png', out).pathname,
    fullPage: true,
  });
  pass(
    'Real pair moderation publishes two distinct postcards and both return live to the original writer',
  );
  await B.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some((b) => b.textContent.trim() === 'Save image' && !b.disabled);
    },
    {},
    { timeout: 90000 },
  );
  report.illustrationRendered =
    (await B.locator('.scene-illustration[data-state="ready"]').count()) > 0;
  const [download] = await Promise.all([
    B.waitForEvent('download'),
    button(B, 'Save image').click(),
  ]);
  const file = new URL('hosted-invitation-postcard.png', out).pathname;
  await download.saveAs(file);
  const png = await fs.readFile(file);
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1650);
  pass('The hosted result downloads as an actual 1080×1650 PNG');
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const guest = await guestContext.newPage();
  await guest.goto(B.url());
  await guest.locator('.postcard-paper.paper-open').waitFor({ timeout: 30000 });
  assert.equal(await guest.locator('.postcard .setup-half p').innerText(), setup);
  assert.equal(
    await guest.locator('.postcard .card-half:not(.setup-half) p').innerText(),
    firstReply,
  );
  assert.equal(await button(guest, 'Hide').count(), 0);
  assert.equal(await guest.locator('.co-writer-thanks').count(), 0);
  await guestContext.close();
  pass(
    'A fresh public reader opens the exact shared pair with its original context and receives no author controls',
  );
  const vote = B.locator('.postcard-vote .ending-upvote');
  await vote.click();
  await B.waitForFunction(
    () =>
      document.querySelector('.postcard-vote .ending-upvote')?.getAttribute('aria-pressed') ===
      'true',
  );
  await A.waitForFunction(
    (text) =>
      [...document.querySelectorAll('.ending-entry')].some(
        (row) =>
          row.textContent.includes(text) &&
          row.querySelector('.ending-upvote strong')?.textContent === '1',
      ),
    firstReply,
  );
  await vote.click();
  await B.waitForFunction(
    () =>
      document.querySelector('.postcard-vote .ending-upvote')?.getAttribute('aria-pressed') ===
      'false',
  );
  await A.waitForFunction(
    (text) =>
      [...document.querySelectorAll('.ending-entry')].some(
        (row) =>
          row.textContent.includes(text) &&
          row.querySelector('.ending-upvote strong')?.textContent === '0',
      ),
    firstReply,
  );
  pass(
    'One verified hosted vote and undo arrive live for the beginning author, leaving the synthetic pair with zero votes',
  );

  assert.deepEqual(errors, []);
  report.status = 'passed';
  report.syntheticAccounting =
    'One demo beginning, two demo pair completions and one optional hint. Application live counters include this synthetic run; they are not attendee outcomes.';
}
try {
  await run();
} catch (error) {
  report.error = error.message;
  if (report.status === 'starting') report.status = 'failed';
  process.exitCode = report.status === 'human_check_or_connection_needed' ? 2 : 1;
  console.log(report.status, report.error);
} finally {
  try {
    const ids = new Set(
      report.applicationActionsAttempted ? [...demoIds(), ...(createdId ? [createdId] : [])] : [],
    );
    for (const id of ids) {
      if (!/^[a-z0-9-]{36,100}$/i.test(id)) throw Error('Unexpected demo ID');
      owner(['call', 'drift-calhacks-2026', 'retire_bottle', id, '--server', 'maincloud']);
    }
    if (ids.size) {
      report.cleanup = {
        retired: true,
        count: ids.size,
        scope:
          'Only this run’s tagged demo beginning and its public pairs are retired. Request/cost rows follow normal retention.',
      };
      assert.equal(demoIds().length, 0);
    } else
      report.cleanup = {
        retired: false,
        count: 0,
        scope: 'No tagged demo beginning was created; no retirement was needed.',
      };
  } catch (error) {
    report.status = 'cleanup_failed';
    report.cleanup = { retired: false, error: error.message };
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(
    new URL(
      mode === '--preflight-only'
        ? 'hosted-invitations-preflight.json'
        : 'hosted-invitations-smoke.json',
      out,
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
