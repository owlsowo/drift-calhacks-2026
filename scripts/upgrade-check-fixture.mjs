// Synthetic readback invariants; never connects to the hosted database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  discoverTables,
  createOwnerReader,
  assertQuiescent,
  verifyRecords,
  runUpgradeCheck,
  requiredTables,
  sceneTables,
} from './letter-upgrade-check.mjs';
const all = [...requiredTables, ...sceneTables];
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const metadata = (tables) =>
  tables.map((source_name) => ({ source_name: camel(source_name), primary_key: [0] }));
const secret = 'PRIVATE-STORY-DO-NOT-PRINT';
const marker = {
  id: 'independent-letters-v1',
  appliedMs: 1000,
  beginnings: 1,
  pairs: 2,
  rounds: 3,
  orphanPairs: 0,
};
function records() {
  const r = Object.fromEntries(all.map((t) => [t, []]));
  r.config = [{ id: 0, paused: true, owner: 'private-owner', dispatches: 0 }];
  r.schema_migration = [marker];
  r.beginning = [{ id: 'b1', text: secret, createdMs: 20 }];
  r.round = [{ id: 'r1', inFlight: '', busyUntil: 0, stage: 'write', setupId: '', text: secret }];
  r.maintenance = [{ id: '1', scheduledAt: { Time: '9999' } }];
  r.shore_pass = [{ owner: { __identity__: 'private-owner' }, expiresMs: 1234 }];
  return r;
}
const clone = (v) => structuredClone(v);
const snap = (r, absent = []) => ({
  formatVersion: 2,
  database: 'drift-calhacks-2026',
  records: r,
  absentBeforeUpgrade: absent,
});
const checks = [];
function test(name, fn) {
  fn();
  checks.push(name);
}
async function asyncTest(name, fn) {
  await fn();
  checks.push(name);
}
test('actual camelCase metadata and named optional allowlist', () => {
  assert.deepEqual(
    discoverTables([...metadata(requiredTables), { source_name: 'privateEnvironmentSecret' }]),
    requiredTables,
  );
  assert.deepEqual(discoverTables(metadata(all)), all);
  assert.throws(
    () => discoverTables(metadata(requiredTables.filter((t) => t !== 'beginning'))),
    /Required hosted table is missing: beginning/,
  );
  assert.throws(
    () => discoverTables([...metadata(requiredTables), { source_name: 'schema_migration' }]),
    /Duplicate table metadata/,
  );
  assert.throws(() => discoverTables({ tables: [] }), /Invalid table metadata/);
});
test('SQL response field decoding and no private diagnostic output', () => {
  const calls = [];
  const reader = createOwnerReader((command, args) => {
    calls.push(args);
    return {
      status: 0,
      stdout: JSON.stringify([
        {
          schema: { elements: [{ name: { some: 'card_id' } }, { name: { some: 'scene_json' } }] },
          rows: [['c1', secret]],
        },
      ]),
    };
  });
  assert.deepEqual(reader.sql('postcard_scene'), [{ cardId: 'c1', sceneJson: secret }]);
  assert.throws(() => reader.sql('privateEnvironmentSecret'), /unexpected table/);
  assert.equal(calls.length, 1);
  const broken = createOwnerReader(() => ({ status: 0, stdout: `[broken ${secret} ` }));
  assert.throws(
    () => broken.sql('postcard'),
    (e) => !e.message.includes(secret) && /Invalid owner CLI/.test(e.message),
  );
  const rejected = createOwnerReader(() => ({ status: 1, stdout: secret, stderr: secret }));
  assert.throws(
    () => rejected.sql('postcard'),
    (e) => !e.message.includes(secret) && /Owner read failed/.test(e.message),
  );
});
test('quiescence guards reject active checks and queued/pending scenes; expired checks allowed', () => {
  const base = records();
  assertQuiescent(base, 100);
  for (const state of ['queued', 'pending']) {
    const r = clone(base);
    r.scene_job = [{ cardId: 'c1', state }];
    assert.throws(() => assertQuiescent(r, 100), /scene jobs to settle/);
  }
  for (const state of ['ready', 'failed']) {
    const r = clone(base);
    r.scene_job = [{ cardId: 'c1', state }];
    assertQuiescent(r, 100);
  }
  const active = clone(base);
  active.round[0].inFlight = 'request';
  active.round[0].busyUntil = 101;
  assert.throws(() => assertQuiescent(active, 100), /in-flight checks to settle/);
  assertQuiescent(active, 102);
  const live = clone(base);
  live.config[0].paused = false;
  assert.throws(() => assertQuiescent(live), /Pause submissions/);
});
test('first-upgrade scene tables have explicit zero expectations and cannot be missing/nonempty', () => {
  const r = records();
  const s = snap(r, sceneTables);
  assert.equal(verifyRecords(s, clone(r)), 0);
  const added = clone(r);
  added.postcard_scene = [{ cardId: 'x', sceneJson: secret }];
  assert.throws(() => verifyRecords(s, added), /new table must be empty/);
  const missing = clone(r);
  delete missing.scene_job;
  assert.throws(() => verifyRecords(s, missing), /missing an expected table/);
  const legacy = { records: r };
  assert.throws(() => verifyRecords(legacy, r), /manifest is missing or outdated/);
});
test('scene cardId and schedule scheduledId reconcile reordered multiple rows and all backed fields', () => {
  const r = records();
  for (const t of sceneTables)
    r[t] = [1, 2].map((n) =>
      t === 'scene_schedule'
        ? { scheduledId: String(n), cardId: 'c' + n, scheduledAt: { Interval: '1000' } }
        : { cardId: 'c' + n, state: 'ready', sceneJson: secret + n },
    );
  const after = clone(r);
  for (const t of sceneTables) after[t].reverse();
  assert.equal(verifyRecords(snap(r), after), 0);
  for (const t of ['beginning', 'schema_migration', ...sceneTables]) {
    const changed = clone(after);
    const field =
      t === 'beginning'
        ? 'text'
        : t === 'schema_migration'
          ? 'appliedMs'
          : t === 'scene_schedule'
            ? 'scheduledAt'
            : 'sceneJson';
    changed[t][0][field] = 'changed';
    assert.throws(
      () => verifyRecords(snap(r), changed),
      (e) => e.message.startsWith(t + '.' + field) && !e.message.includes(secret),
    );
  }
  const bad = clone(after);
  bad.scene_job[1].cardId = bad.scene_job[0].cardId;
  assert.throws(() => verifyRecords(snap(r), bad), /duplicate primary key/);
});
test('documented legacy completion and maintenance/pass exceptions remain narrow', () => {
  const r = records();
  r.round[0] = { ...r.round[0], stage: 'catch', setupId: 'b1' };
  const after = clone(r);
  after.round[0].stage = 'done';
  after.maintenance[0].scheduledAt = { Time: '12345' };
  after.shore_pass = [];
  assert.equal(verifyRecords(snap(r), after), 1);
  after.round[0].text = 'changed';
  assert.throws(() => verifyRecords(snap(r), after), /round.text changed/);
});
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'drift-upgrade-fixture-'));
try {
  await fs.mkdir(path.join(workspace, 'docs/evidence'), { recursive: true });
  let current = records(),
    present = [...requiredTables],
    sqlReads = [],
    lastFirstArgs = [];
  function run(command, args) {
    lastFirstArgs.push(args[0]);
    if (command === 'git') return { status: 0, stdout: 'a'.repeat(40) + '\n' };
    assert.equal(args[0], 'scripts/spacetime.mjs');
    assert.ok(['describe', 'sql'].includes(args[1]), 'read-only CLI calls only');
    if (args[1] === 'describe') return { status: 0, stdout: JSON.stringify(metadata(present)) };
    const match = /^SELECT \* FROM ([a-z_]+)$/.exec(args.at(-1));
    assert.ok(match);
    const table = match[1];
    assert.ok(present.includes(table), 'never select absent table');
    sqlReads.push(table);
    const rows = current[table];
    const columns = Object.keys(rows[0] ?? {});
    return {
      status: 0,
      stdout: JSON.stringify([
        {
          schema: { elements: columns.map((name) => ({ name: { some: name } })) },
          rows: rows.map((row) => columns.map((c) => row[c])),
        },
      ]),
    };
  }
  await asyncTest(
    'full mocked first-upgrade backup/readback stays local, 0600 and counts-only',
    async () => {
      const saved = await runUpgradeCheck('backup', { run, workspace });
      assert.deepEqual(
        saved.newTableExpectedCounts,
        Object.fromEntries(sceneTables.map((t) => [t, 0])),
      );
      assert.ok(!sqlReads.some((t) => sceneTables.includes(t)));
      assert.ok(!JSON.stringify(saved).includes(secret));
      const pointer = path.join(workspace, '.spacetime/letter-upgrade-backup-path');
      const file = (await fs.readFile(pointer, 'utf8')).trim();
      assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
      assert.equal((await fs.stat(pointer)).mode & 0o777, 0o600);
      assert.equal((await fs.stat(path.dirname(file))).mode & 0o777, 0o700);
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      assert.equal(raw.records.beginning[0].text, secret);
      assert.deepEqual(raw.absentBeforeUpgrade, sceneTables);
      await assert.rejects(
        runUpgradeCheck('verify', { run, workspace }),
        /Expected post-upgrade table is missing/,
      );
      present = [...all];
      const report = await runUpgradeCheck('verify', { run, workspace });
      assert.equal(report.beforeCounts.scene_job, 0);
      assert.equal(report.afterCounts.scene_job, 0);
      const published = await fs.readFile(
        path.join(workspace, 'docs/evidence/letter-upgrade-hosted.json'),
        'utf8',
      );
      assert.ok(!published.includes(secret));
      assert.ok(!published.includes('private-owner'));
      await fs.writeFile(file, '{"PRIVATE-STORY-DO-NOT-PRINT":broken');
      await assert.rejects(
        runUpgradeCheck('verify', { run, workspace }),
        (e) => e.message === 'Invalid local backup JSON; no records printed.',
      );
    },
  );
  await asyncTest('preflight rejects live work before snapshot reads or writing', async () => {
    for (const kind of ['pause', 'check', 'queued', 'pending']) {
      current = records();
      sqlReads = [];
      if (kind === 'pause') current.config[0].paused = false;
      else if (kind === 'check') {
        current.round[0].inFlight = 'test';
        current.round[0].busyUntil = Date.now() + 60000;
      } else current.scene_job = [{ cardId: 'c1', state: kind }];
      const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'drift-upgrade-guard-'));
      try {
        await assert.rejects(runUpgradeCheck('backup', { run, workspace: isolated }));
        assert.ok(sqlReads.every((t) => ['config', 'round', 'scene_job'].includes(t)));
        await assert.rejects(fs.stat(path.join(isolated, '.spacetime')));
      } finally {
        await fs.rm(isolated, { recursive: true, force: true });
      }
    }
  });
  await asyncTest('existing scene rows included and preserved in subsequent upgrade', async () => {
    current = records();
    current.scene_job = [{ cardId: 'c1', state: 'ready', message: '', owner: 'private-owner' }];
    current.postcard_scene = [{ cardId: 'c1', sceneJson: secret }];
    current.scene_schedule = [
      { scheduledId: '22', cardId: 'c1', scheduledAt: { Interval: '1000' } },
    ];
    const saved = await runUpgradeCheck('backup', { run, workspace });
    assert.deepEqual(saved.absentBeforeUpgrade, []);
    assert.equal(saved.counts.scene_job, 1);
    const report = await runUpgradeCheck('verify', { run, workspace });
    assert.equal(report.afterCounts.scene_job, 1);
    assert.equal(report.afterCounts.scene_schedule, 1);
  });
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}
console.log(
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        'Synthetic fixture only. No live SQL reads, backups, pauses, publishes, or other hosted mutations.',
    },
    null,
    2,
  ),
);
