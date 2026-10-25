// Real local upgrade from the currently deployed source; synthetic records only.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { DbConnection } from '../apps/web/src/module_bindings/index.ts';
const root = path.resolve(new URL('../', import.meta.url).pathname);
process.chdir(root);
const baseline = '99419ddb4d014ce60de67223e9c4df431a75e3b0';
const database = `drift-test-unopened-upgrade-${Date.now().toString(36)}`;
const previous = path.join(root, '.spacetime', database, 'previous');
await fs.mkdir(previous, { recursive: true });
const archive = spawnSync(
  'git',
  ['archive', baseline, 'spacetimedb', 'packages', 'apps/web/src/module_bindings'],
  { maxBuffer: 16 * 1024 * 1024 },
);
assert.equal(archive.status, 0);
assert.equal(spawnSync('tar', ['-x', '-C', previous], { input: archive.stdout }).status, 0);
for (const relative of ['node_modules', 'spacetimedb/node_modules'])
  await fs.symlink(path.join(root, relative), path.join(previous, relative), 'dir');
const old = await import(
  pathToFileURL(path.join(previous, 'apps/web/src/module_bindings/index.ts')).href
);
const host = 'http://127.0.0.1:3000';
const env = {
  ...process.env,
  ANTHROPIC_API_KEY: '',
  DRIFT_DEV_MODE: 'true',
  DRIFT_DEV_STARTERS: 'false',
  DRIFT_STARTERS_HUMAN_WRITTEN: 'false',
  DRIFT_TURNSTILE_SECRET: '',
  DRIFT_TURNSTILE_HOSTNAME: '',
  DRIFT_HELLO_ENABLED: 'false',
  DRIFT_MEETING_SPOT_VERIFIED: 'false',
};
const cli = path.resolve(root, '../work/spacetime-cli/spacetimedb-cli'),
  config = path.resolve(root, '../work/spacetime-cli/cli.toml');
function command(args) {
  const r = spawnSync(cli, ['--config-path', config, ...args, '--server', host], {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) throw Error(`Local ${args[0]} failed: ${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
function publish(modulePath) {
  return command([
    'publish',
    database,
    '--module-path',
    modulePath,
    '--delete-data=never',
    '--yes=skip-login',
  ]);
}
function snapshot() {
  return Object.fromEntries(
    [
      'round',
      'bottle',
      'beginning',
      'postcard',
      'authorship',
      'request',
      'report',
      'config',
      'today',
      'hello',
      'report_resolution',
      'ai_budget',
      'ai_call',
      'id_allocator',
      'activity_day',
      'schema_migration',
    ].map((table) => {
      const text = command(['sql', database, `SELECT * FROM ${table}`, '--format', 'json']);
      const data = JSON.parse(text.split('\n').find((line) => line.startsWith('[')))[0];
      return [
        table,
        {
          schema: data.schema,
          rows: data.rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        },
      ];
    }),
  );
}
const clients = [],
  checks = [];
async function connect(SDK, token, subscriptions) {
  const conn = await new Promise((resolve, reject) =>
    SDK.builder()
      .withUri(host)
      .withDatabaseName(database)
      .withToken(token)
      .withAutomaticReconnect({})
      .onConnect((conn) => resolve(conn))
      .onConnectError(() => reject(Error('Local upgrade client failed')))
      .build(),
  );
  clients.push(conn);
  await new Promise((resolve, reject) =>
    conn
      .subscriptionBuilder()
      .onApplied(resolve)
      .onError(() => reject(Error('Local upgrade subscription failed')))
      .subscribe(subscriptions),
  );
  return conn;
}
async function until(fn) {
  const end = Date.now() + 12000;
  while (!fn()) {
    if (Date.now() > end) throw Error('Local upgrade state did not arrive');
    await new Promise((r) => setTimeout(r, 25));
  }
}
try {
  publish(path.join(previous, 'spacetimedb'));
  const queries = [
    'SELECT * FROM my_round',
    'SELECT * FROM my_cards',
    'SELECT * FROM my_outgoing',
    'SELECT * FROM postcard',
  ];
  const A = await connect(old.DbConnection, undefined, queries),
    B = await connect(old.DbConnection, undefined, queries),
    C = await connect(old.DbConnection, undefined, queries);
  await A.reducers.startRound({});
  await until(() => [...A.db.myRound.iter()].length === 1);
  const round = [...A.db.myRound.iter()][0];
  assert.equal(
    (
      await A.procedures.submitSetup({
        roundId: round.id,
        requestId: crypto.randomUUID(),
        text: 'I challenged their shark to poker.',
      })
    ).ok,
    true,
  );
  await until(() => [...A.db.myOutgoing.iter()].length === 1);
  const beginningId = [...A.db.myOutgoing.iter()][0].id;
  for (const [client, text] of [
    [B, 'Our lawyers would like another hand.'],
    [C, 'The shark has requested legal counsel.'],
  ]) {
    await client.reducers.pickUpBeginning({ beginningId });
    await until(() => [...client.db.myRound.iter()].some((r) => r.stage === 'reply'));
    const reply = [...client.db.myRound.iter()].find((r) => r.stage === 'reply');
    assert.equal(
      (
        await client.procedures.submitReply({
          roundId: reply.id,
          requestId: crypto.randomUUID(),
          text,
        })
      ).ok,
      true,
    );
  }
  await until(() => [...A.db.myCards.iter()].length === 2);
  const ids = [...A.db.myCards.iter()].map((r) => r.id);
  await A.reducers.recordCardAction({ cardId: ids[0], action: 'open' });
  await A.reducers.startRound({});
  const token = A.token;
  const before = snapshot();
  const plan = publish(path.join(root, 'spacetimedb'));
  assert.ok(!/DeleteTable|RemoveColumn|DropTable/.test(plan));
  assert.deepEqual(snapshot(), before);
  checks.push(
    'Actual additive publish from deployed source retains all compared stored schemas, IDs and fields, including an open draft round and prior per-author open bits',
  );
  await A.reducers.recordCardAction({ cardId: ids[0], action: 'link_copied' });
  assert.equal([...A.db.myCards.iter()].length, 2);
  checks.push(
    'The previous generated client and its original my_cards subscription keep working after the new private view is added',
  );
  const fresh = await connect(DbConnection, token, ['SELECT * FROM my_unopened_returns']);
  assert.deepEqual(
    [...fresh.db.myUnopenedReturns.iter()].map((r) => r.id),
    [ids[1]],
  );
  await A.reducers.recordCardAction({ cardId: ids[1], action: 'open' });
  await until(() => [...fresh.db.myUnopenedReturns.iter()].length === 0);
  checks.push(
    'New client derives only the genuinely unopened historical pair from preserved private flags and reacts when an older client opens it',
  );
  await fs.writeFile(
    'docs/evidence/unopened-upgrade.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        baselineCommit: baseline,
        mode: 'Same disposable local database, synthetic writers and AI off. No reset, backfill, provider call or hosted data.',
        checks,
        comparedCounts: Object.fromEntries(
          Object.entries(before).map(([k, v]) => [k, v.rows.length]),
        ),
      },
      null,
      2,
    ) + '\n',
  );
  checks.forEach((s) => console.log('PASS', s));
} finally {
  clients.forEach((c) => c.disconnect());
  command(['delete', database, '--yes']);
}
