import fs from 'node:fs/promises';
import { PRICE_VERSION, priceUsage, percentile } from '../packages/ai-costs/index';

// Reprice committed real-evaluation usage without making any new model calls.
const files = process.argv.slice(2);
const selected = files.length
  ? files
  : (await fs.readdir('evals'))
      .filter((name) => /^results-.*\.json$/.test(name))
      .map((name) => 'evals/' + name);
const report: any[] = [];
let total = 0n,
  unknown = 0,
  calls = 0;
for (const file of selected) {
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  if (data.mode !== 'live synthetic component evaluation' || !Array.isArray(data.results))
    throw Error('Use recorded live component evaluations only.');
  const groups: Record<
    string,
    { calls: number; unknown: number; estimatedMicros: bigint; elapsed: number[] }
  > = {};
  for (const row of data.results) {
    const kind = row.kind;
    const group = (groups[kind] ??= { calls: 0, unknown: 0, estimatedMicros: 0n, elapsed: [] });
    group.calls++;
    calls++;
    const cost = priceUsage(row.model, row.usage);
    if (cost) {
      group.estimatedMicros += cost.estimatedMicros;
      total += cost.estimatedMicros;
    } else {
      group.unknown++;
      unknown++;
    }
    if (typeof row.elapsedMs === 'number' && row.elapsedMs >= 0) group.elapsed.push(row.elapsedMs);
  }
  report.push({
    file,
    groups: Object.fromEntries(
      Object.entries(groups).map(([kind, g]) => [
        kind,
        {
          calls: g.calls,
          unknownBilling: g.unknown,
          knownEstimateUsd: (Number(g.estimatedMicros) / 1e6).toFixed(6),
          p50Ms: percentile(g.elapsed, 0.5),
          p95Ms: percentile(g.elapsed, 0.95),
        },
      ]),
    ),
  });
}
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      priceVersion: PRICE_VERSION,
      mode: 'Offline estimate from saved provider usage; no new dispatches',
      scope:
        'Component evaluations only; excludes application/owner calls and all other account use. Not an invoice or account balance.',
      calls,
      unknownBilling: unknown,
      knownEstimateUsd: (Number(total) / 1e6).toFixed(6),
      report,
    },
    null,
    2,
  ),
);
