import { beforeEach, expect, it } from 'vitest';
import { ConnectionId, Timestamp } from 'spacetimedb';
import { createModuleTestHarness, TestAuth, TestClock } from 'spacetimedb/server/test-utils';
import db, * as module from '../src/index';

const env: Record<string, string> = {};
const player = (id: number) =>
  TestAuth.fromJwtPayload(
    JSON.stringify({ iss: 'https://drift.test', sub: String(id), aud: ['drift'] }),
    new ConnectionId(BigInt(id)),
  );
const owner = TestAuth.internal(),
  A = player(61),
  B = player(62),
  C = player(63),
  D = player(64);
let h: ReturnType<typeof createModuleTestHarness<typeof db.schemaType>>;
const tx = (auth: typeof owner, fn: (ctx: any) => void) => h.withReducerTx(auth, fn);
const rounds = (auth: typeof owner) => module.my_round(h.viewContext(auth));
const held = (auth: typeof owner) => rounds(auth).find((r) => r.stage === 'reply')!;
const pick = (auth: typeof owner, id: string) =>
  tx(auth, (ctx) => module.pick_up_beginning(ctx, { beginningId: id }));
const withdraw = (auth: typeof owner, bottleId: string) =>
  tx(auth, (ctx) => module.withdraw_my_beginning(ctx, { bottleId }));
function beginning(auth = A) {
  tx(auth, (ctx) => module.start_round(ctx, {}));
  const round = rounds(auth).find((r) => r.stage === 'write')!;
  expect(
    module.submit_setup(h.procedureContext(auth), {
      roundId: round.id,
      requestId: crypto.randomUUID(),
      text: 'I taught the octopus insider trading.',
    }).ok,
  ).toBe(true);
  return rounds(auth).find((r) => r.id === round.id)!.setupId;
}
const reply = (auth: typeof owner) =>
  module.submit_reply(h.procedureContext(auth), {
    roundId: held(auth).id,
    requestId: crypto.randomUUID(),
    text: 'Our lawyers would like another hand.',
  });
