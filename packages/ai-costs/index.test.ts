import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelRequest } from '../ai-contracts/index';
import { quoteRequest, priceUsage } from './index';

test('integer rates include output and use conservative request holds', () => {
  assert.deepEqual(priceUsage('claude-haiku-5-5', { input_tokens: 513, output_tokens: 19 }), {
    inputTokens: 513,
    outputTokens: 19,
    estimatedMicros: 61n,
  });
  assert.equal(
    priceUsage('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 100 })!.estimatedMicros,
    3000n,
  );
  for (const kind of ['moderation', 'nudge'] as const) {
    const request = modelRequest(kind, { setup: 'I challenged their shark to poker.' });
    const quote = quoteRequest(request);
    assert.ok(
      quote.reservedMicros >
        priceUsage(request.model, { input_tokens: 1000, output_tokens: 1024 })!.estimatedMicros,
    );
  }
});
test('cached buckets and Haiku long-context rates are counted without treating reads as free', () => {
  assert.equal(
    priceUsage('claude-sonnet-5-5', {
      input_tokens: 100,
      output_tokens: 20,
      cache_creation_input_tokens: 300,
      cache_read_input_tokens: 400,
      cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
    })!.estimatedMicros,
    1490n,
  );
  assert.equal(
    priceUsage('claude-haiku-5-5', { input_tokens: 100001, output_tokens: 10 })!.estimatedMicros,
    50026n,
  );
});
test('unknown prices, unsupported billing modifiers and invalid usage never become zero-cost success', () => {
  assert.throws(() => quoteRequest(modelRequest('nudge', {}, 'unknown-model')));
  assert.throws(() => quoteRequest(modelRequest('nudge', { draft: 'x'.repeat(17000) })));
  for (const usage of [
    null,
    {},
    { input_tokens: -1, output_tokens: 10 },
    { input_tokens: 10.5, output_tokens: 2 },
    { input_tokens: 10, output_tokens: NaN },
    { input_tokens: 10, output_tokens: 20, service_tier: 'fast' },
    { input_tokens: 10, output_tokens: 20, inference_geo: 'us' },
    { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 20 },
    { input_tokens: 10, output_tokens: 20, server_tool_use: { web_search_requests: 1 } },
  ])
    assert.equal(priceUsage('claude-sonnet-5-5', usage), null);
});
