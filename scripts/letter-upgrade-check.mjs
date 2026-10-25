// Owner-only readback for the fixed hosted database. Raw backups stay in ignored local storage.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = path.resolve(new URL('../', import.meta.url).pathname);
process.chdir(root);
const action = process.argv[2];
if (!['backup', 'verify'].includes(action) || process.argv.length !== 3)
  throw Error('Use backup or verify.');
const tables = [
  'round',
  'bottle',
  'postcard',
  'authorship',
  'request',
  'report',
  'config',
  'today',
  'hello',
  'report_resolution',
  'maintenance',
  'shore_pass',
  'ai_budget',
  'ai_call',
  'id_allocator',
  'activity_day',
];
function sql(table) {
  const r = spawnSync(
    process.execPath,
    [
      'scripts/spacetime.mjs',
      'sql',
      '--server',
      'maincloud',
      '--format',
      'json',
      'drift-calhacks-2026',
      `SELECT * FROM ${table}`,
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.status !== 0) throw Error('Owner read failed for ' + table);
  const line = r.stdout.split('\n').find((s) => s.startsWith('['));
  if (!line) throw Error('Invalid SQL response');
  const value = JSON.parse(line)[0];
  const columns = value.schema.elements.map((e) =>
    e.name.some.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
  );
  return value.rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}
const pointer = path.join(root, '.spacetime', 'letter-upgrade-backup-path');
if (action === 'backup') {
  const records = Object.fromEntries(tables.map((t) => [t, sql(t)]));
  assert.equal(
    records.config[0]?.paused,
    true,
    'Pause submissions before taking the migration snapshot.',
  );
  assert.ok(
    !records.round.some((r) => r.inFlight && r.busyUntil > Date.now()),
    'Wait for in-flight checks.',
  );
  const directory = path.join(root, '.spacetime', 'backups');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, `letters-${Date.now()}.json`);
  const snapshot = {
    checkedAt: new Date().toISOString(),
    database: 'drift-calhacks-2026',
    records,
  };
  await fs.writeFile(file, JSON.stringify(snapshot), { mode: 0o600, flag: 'wx' });
  await fs.writeFile(pointer, file, { mode: 0o600 });
  console.log(
    JSON.stringify({
      backupSavedLocally: true,
      counts: Object.fromEntries(tables.map((t) => [t, records[t].length])),
    }),
  );
} else {
  const file = (await fs.readFile(pointer, 'utf8')).trim();
  const raw = await fs.readFile(file);
  const before = JSON.parse(raw).records;
  const after = Object.fromEntries(tables.map((t) => [t, sql(t)]));
  let completedReleases = 0;
  for (const table of tables) {
    // Scheduled time/pass expiration may advance during the upgrade; they are backed up but not immutable.
    if (['maintenance', 'shore_pass'].includes(table)) continue;
    assert.equal(after[table].length, before[table].length, table + ' row count');
    const primary =
      table === 'hello' ? 'cardId' : table === 'report_resolution' ? 'reportId' : 'id';
    for (const old of before[table]) {
      const next = after[table].find(
        (r) => JSON.stringify(r[primary]) === JSON.stringify(old[primary]),
      );
      assert.ok(next, table + ' retained ID');
      for (const field of Object.keys(old)) {
        const isRelease =
          table === 'round' && field === 'stage' && old.stage === 'catch' && old.setupId;
        if (isRelease) completedReleases++;
        assert.deepEqual(
          next[field],
          isRelease ? 'done' : old[field],
          table + '.' + field + ' retained',
        );
      }
    }
  }
  const marker = sql('schema_migration');
  assert.equal(marker.length, 1);
  assert.equal(marker[0].id, 'independent-letters-v1');
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const report = {
    checkedAt: new Date().toISOString(),
    database: 'drift-calhacks-2026',
    sourceCommit: commit,
    backupSha256: createHash('sha256').update(raw).digest('hex'),
    rawBackup: 'Ignored local owner snapshot; not included in this report',
    beforeCounts: Object.fromEntries(tables.map((t) => [t, before[t].length])),
    afterCounts: Object.fromEntries(tables.map((t) => [t, after[t].length])),
    completedReleases,
    backfill: marker[0],
    approvedBeginnings: sql('beginning').length,
    scope:
      'Owner SQL readback: previous IDs/fields retained except documented completed-release stage changes. Automatic maintenance/pass expiration excluded from immutable comparisons. No stories or model calls created by these probes.',
  };
  await fs.writeFile(
    'docs/evidence/letter-upgrade-hosted.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
}
