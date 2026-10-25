// Actual additive upgrade with both generated SDK versions; synthetic local data only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve(new URL('../', import.meta.url).pathname);
process.chdir(root);
const legacyRef = '4c217cc68b517de7d9d866fb1976316aa8e66257';
const candidateRef = process.env.DRIFT_SCENE_MIGRATION_REF || 'origin/codex/claude-scenes';
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw Error('Cannot resolve migration source revision.');
  return result.stdout.trim();
};
const candidateCommit = git('rev-parse', '--verify', `${candidateRef}^{commit}`);
const room = `drift-test-scene-migration-${Date.now().toString(36)}`;
const work = path.join(root, '.spacetime', room);
await fs.mkdir(work, { recursive: true, mode: 0o700 });
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
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw Error(`Local scene migration ${args[0]} failed: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function publish(modulePath) {
  return command([
    'publish',
    room,
    '--module-path',
    modulePath,
    '--delete-data=never',
    '--yes=skip-login',
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
async function archive(ref, label) {
  const target = path.join(work, label);
  await fs.mkdir(target, { mode: 0o700 });
  const output = spawnSync(
    'git',
    ['archive', ref, 'spacetimedb', 'packages', 'apps/web/src/module_bindings'],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  assert.equal(output.status, 0, 'Source archive succeeds');
  assert.equal(spawnSync('tar', ['-x', '-C', target], { input: output.stdout }).status, 0);
  await fs.symlink(path.join(root, 'node_modules'), path.join(target, 'node_modules'), 'dir');
  await fs.symlink(
    path.join(root, 'spacetimedb/node_modules'),
    path.join(target, 'spacetimedb/node_modules'),
    'dir',
  );
  const sdk = await import(
    pathToFileURL(path.join(target, 'apps/web/src/module_bindings/index.ts')).href
  );
  return { target, SDK: sdk.DbConnection };
}
async function until(read, label, timeout = 16000) {
  const deadline = Date.now() + timeout;
  let value;
  while (!(value = read())) {
    if (Date.now() > deadline) throw Error(label);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return value;
}
const clients = [],
  subscriptionErrors = [],
  checks = [];
const pass = (message) => {
  checks.push(message);
  console.log('PASS', message);
};
const commonTables = [
  'my_round',
  'my_assignment',
  'my_outgoing',
  'my_cards',
  'my_appreciation',
  'my_unopened_returns',
  'postcard',
  'beginning',
  'service_status',
];
async function connect(SDK, { token, scenes = false } = {}) {
  let client;
  await new Promise((resolve, reject) => {
    const conn = SDK.builder()
      .withUri(host)
      .withDatabaseName(room)
      .withToken(token)
      .withAutomaticReconnect({})
      .onConnect((c, identity, savedToken) => {
        client = { conn: c, token: savedToken, identity, applied: 0, reconnects: 0 };
        c.subscriptionBuilder()
          .onApplied(() => {
            client.applied++;
            resolve();
          })
          .onError((_ctx, error) => {
            subscriptionErrors.push(String(error));
            reject(error);
          })
          .subscribe(
            [...commonTables, ...(scenes ? ['postcard_scene', 'postcard_scene_status'] : [])].map(
              (table) => `SELECT * FROM ${table}`,
            ),
          );
      })
      .onAutomaticReconnect(() => {
        if (client) client.reconnects++;
      })
      .onConnectError((_ctx, error) => reject(error))
      .build();
    clients.push(conn);
  });
  return client;
}
const ownRound = (client, stage) =>
  [...client.conn.db.myRound.iter()].find((row) => row.stage === stage);
const rows = (client, table) => [...client.conn.db[table].iter()];
const tables = [
  'bottle',
  'beginning',
  'postcard',
  'authorship',
  'round',
  'request',
  'report',
  'report_resolution',
  'config',
  'today',
  'hello',
  'shore_pass',
  'ai_budget',
  'ai_call',
  'id_allocator',
  'activity_day',
  'schema_migration',
];
const sceneTables = [
  'postcard_scene',
  'postcard_scene_status',
  'scene_job',
  'scene_schedule',
  ...(process.env.DRIFT_MIGRATION_VOTES === 'true' ? ['card_vote', 'vote_rate'] : []),
];
let published = false;
try {
  const legacy = await archive(legacyRef, 'legacy');
  const candidate = await archive(candidateCommit, 'candidate');
  publish(path.join(legacy.target, 'spacetimedb'));
  published = true;
  const A = await connect(legacy.SDK),
    B = await connect(legacy.SDK),
    C = await connect(legacy.SDK);
  await A.conn.reducers.startRound({});
  const firstRound = await until(() => ownRound(A, 'write'), 'Old write round missing');
  assert.equal(
    (
      await A.conn.procedures.submitSetup({
        roundId: firstRound.id,
        requestId: crypto.randomUUID(),
        text: 'I taught dolphins to play poker.',
      })
    ).ok,
    true,
  );
  const beginning = await until(() => rows(A, 'myOutgoing')[0], 'Old beginning missing');
  await B.conn.reducers.pickUpBeginning({ beginningId: beginning.id });
  const reply = await until(() => ownRound(B, 'reply'), 'Old reply assignment missing');
  assert.equal(
    (
      await B.conn.procedures.submitReply({
        roundId: reply.id,
        requestId: crypto.randomUUID(),
        text: 'Our lawyers would like another hand.',
      })
    ).ok,
    true,
  );
  const pair = await until(() => rows(B, 'postcard')[0], 'Old completed pair missing');
  await A.conn.reducers.thankCoWriter({ cardId: pair.id });
  await until(
    () => rows(B, 'myAppreciation').some((row) => row.cardId === pair.id && row.received),
    'Old thanks receipt missing',
  );
  await C.conn.reducers.pickUpBeginning({ beginningId: beginning.id });
  const held = { ...(await until(() => ownRound(C, 'reply'), 'Held reply missing')) };
  const oldConnections = [A.conn, B.conn, C.conn];
  command(['call', room, 'set_pause', 'true']);
  await until(
    () => [A, B, C].every((client) => rows(client, 'serviceStatus')[0]?.paused),
    'Old clients did not receive pause',
  );
  const before = Object.fromEntries(tables.map((table) => [table, sql(table)]));
  await fs.writeFile(path.join(work, 'before.json'), JSON.stringify(before), { mode: 0o600 });
  // Deliberately retain old generated SDK connections and subscriptions during publish.
  const plan = publish(path.join(candidate.target, 'spacetimedb'));
  await fs.writeFile(path.join(work, 'upgrade-plan.txt'), plan, { mode: 0o600 });
  assert.ok(
    !/DeleteTable|RemoveColumn|DropTable/.test(plan),
    'Upgrade cannot delete stored schemas',
  );
  const after = Object.fromEntries(tables.map((table) => [table, sql(table)]));
  for (const table of tables) {
    assert.equal(after[table].length, before[table].length, `${table} row count`);
    const key =
      table === 'hello'
        ? 'cardId'
        : table === 'report_resolution'
          ? 'reportId'
          : table === 'shore_pass'
            ? 'owner'
            : 'id';
    for (const old of before[table]) {
      const next = after[table].find(
        (row) => JSON.stringify(row[key]) === JSON.stringify(old[key]),
      );
      assert.deepEqual(next, old, `${table}: every stored field preserved`);
    }
  }
  const initialScenes = Object.fromEntries(sceneTables.map((table) => [table, sql(table)]));
  assert.ok(
    Object.values(initialScenes).every((value) => value.length === 0),
    'Legacy postcards are not automatically backfilled',
  );
  pass(
    'Actual additive publish preserves every compared old row and field, including a completed pair, private thanks and an active reply; all four new tables start empty',
  );
  command(['call', room, 'set_pause', 'false']);
  await until(
    () =>
      [A, B, C].every(
        (client) => client.conn.isActive && rows(client, 'serviceStatus')[0]?.paused === false,
      ),
    'Old subscriptions did not receive resume',
  );
  assert.deepEqual(
    [A.conn, B.conn, C.conn],
    oldConnections,
    'Old connection objects remain in use',
  );
  await B.conn.reducers.thankCoWriter({ cardId: pair.id });
  await until(
    () =>
      rows(A, 'myAppreciation').some((row) => row.cardId === pair.id && row.received && row.sent),
    'Old client did not receive reciprocal thanks after upgrade',
  );
  const heldAfter = ownRound(C, 'reply');
  assert.equal(heldAfter.id, held.id);
  assert.equal(heldAfter.assignmentId, held.assignmentId);
  assert.equal(heldAfter.leaseMs, held.leaseMs);
  assert.equal(heldAfter.version, held.version);
  pass(
    'Original generated clients remain subscribed after the upgrade and receive new private thanks, with the held reply ID/version/deadline unchanged',
  );
  const observer = await connect(candidate.SDK, { scenes: true });
  assert.equal(rows(observer, 'postcard').length, 1);
  assert.equal(rows(observer, 'postcardScene').length, 0);
  assert.equal(rows(observer, 'postcardSceneStatus').length, 0);
  assert.equal(
    (
      await C.conn.procedures.submitReply({
        roundId: held.id,
        requestId: crypto.randomUUID(),
        text: 'The shark demanded collateral in sardines.',
      })
    ).ok,
    true,
  );
  const newPair = await until(
    () => rows(A, 'postcard').find((card) => card.id !== pair.id),
    'Old author did not receive newly accepted pair',
  );
  await until(
    () =>
      rows(observer, 'postcardSceneStatus').find(
        (status) => status.cardId === newPair.id && status.state === 'failed',
      ),
    'Actual keyless scheduler did not finish',
    20000,
  );
  const status = rows(observer, 'postcardSceneStatus').find((row) => row.cardId === newPair.id);
  assert.match(status.message, /aren’t connected/);
  assert.equal(rows(observer, 'postcardScene').length, 0);
  assert.equal(sql('scene_job').length, 1);
  assert.equal(sql('scene_schedule').length, 0);
  assert.equal(sql('ai_call').filter((row) => row.operation === 'scene').length, 0);
  assert.equal(rows(observer, 'postcard').length, 2);
  pass(
    'An old client finishes its preserved reply; both SDKs receive the pair, and the real scheduled worker ends keyless illustration without a provider dispatch or lost text',
  );
  await A.conn.reducers.withdrawMyBeginning({ bottleId: beginning.id });
  await until(
    () =>
      rows(observer, 'postcard').length === 0 && rows(observer, 'postcardSceneStatus').length === 0,
    'Withdrawal did not reach new subscriber',
  );
  assert.ok(sceneTables.every((table) => sql(table).length === 0));
  await until(
    () => rows(A, 'myAppreciation').length === 0 && rows(B, 'myAppreciation').length === 0,
    'Withdrawal did not clear old private receipt views',
  );
  assert.deepEqual(subscriptionErrors, []);
  pass(
    'Withdrawal through the old client removes both pairs, private thanks and all new scene state for old and new subscribers',
  );
  const report = {
    checkedAt: new Date().toISOString(),
    legacyCommit: legacyRef,
    candidateCommit,
    mode: 'Actual isolated local SpacetimeDB publish, SQL invariants, old/new generated SDK subscriptions and scheduler. Synthetic stories, cleared provider keys, no browser challenge or model call.',
    beforeCounts: Object.fromEntries(tables.map((table) => [table, before[table].length])),
    afterCounts: Object.fromEntries(tables.map((table) => [table, after[table].length])),
    initialSceneCounts: Object.fromEntries(
      sceneTables.map((table) => [table, initialScenes[table].length]),
    ),
    oldClientReconnects: [A, B, C].map((client) => client.reconnects),
    planSha256: createHash('sha256').update(plan).digest('hex'),
    checks,
    limits: [
      'Not a hosted upgrade or hosted generation check',
      'No paid call or successful provider scene in this migration test',
      'Three synthetic writers and two pairs; not a load benchmark',
    ],
  };
  await fs.writeFile(
    path.join(
      root,
      process.env.DRIFT_MIGRATION_VOTES === 'true'
        ? 'docs/evidence/voting-migration.json'
        : 'docs/evidence/scene-migration.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const client of clients) client.disconnect();
  if (published) command(['delete', room, '--yes']);
}
