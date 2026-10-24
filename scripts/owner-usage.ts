import { spawnSync } from 'node:child_process';

// Read-only owner diagnostics through the existing authenticated CLI. No token extraction.
if (process.argv.slice(2).some((arg) => arg !== '--calls'))
  throw Error('Usage: npm run ops:usage -- [--calls]');
function call(name: string) {
  const result = spawnSync(
    process.execPath,
    ['scripts/spacetime.mjs', 'call', 'drift-calhacks-2026', name, '--server', 'maincloud'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw Error('Could not read owner usage. Check CLI login, database and server.');
  const line = result.stdout.split('\n').find((line) => line.startsWith('['));
  if (!line) throw Error('Unexpected CLI response format.');
  return JSON.parse(line);
}
const fields = [
  'priceVersion',
  'startedMs',
  'olderDispatches',
  'budgetMicros',
  'spentEstimateMicros',
  'reservedMicros',
  'retainedCalls',
  'settledCalls',
  'uncertainCalls',
  'pendingCalls',
  'sandboxCalls',
  'inputTokens',
  'outputTokens',
  'measuredCalls',
  'p50Ms',
  'p95Ms',
];
const values = call('admin_ai_usage');
if (!Array.isArray(values) || values.length !== fields.length)
  throw Error('Usage schema changed; update this formatter.');
const status = Object.fromEntries(fields.map((key, index) => [key, values[index]]));
const usd = (micros: number) => (micros / 1e6).toFixed(6);
const report: any = {
  checkedAt: new Date().toISOString(),
  database: 'drift-calhacks-2026',
  scope:
    'Application ledger since startedMs; excludes older dispatches, component evaluations and other account use. Estimates are not an invoice or remaining credit balance.',
  status,
  usd: {
    budget: usd(status.budgetMicros),
    estimatedSpend: usd(status.spentEstimateMicros),
    held: usd(status.reservedMicros),
  },
};
if (process.argv.includes('--calls')) {
  const rows = call('admin_ai_calls');
  const fields = [
    'id',
    'operation',
    'model',
    'priceVersion',
    'requestBytes',
    'reservedMicros',
    'heldMicros',
    'estimatedMicros',
    'inputTokens',
    'outputTokens',
    'state',
    'outcome',
    'createdMs',
    'finishedMs',
    'elapsedMs',
    'durationKnown',
  ];
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !Array.isArray(row) || row.length !== fields.length)
  )
    throw Error('Cost record schema changed; update this formatter.');
  report.recentCalls = rows.map((row: any[]) =>
    Object.fromEntries(fields.map((key, index) => [key, row[index]])),
  );
}
console.log(JSON.stringify(report, null, 2));
