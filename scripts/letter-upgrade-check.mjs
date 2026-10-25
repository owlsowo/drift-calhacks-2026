// Owner-only readback for the fixed hosted database. Raw backups stay in ignored local storage.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const database = 'drift-calhacks-2026';
export const requiredTables = [
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
  'maintenance',
  'shore_pass',
  'ai_budget',
  'ai_call',
  'id_allocator',
  'activity_day',
  'schema_migration',
];
export const sceneTables = [
  'postcard_scene',
  'postcard_scene_status',
  'scene_job',
  'scene_schedule',
];
const tables = [...requiredTables, ...sceneTables];
const primaryKeys = {
  hello: 'cardId',
  report_resolution: 'reportId',
  shore_pass: 'owner',
  postcard_scene: 'cardId',
  postcard_scene_status: 'cardId',
  scene_job: 'cardId',
  scene_schedule: 'scheduledId',
};
const camelCase = (name) => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function check(condition, message) {
  // Assertion diffs can expose stories, identities or request bodies. Report only the failing field.
  if (!condition) throw Error(message);
}
function parseResponse(stdout) {
  try {
    const start = stdout.indexOf('[');
    if (start === -1) throw Error();
    return JSON.parse(stdout.slice(start));
  } catch {
    throw Error('Invalid owner CLI response; no records printed.');
  }
}

// `describe ... tables` uses source_name (camelCase on the current CLI), not SQL table names.
export function discoverTables(metadata) {
  check(Array.isArray(metadata), 'Invalid table metadata.');
  const names = new Set();
  for (const item of metadata) {
    check(typeof item?.source_name === 'string', 'Invalid table metadata name.');
    const table = tables.find(
      (candidate) => item.source_name === candidate || item.source_name === camelCase(candidate),
    );
    if (!table) continue; // Never query a table merely because the host advertises it.
    check(!names.has(table), 'Duplicate table metadata for ' + table);
    names.add(table);
  }
  for (const table of requiredTables)
    check(names.has(table), 'Required hosted table is missing: ' + table);
  return tables.filter((table) => names.has(table));
}

