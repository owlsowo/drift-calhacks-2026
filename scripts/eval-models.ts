import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { modelRequest, parseModelResponse, type ModelKind } from '../packages/ai-contracts/index';
const root = new URL('../', import.meta.url);
process.chdir(root.pathname);
if (existsSync('.env')) process.loadEnvFile('.env');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : 12;
if (!Number.isInteger(limit) || limit < 1 || limit > 80) throw Error('Use --limit from 1 to 80.');
const fixtures = JSON.parse(await fs.readFile(new URL('evals/cases.json', root), 'utf8')) as Array<{
  id: string;
  kind: ModelKind;
  input: object;
  expected?: string;
  note: string;
}>;
if (new Set(fixtures.map((f) => f.id)).size !== fixtures.length)
  throw Error('Fixture identifiers must be unique.');
for (const f of fixtures) {
  if (!f.id || !['moderation', 'nudge'].includes(f.kind) || !f.input || !f.note)
    throw Error('Malformed fixture.');
  JSON.stringify(modelRequest(f.kind, f.input));
}
if (dryRun) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        fixtures: fixtures.length,
        moderation: fixtures.filter((f) => f.kind === 'moderation').length,
        nudge: fixtures.filter((f) => f.kind === 'nudge').length,
        dispatched: 0,
        liveEvaluation: false,
      },
      null,
      2,
    ),
  );
} else {
  if (!process.env.ANTHROPIC_API_KEY)
    throw Error('Add ANTHROPIC_API_KEY to the root .env; no model calls were made.');
  await fs.mkdir('.spacetime', { recursive: true });
  const ledgerPath = '.spacetime/eval-usage.json';
  let ledger: { dispatches: number } = { dispatches: 0 };
  if (existsSync(ledgerPath)) ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
  const results: any[] = [];
  const priority = [
    'benign-1',
    'pair-wordplay',
    'targeted-hate',
    'pair-targeting',
    'contact-email',
    'instruction-harm',
    'quoted-rejection',
    'nudge-1',
    'nudge-3',
    'nudge-injection',
    'nudge-personal',
    'benign-13',
  ];
  const ordered = [
    ...priority.map((id) => fixtures.find((f) => f.id === id)!),
    ...fixtures.filter((f) => !priority.includes(f.id)),
  ];
  const selected = ordered.slice(0, limit);
  for (const f of selected) {
    if (ledger.dispatches >= 80)
      throw Error(
        'The 80-dispatch evaluation allowance is exhausted. Review results before increasing it.',
      );
    ledger.dispatches++;
    await fs.writeFile(ledgerPath, JSON.stringify(ledger));
    const started = Date.now();
    const model = f.kind === 'nudge' ? process.env.NUDGE_MODEL : process.env.MODERATION_MODEL;
    const request = modelRequest(f.kind, f.input, model);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(18000),
      });
      if (!response.ok) throw Error(`Provider HTTP ${response.status}`);
      const body = await response.json();
      const output = parseModelResponse(f.kind, body);
      results.push({
        id: f.id,
        kind: f.kind,
        model: request.model,
        elapsedMs: Date.now() - started,
        output,
        expected: f.expected,
        agrees: f.expected ? output.decision === f.expected : undefined,
        usage: body.usage,
        manualReview: {
          reviewed: false,
          helpful: null,
          grounded: null,
          writesEnding: null,
          notes: '',
        },
      });
    } catch (e) {
      results.push({
        id: f.id,
        kind: f.kind,
        model: request.model,
        elapsedMs: Date.now() - started,
        error: e instanceof Error ? e.message : 'Unknown failure',
        retried: false,
      });
    }
    console.log(
      `${f.id}: ${results.at(-1).error ? 'failed; no automatic retry' : 'received; review required'}`,
    );
  }
  const filename = `evals/results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await fs.writeFile(
    filename,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'live synthetic component evaluation',
        applicationDispatchesNotIncluded: true,
        dispatches: results.length,
        lifetimeEvalDispatches: ledger.dispatches,
        results,
      },
      null,
      2,
    ),
  );
  console.log(filename);
}
