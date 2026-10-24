// USD estimates from first-party standard/global rates checked 2026-10-24.
// https://platform.claude.com/docs/en/about-claude/pricing
// Integer nanodollars/token avoid floating-point money arithmetic.
export const PRICE_VERSION = 'anthropic-standard-global-2026-10-24';
export const DEFAULT_BUDGET_MICROS = 10_000_000n;
export const MAX_BUDGET_MICROS = 50_000_000n;
export const MAX_REQUEST_BYTES = 16_384;
const prices: Record<string, { input: bigint; output: bigint; read: bigint }> = {
  'claude-haiku-5-5': { input: 100n, output: 500n, read: 10n },
  'claude-sonnet-5-5': { input: 2000n, output: 10000n, read: 100n },
};
const ceilMicros = (nano: bigint) => (nano + 999n) / 1000n;

export function quoteRequest(request: { model: string; max_tokens: number }) {
  const rate = prices[request.model];
  if (!rate) throw Error('The configured model needs a reviewed price entry.');
  const bytes = new TextEncoder().encode(JSON.stringify(request)).length;
  if (bytes > MAX_REQUEST_BYTES || request.max_tokens !== 1024)
    throw Error('The model request exceeds the reviewed budget bounds.');
  // Deliberately conservative headroom for tokenization and provider wrappers.
  // A price estimate is not an invoice guarantee; actual usage can exceed this hold.
  const inputCeiling = BigInt(bytes * 2 + 2048);
  return {
    requestBytes: bytes,
    reservedMicros: ceilMicros(inputCeiling * rate.input + 1024n * rate.output),
  };
}

function tokens(value: unknown, fallback?: number): number | null {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 0xffffffff
    ? value
    : null;
}

export function priceUsage(model: string, raw: unknown) {
  const rate = prices[model];
  if (!rate || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const usage = raw as Record<string, any>;
  for (const key of ['server_tool_use', 'cache_creation'])
    if (
      usage[key] !== undefined &&
      (!usage[key] || typeof usage[key] !== 'object' || Array.isArray(usage[key]))
    )
      return null;
  // We do not silently apply standard rates to a different tier/geography/speed.
  if (
    (usage.service_tier !== undefined && usage.service_tier !== 'standard') ||
    (usage.inference_geo !== undefined && usage.inference_geo !== 'global') ||
    (usage.speed !== undefined && usage.speed !== 'standard') ||
    Object.values(usage.server_tool_use ?? {}).some((count) => count !== 0)
  )
    return null;
  const input = tokens(usage.input_tokens),
    output = tokens(usage.output_tokens);
  const created = tokens(usage.cache_creation_input_tokens, 0);
  const read = tokens(usage.cache_read_input_tokens, 0);
  const five = tokens(usage.cache_creation?.ephemeral_5m_input_tokens, 0);
  const hour = tokens(usage.cache_creation?.ephemeral_1h_input_tokens, 0);
  if ([input, output, created, read, five, hour].some((n) => n === null)) return null;
  if (created !== five! + hour!) return null;
  const total = input! + created! + read!;
  if (total > 0xffffffff) return null;
  // Haiku's larger-context rate is 5x above 100k input tokens.
  const multiplier = model === 'claude-haiku-5-5' && total > 100_000 ? 5n : 1n;
  const nano =
    (BigInt(input!) * rate.input +
      BigInt(output!) * rate.output +
      (BigInt(five!) * rate.input * 5n) / 4n +
      BigInt(hour!) * rate.input * 2n +
      BigInt(read!) * rate.read) *
    multiplier;
  return { inputTokens: total, outputTokens: output!, estimatedMicros: ceilMicros(nano) };
}

export function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