const modelResponse = (data: object) => ({
  code: 200,
  headers: { entries: [] },
  version: { tag: 'Http11' as const },
  body: JSON.stringify({
    stop_reason: 'end_turn',
    usage: { input_tokens: 600, output_tokens: 20 },
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }),
});
beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  env.DRIFT_DEV_MODE = 'true';
  (globalThis as any).__driftTestEnv = env;
  h = createModuleTestHarness(db, module, {
    clock: new TestClock(new Timestamp(BigInt(Date.parse('2026-10-24T10:00:00Z')) * 1000n)),
    rngSeed: 97,
  });
  tx(owner, (ctx) => module.init(ctx, {}));
});
it('allows only the original author, not a recipient or another identity with the public ID', () => {
  const id = beginning();
  pick(B, id);
  expect(reply(B).ok).toBe(true);
  for (const outsider of [B, C, owner])
    expect(() => withdraw(outsider, id)).toThrow(/Only the writer/);
  expect(h.db.beginning.id.find(id)).toBeTruthy();
  expect([...h.db.postcard.beginningId.filter(id)]).toHaveLength(1);
  withdraw(A, id);
  expect(h.db.beginning.id.find(id)).toBeNull();
  expect([...h.db.postcard.beginningId.filter(id)]).toHaveLength(0);
});
it('atomically removes all linked public pairs, private return cues and hello records', () => {
  const id = beginning();
  for (const writer of [B, C]) {
    pick(writer, id);
    expect(reply(writer).ok).toBe(true);
  }
  const cards = [...h.db.postcard.beginningId.filter(id)];
  tx(owner, (ctx) => {
    for (const card of cards)
      ctx.db.hello.insert({
        cardId: card.id,
        setupAccepted: true,
        replyAccepted: true,
        phrase: 'synthetic phrase',
        expiresMs: card.createdMs + 600000,
      });
  });
  expect(module.my_unopened_returns(h.viewContext(A))).toHaveLength(2);
  withdraw(A, id);
  expect(h.db.bottle.id.find(id)?.hidden).toBe(true);
  expect(module.my_outgoing(h.viewContext(A))).toHaveLength(0);
  expect(module.my_unopened_returns(h.viewContext(A))).toHaveLength(0);
  expect(module.my_hello(h.viewContext(A))).toHaveLength(0);
  for (const card of cards) {
    expect(h.db.postcard.id.find(card.id)).toBeNull();
    expect(h.db.authorship.id.find(card.id)?.hidden).toBe(true);
    expect(h.db.hello.cardId.find(card.id)).toBeNull();
  }
  for (const writer of [B, C]) expect(module.my_cards(h.viewContext(writer))[0].hidden).toBe(true);
});
it('is idempotent for its author while retaining history, quota and unrelated work', () => {
  const id = beginning(),
    other = beginning(C);
  pick(B, other);
  expect(reply(B).ok).toBe(true);
  const untouchedCard = [...h.db.postcard.beginningId.filter(other)][0];
  tx(A, (ctx) => module.start_round(ctx, {}));
  const originalRounds = rounds(A);
  withdraw(A, id);
  withdraw(A, id);
  expect(rounds(A)).toEqual(originalRounds);
  expect(h.db.beginning.id.find(other)).toBeTruthy();
  expect(h.db.postcard.id.find(untouchedCard.id)).toEqual(untouchedCard);
  expect(() => withdraw(B, id)).toThrow(/Only the writer/);
});
it('does not require a writing pass or an open service to withdraw', () => {
  const id = beginning();
  env.DRIFT_TURNSTILE_SECRET = 'synthetic-test-secret';
  tx(owner, (ctx) => module.set_pause(ctx, { paused: true }));
  expect(() => withdraw(A, id)).not.toThrow();
  expect(h.db.beginning.id.find(id)).toBeNull();
});
it('revokes existing assignments and rejects future pickups without spending another turn', () => {
  const id = beginning();
  pick(B, id);
  const originalRound = held(B);
  withdraw(A, id);
  expect(module.my_assignment(h.viewContext(B))).toHaveLength(0);
  expect(reply(B)).toMatchObject({ ok: false, message: expect.stringMatching(/drifted on/) });
  expect(held(B)).toEqual(originalRound);
  expect(() => pick(D, id)).toThrow(/no longer available/);
  expect(rounds(D)).toHaveLength(0);
  expect([...h.db.request.iter()].filter((r) => r.operation === 'reply')).toHaveLength(0);
});
it.each(['reply', 'nudge'] as const)(
  'withholds an in-flight %s after withdrawal, and its replay cannot dispatch or republish',
  (operation) => {
    const id = beginning();
    pick(B, id);
    const roundId = held(B).id;
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    let calls = 0;
    const ctx = h
      .procedureContextBuilder(B)
      .http(() => {
        calls++;
        withdraw(A, id);
        return modelResponse(
          operation === 'reply'
            ? { decision: 'allow', reason: 'safe' }
            : { kind: 'nudge', hint: 'Try a surprising everyday consequence for the octopus.' },
        );
      })
      .build();
    const args = {
      roundId,
      requestId: crypto.randomUUID(),
      text: operation === 'reply' ? 'Our lawyers would like another hand.' : '',
    };
    const run = () =>
      operation === 'reply' ? module.submit_reply(ctx, args) : module.request_nudge(ctx, args);
    expect(run()).toMatchObject({ ok: false, message: expect.stringMatching(/drifted on/) });
    expect(run()).toMatchObject({ ok: false, message: expect.stringMatching(/drifted on/) });
    expect(calls).toBe(1);
    expect(held(B).inFlight).toBe('');
    expect(held(B).hint).toBe('');
    expect(h.db.beginning.id.find(id)).toBeNull();
    expect([...h.db.postcard.beginningId.filter(id)]).toHaveLength(0);
    const receipt = [...h.db.request.iter()].find((r) => r.roundId === roundId)!;
    expect(receipt.text).toBe(args.text);
    expect(JSON.parse(receipt.result).ok).toBe(false);
  },
);
it('rejects missing IDs and unowned sample bottles without changing public inventory', () => {
  expect(() => withdraw(A, 'missing')).toThrow(/Only the writer/);
  tx(B, (ctx) => module.start_catching(ctx, {}));
  const sample = module.my_assignment(h.viewContext(B))[0];
  expect(sample.seeded).toBe(true);
  expect(() => withdraw(B, sample.id)).toThrow(/Only the writer/);
  expect(h.db.beginning.id.find(sample.id)).toBeTruthy();
});
