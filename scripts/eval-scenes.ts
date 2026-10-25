import fs from 'node:fs/promises';
import path from 'node:path';
import {
  sceneModelRequest,
  getScenePack,
  parseSceneModelResponse,
  SCENE_CONTRACT_VERSION,
  type SceneInput,
} from '../packages/scene-contracts/index';
import { quoteRequest, priceUsage, PRICE_VERSION } from '../packages/ai-costs/index';

// Credentials come from the parent process environment only. Never load or write a key file.
const args = process.argv.slice(2);
const option = (name: string, fallback: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const out = path.resolve(option('--out', 'test-results/scenes'));
const model = option('--model', 'claude-sonnet-5-5');
const fixturePath = option('--fixtures', 'evals/scene-cases.json');
const fixtures: (SceneInput & { id: string; synthetic: boolean })[] = JSON.parse(
  await fs.readFile(fixturePath, 'utf8'),
);
const wanted = option('--ids', '').split(',').filter(Boolean);
const selected = fixtures.filter((item) => !wanted.length || wanted.includes(item.id));
if (!selected.length || selected.length > 12) throw Error('Select one to twelve fixtures.');
if (selected.some((item) => !item.synthetic))
  throw Error('This evaluator accepts labeled synthetic fixtures only.');
const dry = args.includes('--dry-run');
if (!dry && !process.env.ANTHROPIC_API_KEY)
  throw Error('Pass ANTHROPIC_API_KEY in the process environment. No calls were made.');
await fs.mkdir(out, { recursive: true });
const results: Record<string, unknown>[] = [];
for (const fixture of selected) {
  const { promptId, promptTitle, setup, reply } = fixture;
  const request = sceneModelRequest({ promptId, promptTitle, setup, reply }, model);
  const quote = quoteRequest(request);
  const record: Record<string, unknown> = {
    fixture,
    contract: SCENE_CONTRACT_VERSION,
    model,
    priceVersion: PRICE_VERSION,
    requestBytes: quote.requestBytes,
    startedAt: new Date().toISOString(),
  };
  if (dry) record.status = 'dry-run';
  else {
    const start = performance.now();
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(25000),
      });
      record.httpStatus = response.status;
      const body = (await response.json()) as Record<string, unknown>;
      record.elapsedMs = Math.round(performance.now() - start);
      if (!response.ok) {
        record.status = 'provider-error';
        const error = body.error as { type?: string } | undefined;
        record.errorType = error?.type || 'unknown';
      } else {
        record.usage = body.usage;
        record.responseModel = body.model;
        record.stopReason = body.stop_reason;
        const cost = priceUsage(model, body.usage);
        record.estimatedUsd = cost ? Number(cost.estimatedMicros) / 1_000_000 : null;
        try {
          record.scene = parseSceneModelResponse(body, getScenePack(promptId));
          record.status = 'valid';
        } catch (error) {
          record.status = 'invalid-scene';
          record.validationError = error instanceof Error ? error.message : 'Invalid response';
          // Content is model output, never request headers or credentials. Retain it for diagnosis.
          record.content = Array.isArray(body.content)
            ? body.content.filter((part) => part?.type === 'text')
            : [];
        }
      }
    } catch (error) {
      record.elapsedMs = Math.round(performance.now() - start);
      record.status = 'transport-error';
      record.errorType = error instanceof Error ? error.name : 'UnknownError';
    }
  }
  results.push(record);
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(
    JSON.stringify({
      id: fixture.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      estimatedUsd: record.estimatedUsd,
      httpStatus: record.httpStatus,
      error: record.errorType || record.validationError,
    }),
  );
  // Authentication/quota errors won't improve by sending the remaining fixtures.
  if ([401, 403, 429].includes(Number(record.httpStatus))) break;
}
console.log(`Saved ${results.length} result(s) to ${path.join(out, 'results.json')}`);
if (results.some((result) => !['valid', 'dry-run'].includes(String(result.status))))
  process.exitCode = 1;