export function createOwnerReader(run = spawnSync, workspace = root) {
  function read(args, label) {
    const result = run(process.execPath, ['scripts/spacetime.mjs', ...args], {
      cwd: workspace,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    check(result.status === 0, 'Owner read failed for ' + label);
    return parseResponse(result.stdout);
  }
  return {
    describe: () =>
      discoverTables(
        read(['describe', '--server', 'maincloud', '--json', database, 'tables'], 'table metadata'),
      ),
    sql(table) {
      check(tables.includes(table), 'Refusing an unexpected table read.');
      const response = read(
        ['sql', '--server', 'maincloud', '--format', 'json', database, `SELECT * FROM ${table}`],
        table,
      );
      check(response.length === 1, 'Invalid SQL result count for ' + table);
      const value = response[0];
      check(
        Array.isArray(value?.schema?.elements) && Array.isArray(value?.rows),
        'Invalid SQL response for ' + table,
      );
      const columns = value.schema.elements.map((element) => {
        check(typeof element?.name?.some === 'string', 'Invalid SQL column for ' + table);
        return camelCase(element.name.some);
      });
      check(new Set(columns).size === columns.length, 'Duplicate SQL columns for ' + table);
      return value.rows.map((row) => {
        check(Array.isArray(row) && row.length === columns.length, 'Invalid SQL row for ' + table);
        return Object.fromEntries(columns.map((column, i) => [column, row[i]]));
      });
    },
  };
}

export function assertQuiescent(records, now = Date.now()) {
  check(
    records.config?.length === 1 && records.config[0].paused === true,
    'Pause submissions before taking or verifying the migration snapshot.',
  );
  check(Array.isArray(records.round), 'Missing round readback.');
  check(
    !records.round.some((row) => row.inFlight && row.busyUntil > now),
    'Wait for in-flight checks to settle, then rerun; no snapshot was saved.',
  );
  check(
    !records.scene_job?.some((row) => row.state === 'queued' || row.state === 'pending'),
    'Wait for queued/pending scene jobs to settle, then rerun; no snapshot was saved.',
  );
}

function indexRows(table, rows) {
  check(Array.isArray(rows), 'Missing rows for ' + table);
  const primary = primaryKeys[table] ?? 'id';
  const indexed = new Map();
  for (const row of rows) {
    check(
      row && Object.hasOwn(row, primary) && row[primary] !== undefined && row[primary] !== null,
      table + ' missing primary key field ' + primary,
    );
    const key = JSON.stringify(row[primary]);
    check(!indexed.has(key), table + ' duplicate primary key');
    indexed.set(key, row);
  }
  return indexed;
}

export function verifyRecords(snapshot, after) {
  check(
    snapshot?.formatVersion === 2 && snapshot.database === database,
    'Take a new backup with this checker before publishing; the backup manifest is missing or outdated.',
  );
  const before = snapshot.records;
  const absent = snapshot.absentBeforeUpgrade;
  check(
    Array.isArray(absent) &&
      new Set(absent).size === absent.length &&
      absent.every((table) => sceneTables.includes(table)),
    'Invalid absent-table manifest.',
  );
  check(
    before &&
      Object.keys(before).length === tables.length &&
      tables.every((table) => Object.hasOwn(before, table)),
    'Backup does not cover every expected table.',
  );
  check(
    after && tables.every((table) => Object.hasOwn(after, table)),
    'Post-upgrade readback is missing an expected table.',
  );
  let completedReleases = 0;
  for (const table of tables) {
    const oldRows = indexRows(table, before[table]);
    const nextRows = indexRows(table, after[table]);
    if (absent.includes(table))
      check(oldRows.size === 0, table + ' expected an explicit empty baseline');
    // Scheduled maintenance and pass expiration can advance; retain the raw backup but allow these changes.
    if (['maintenance', 'shore_pass'].includes(table)) continue;
    check(
      nextRows.size === oldRows.size,
      table +
        ' row count changed' +
        (absent.includes(table) ? ' (new table must be empty on this upgrade)' : ''),
    );
    for (const [key, old] of oldRows) {
      const next = nextRows.get(key);
      check(next, table + ' retained primary key');
      for (const field of Object.keys(old)) {
        const isRelease =
          table === 'round' && field === 'stage' && old.stage === 'catch' && old.setupId;
        if (isRelease) completedReleases++;
        check(
          isDeepStrictEqual(next[field], isRelease ? 'done' : old[field]),
          table + '.' + field + ' changed',
        );
      }
    }
  }
  const marker = after.schema_migration;
  check(
    marker.length === 1 && marker[0].id === 'independent-letters-v1',
    'Missing or unexpected independent-letters migration marker.',
  );
  return completedReleases;
}

export async function runUpgradeCheck(action, { run = spawnSync, workspace = root } = {}) {
  check(['backup', 'verify'].includes(action), 'Use backup or verify.');
  const reader = createOwnerReader(run, workspace);
  const available = reader.describe();
  const absentBeforeUpgrade = sceneTables.filter((table) => !available.includes(table));
  function quiescentRead() {
    const records = { config: reader.sql('config'), round: reader.sql('round') };
    if (available.includes('scene_job')) records.scene_job = reader.sql('scene_job');
    assertQuiescent(records);
  }
  function readRecords() {
    return Object.fromEntries(
      tables.map((table) => [table, available.includes(table) ? reader.sql(table) : []]),
    );
  }
  const counts = (records) =>
    Object.fromEntries(tables.map((table) => [table, records[table].length]));
  const pointer = path.join(workspace, '.spacetime', 'letter-upgrade-backup-path');
  if (action === 'backup') {
    // Do not wait/poll here: the owner lets existing work settle before rerunning this command.
    quiescentRead();
    const records = readRecords();
    assertQuiescent(records);
    for (const table of tables) indexRows(table, records[table]);
    quiescentRead();
    const directory = path.join(workspace, '.spacetime', 'backups');
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.chmod(directory, 0o700);
    const file = path.join(directory, `letters-${Date.now()}.json`);
    const snapshot = {
      formatVersion: 2,
      checkedAt: new Date().toISOString(),
      database,
      absentBeforeUpgrade,
      records,
    };
    await fs.writeFile(file, JSON.stringify(snapshot), { mode: 0o600, flag: 'wx' });
    await fs.writeFile(pointer, file, { mode: 0o600 });
    await fs.chmod(pointer, 0o600);
    return {
      backupSavedLocally: true,
      counts: counts(records),
      absentBeforeUpgrade,
      newTableExpectedCounts: Object.fromEntries(absentBeforeUpgrade.map((table) => [table, 0])),
    };
  }
  for (const table of sceneTables)
    check(available.includes(table), 'Expected post-upgrade table is missing: ' + table);
  quiescentRead();
  const file = (await fs.readFile(pointer, 'utf8')).trim();
  const raw = await fs.readFile(file);
  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch {
    throw Error('Invalid local backup JSON; no records printed.');
  }
  const after = readRecords();
  assertQuiescent(after);
  quiescentRead();
  const completedReleases = verifyRecords(snapshot, after);
  const marker = after.schema_migration[0];
  const revision = run('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' });
  check(
    revision.status === 0 && /^[0-9a-f]{40,64}$/.test(revision.stdout.trim()),
    'Could not identify source commit.',
  );
  const report = {
    checkedAt: new Date().toISOString(),
    database,
    sourceCommit: revision.stdout.trim(),
    backupSha256: createHash('sha256').update(raw).digest('hex'),
    rawBackup: 'Ignored local owner snapshot; not included in this report',
    beforeCounts: counts(snapshot.records),
    afterCounts: counts(after),
    newTableExpectedCounts: Object.fromEntries(
      snapshot.absentBeforeUpgrade.map((table) => [table, 0]),
    ),
    completedReleases,
    backfill: Object.fromEntries(
      ['id', 'appliedMs', 'beginnings', 'pairs', 'rounds', 'orphanPairs'].map((field) => [
        field,
        marker[field],
      ]),
    ),
    approvedBeginnings: after.beginning.length,
    scope:
      'Owner SQL readback: every backed table/ID/field retained except documented completed-release stage changes. Newly added scene tables explicitly required empty. Automatic maintenance/pass expiration excluded from immutable comparisons. Submissions paused and active checks/scene jobs settled. No stories or model calls created by these probes.',
  };
  await fs.writeFile(
    path.join(workspace, 'docs/evidence/letter-upgrade-hosted.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  check(process.argv.length === 3, 'Use backup or verify.');
  console.log(JSON.stringify(await runUpgradeCheck(process.argv[2]), null, 2));
}
