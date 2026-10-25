import { spawnSync } from 'node:child_process';
import { ACTIVITY_METRICS } from '../packages/activity/index';
if (process.argv.length > 2) throw Error('Usage: npm run ops:activity');
const result = spawnSync(
  process.execPath,
  [
    'scripts/spacetime.mjs',
    'call',
    'drift-calhacks-2026',
    'admin_activity',
    '--server',
    'maincloud',
  ],
  { encoding: 'utf8' },
);
if (result.status !== 0) throw Error('Could not read owner activity. Check CLI login.');
const line = result.stdout.split('\n').find((line) => line.startsWith('['));
if (!line) throw Error('Unexpected owner activity response.');
const rows = JSON.parse(line);
if (!Array.isArray(rows)) throw Error('Unexpected owner activity schema.');
const days = rows.map((row: any) => {
  if (
    !Array.isArray(row) ||
    row.length !== 3 ||
    !Number.isInteger(row[0]) ||
    !['live', 'sandbox'].includes(row[1]) ||
    typeof row[2] !== 'string'
  )
    throw Error('Activity schema changed; update the formatter.');
  const counts = JSON.parse(row[2]);
  if (
    Object.keys(counts).length !== ACTIVITY_METRICS.length ||
    ACTIVITY_METRICS.some((key) => !Number.isSafeInteger(counts[key]) || counts[key] < 0)
  )
    throw Error('Invalid activity counters.');
  return {
    day: row[0],
    dateUtc: new Date(row[0] * 86400000).toISOString().slice(0, 10),
    mode: row[1],
    counts,
  };
});
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      database: 'drift-calhacks-2026',
      scope:
        'Private UTC-day counts since this release; no backfill or unique-visitor estimate. Live means server configuration, not verified human/attendee activity. Client reports are best effort and deduplicated per author/card/action. Counts expire after thirty days.',
      interpretation:
        'PNG requested does not prove a file was saved. Native-share resolved does not prove recipient delivery. Completion timing includes moderation and is not end-to-end phone latency. Cohorts can span days, so these counts are not a conversion-rate denominator.',
      days,
    },
    null,
    2,
  ),
);
