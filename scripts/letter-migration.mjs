import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { DbConnection } from '../apps/web/src/module_bindings/index.ts';
const root = path.resolve(new URL('../', import.meta.url).pathname);
process.chdir(root);
const legacyCommit = 'f68baf452a2f85614ff7a18629e86ec0ca02df1c';
const room = `drift-test-migration-${Date.now().toString(36)}`;
const work = path.join(root, '.spacetime', room);
const legacy = path.join(work, 'legacy');
await fs.mkdir(legacy, { recursive: true });
const cli = path.resolve(root, '../work/spacetime-cli/spacetimedb-cli');
const config = path.resolve(root, '../work/spacetime-cli/cli.toml');
const host = 'http://127.0.0.1:3000';
const env = {
  ...process.env,
  ANTHROPIC_API_KEY: '',
  DRIFT_TURNSTILE_SECRET: '',
  DRIFT_TURNSTILE_HOSTNAME: '',
  DRIFT_DEV_MODE: 'true',
  DRIFT_DEV_STARTERS: 'false',
  DRIFT_STARTERS_HUMAN_WRITTEN: 'false',
  DRIFT_HELLO_ENABLED: 'false',
  DRIFT_MEETING_SPOT_VERIFIED: 'false',
};
function command(args) {
  const result = spawnSync(cli, ['--config-path', config, ...args, '--server', host], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw Error(`Local migration command failed (${args[0]}): ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function publish(modulePath) {
  return command([
    'publish',
    room,
    '--module-path',
    modulePath,
    '--delete-data=never',
    '--yes=skip-login,break-clients',
  ]);
}
function sql(table) {
  const output = command(['sql', room, `SELECT * FROM ${table}`, '--format', 'json']);
  const line = output.split('\n').find((s) => s.startsWith('['));
  if (!line) throw Error('Missing SQL response');
  const result = JSON.parse(line)[0];
  const fields = result.schema.elements.map((e) =>
    e.name.some.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
  );
  return result.rows.map((row) => Object.fromEntries(fields.map((field, i) => [field, row[i]])));
}
async function until(fn, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (!fn()) {
    if (Date.now() > end) throw Error(label);
    await new Promise((r) => setTimeout(r, 25));
  }
  return fn();
}
const archive = spawnSync(
  'git',
  ['archive', legacyCommit, 'spacetimedb', 'packages', 'apps/web/src/module_bindings'],
  { cwd: root, maxBuffer: 16 * 1024 * 1024 },
);
assert.equal(archive.status, 0);
assert.equal(spawnSync('tar', ['-x', '-C', legacy], { input: archive.stdout }).status, 0);
await fs.symlink(path.join(root, 'node_modules'), path.join(legacy, 'node_modules'), 'dir');
await fs.symlink(
  path.join(root, 'spacetimedb/node_modules'),
  path.join(legacy, 'spacetimedb/node_modules'),
  'dir',
);
const oldSDK = await import(
  pathToFileURL(path.join(legacy, 'apps/web/src/module_bindings/index.ts')).href
);
const clients = [];
let frontend, browser;
async function connect(SDK, token) {
  let client;
  await new Promise((resolve, reject) => {
    const conn = SDK.builder()
      .withUri(host)
      .withDatabaseName(room)
      .withToken(token)
      .onConnect((c, id, t) => {
        client = { conn: c, id: id.toHexString(), token: t };
        c.subscriptionBuilder()
          .onApplied(resolve)
          .onError(reject)
          .subscribe([
            'SELECT * FROM my_round',
            'SELECT * FROM my_assignment',
            'SELECT * FROM my_outgoing',
            'SELECT * FROM my_cards',
            'SELECT * FROM postcard',
          ]);
      })
      .onConnectError((_c, e) => reject(e))
      .build();
    clients.push(conn);
  });
  return client;
}
const active = (c) => [...c.conn.db.myRound.iter()].find((r) => r.stage !== 'done');
async function release(c, text) {
  await c.conn.reducers.startRound({});
  await until(() => active(c), 'write missing');
  assert.equal(
    (
      await c.conn.procedures.submitSetup({
        roundId: active(c).id,
        requestId: crypto.randomUUID(),
        text,
      })
    ).ok,
    true,
  );
  await until(() => [...c.conn.db.myOutgoing.iter()].length, 'publication missing');
}
async function catchOne(c) {
  await c.conn.reducers.startCatching({});
  await until(() => active(c)?.stage === 'reply', 'catch missing');
}
const checks = [];
try {
  const legacyPlan = publish(path.join(legacy, 'spacetimedb'));
  const writers = [];
  for (let i = 0; i < 11; i++) writers.push(await connect(oldSDK.DbConnection));
  const beginnings = [
    'I challenged their shark to poker.',
    'I taught the octopus insider trading.',
    'I loaned their octopus my skateboard.',
    'The octopus has stolen my homework.',
  ];
  for (let i = 0; i < 4; i++) await release(writers[i], beginnings[i]);
  for (const index of [4, 5]) {
    const c = writers[index];
    await catchOne(c);
    assert.equal(
      (
        await c.conn.procedures.submitReply({
          roundId: active(c).id,
          requestId: crypto.randomUUID(),
          text: 'Our lawyers would like another hand.',
        })
      ).ok,
      true,
    );
    await until(
      () => [...c.conn.db.myCards.iter()].some((r) => r.role === 'reply'),
      'card missing',
    );
  }
  const hiddenId = [...writers[5].conn.db.myCards.iter()].find((r) => r.role === 'reply').id;
  await writers[5].conn.reducers.hideMyCard({ cardId: hiddenId });
  await catchOne(writers[6]);
  const held = { ...active(writers[6]) };
  for (let i = 7; i < 11; i++) {
    await writers[i].conn.reducers.startRound({});
    await until(() => active(writers[i]), 'draft missing');
  }
  command(['call', room, 'set_pause', 'true']);
  const tables = [
    'bottle',
    'postcard',
    'authorship',
    'round',
    'request',
    'config',
    'activity_day',
    'ai_budget',
    'ai_call',
  ];
  const before = Object.fromEntries(tables.map((t) => [t, sql(t)]));
  await fs.writeFile(path.join(work, 'before.json'), JSON.stringify(before), { mode: 0o600 });
  for (const client of clients) client.disconnect();
  const plan = publish(path.join(root, 'spacetimedb'));
  assert.ok(
    !/DeleteTable|RemoveColumn|DropTable/.test(plan),
    'Upgrade must not remove stored fields/tables',
  );
  const first = JSON.parse(
    command(['call', room, 'admin_upgrade_letters'])
      .trim()
      .split('\n')
      .find((s) => s.startsWith('[')),
  );
  const second = JSON.parse(
    command(['call', room, 'admin_upgrade_letters'])
      .trim()
      .split('\n')
      .find((s) => s.startsWith('[')),
  );
  assert.equal(first[0], false);
  assert.equal(second[0], true);
  const after = Object.fromEntries(tables.map((t) => [t, sql(t)]));
  for (const table of tables) {
    assert.equal(after[table].length, before[table].length, table + ' row count');
    for (const old of before[table]) {
      const key =
        table === 'activity_day'
          ? 'id'
          : table === 'ai_budget' || table === 'config'
            ? 'id'
            : table === 'ai_call'
              ? 'id'
              : 'id';
      const next = after[table].find(
        (row) => JSON.stringify(row[key]) === JSON.stringify(old[key]),
      );
      assert.ok(next, table + ' ID retained');
      for (const field of Object.keys(old)) {
        const expected =
          table === 'round' && field === 'stage' && old.stage === 'catch' && old.setupId
            ? 'done'
            : old[field];
        assert.deepEqual(next[field], expected, table + '.' + field + ' preserved');
      }
    }
  }
  assert.ok(after.postcard.every((c) => c.beginningId));
  assert.ok(after.authorship.every((c) => c.beginningId));
  assert.ok(!after.postcard.some((c) => c.id === hiddenId));
  const heldAfter = after.round.find((r) => r.id === held.id);
  assert.equal(heldAfter.assignmentId, held.assignmentId);
  assert.equal(heldAfter.leaseMs, held.leaseMs);
  assert.equal(heldAfter.version, held.version);
  checks.push(
    'Actual additive publish from the previous hosted code retains every existing row/field except the documented completed-release stage transition',
  );
  checks.push(
    'Separate owner backfill is idempotent; canonical IDs, words, ownership, hidden state, active leases, requests, activity and cost records survive',
  );
  command(['call', room, 'set_pause', 'false']);
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
  });
  const origin = `http://127.0.0.1:${port}`;
  frontend = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      '--config',
      'apps/web/vite.config.ts',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: root,
      env: { ...env, VITE_SPACETIMEDB_DATABASE: room, VITE_SPACETIMEDB_HOST: host },
      stdio: 'ignore',
    },
  );
  let served = false;
  const end = Date.now() + 10000;
  while (!served) {
    try {
      served = (await fetch(origin)).ok;
    } catch {}
    if (Date.now() > end) throw Error('Frontend unavailable');
    if (!served) await new Promise((r) => setTimeout(r, 50));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [index, label] of [
    [4, 'saved-pair'],
    [6, 'held-ending'],
    [0, 'released-beginning'],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.addInitScript(({ key, token }) => localStorage.setItem(key, token), {
      key: `drift:${host}:${room}:identity`,
      token: writers[index].token,
    });
    await page.goto(origin);
    await page.waitForFunction(
      async () => (await import('/src/game.ts')).game.snapshot().connected,
    );
    if (index === 6) {
      await page
        .getByRole('button', { name: 'Pick up a bottle. Write an ending', exact: true })
        .click();
      await page.getByRole('button', { name: 'Open bottle', exact: true }).click();
      await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
      assert.equal(
        await page.evaluate(
          async () => (await import('/src/game.ts')).game.snapshot().rounds.length,
        ),
        1,
      );
    } else {
      await page.getByRole('button', { name: /^My bottles/ }).click();
      await page
        .locator(index === 4 ? '.collection-card' : '.beginning-preview')
        .first()
        .waitFor();
    }
    await page.screenshot({ path: `docs/evidence/migration-${label}.png`, fullPage: true });
    await context.close();
  }
  checks.push(
    'New browser UI restores the saved pair, author beginning shelf and exact held reply round using the original identity tokens',
  );
  const report = {
    checkedAt: new Date().toISOString(),
    legacyCommit,
    sourceScope: 'Working migration code on main; local namespace only',
    mode: 'Actual local Spacetime publish + SQL invariants + Chrome UI; synthetic data; provider keys cleared',
    beforeCounts: Object.fromEntries(tables.map((t) => [t, before[t].length])),
    afterCounts: Object.fromEntries(tables.map((t) => [t, after[t].length])),
    firstBackfill: first,
    secondBackfill: second,
    planSha256: createHash('sha256').update(plan).digest('hex'),
    checks,
    limits: [
      'Not a hosted data migration yet',
      'No physical device or paid model call',
      'Fixture has 11 rounds and 4 bottles; matches the current hosted row-count scale, not a load benchmark',
    ],
  };
  await fs.writeFile('docs/evidence/letter-migration.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  frontend?.kill('SIGTERM');
  for (const c of clients) c.disconnect();
  command(['delete', room, '--yes']);
}
