import { beforeEach, expect, it } from 'vitest';
import { ConnectionId, Timestamp, TimeDuration } from 'spacetimedb';
import { createModuleTestHarness, TestAuth, TestClock } from 'spacetimedb/server/test-utils';
import db, * as module from '../src/index';
const env: Record<string, string> = {};
const player = (id: number) =>
  TestAuth.fromJwtPayload(
    JSON.stringify({ iss: 'https://drift.test', sub: String(id), aud: ['drift'] }),
    new ConnectionId(BigInt(id)),
  );
const owner = TestAuth.internal(),
  A = player(41),
  B = player(42),
  C = player(43),
  D = player(44);
let h: ReturnType<typeof createModuleTestHarness<typeof db.schemaType>>;
const tx = (auth: typeof owner, fn: (ctx: any) => void) => h.withReducerTx(auth, fn);
const rounds = (auth: typeof owner) => module.my_round(h.viewContext(auth));
const held = (auth: typeof owner) => rounds(auth).find((r) => r.stage === 'reply')!;
const pick = (auth: typeof owner, id: string) =>
  tx(auth, (ctx) => module.pick_up_beginning(ctx, { beginningId: id }));
function beginning(auth = A, text = 'I taught the octopus insider trading.') {
  tx(auth, (ctx) => module.start_round(ctx, {}));
  const round = rounds(auth).find((r) => r.stage === 'write')!;
  expect(
    module.submit_setup(h.procedureContext(auth), {
      roundId: round.id,
      requestId: crypto.randomUUID(),
      text,
    }).ok,
  ).toBe(true);
  return rounds(auth).find((r) => r.id === round.id)!.setupId;
}
function reply(auth: typeof owner) {
  return module.submit_reply(h.procedureContext(auth), {
    roundId: held(auth).id,
    requestId: crypto.randomUUID(),
    text: 'Our lawyers would like another hand.',
  });
}
beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  env.DRIFT_DEV_MODE = 'true';
  (globalThis as any).__driftTestEnv = env;
  h = createModuleTestHarness(db, module, {
    clock: new TestClock(new Timestamp(BigInt(Date.parse('2026-10-24T10:00:00Z')) * 1000n)),
    rngSeed: 95,
  });
  tx(owner, (ctx) => module.init(ctx, {}));
});
it('selects the exact public beginning and lets independent writers each finish it', () => {
  const id = beginning();
  beginning(C, 'I challenged their shark to poker.');
  pick(B, id);
  pick(D, id);
  expect(module.my_assignment(h.viewContext(B))[0].id).toBe(id);
  expect(module.my_assignment(h.viewContext(D))[0].id).toBe(id);
  expect(reply(B).ok).toBe(true);
  expect(reply(D).ok).toBe(true);
  expect([...h.db.postcard.iter()].map((p) => p.beginningId)).toEqual([id, id]);
  expect(module.my_cards(h.viewContext(A))).toHaveLength(2);
  expect(rounds(B)).toHaveLength(1);
  expect(rounds(B)[0].stage).toBe('done');
});
it('resumes the same unexpired invitation without extending its lease, even across midnight', () => {
  h.clock.set(new Timestamp(BigInt(Date.parse('2026-10-24T23:58:00Z')) * 1000n));
  const id = beginning();
  pick(B, id);
  const original = { ...held(B) };
  h.clock.advance(TimeDuration.fromMillis(180000));
  pick(B, id);
  expect(held(B)).toEqual(original);
  expect(rounds(B)).toHaveLength(1);
  expect(() => pick(C, id)).toThrow(/earlier tide/);
  expect(rounds(C)).toHaveLength(0);
});
it('rejects self, missing, hidden and nonpublic beginnings before consuming a round', () => {
  const id = beginning();
  expect(() => pick(A, id)).toThrow(/your beginning/);
  expect(rounds(A)).toHaveLength(1);
  expect(() => pick(B, 'missing')).toThrow(/no longer available/);
  expect(rounds(B)).toHaveLength(0);
  tx(owner, (ctx) => ctx.db.beginning.id.delete(id));
  expect(() => pick(B, id)).toThrow(/no longer available/);
  expect(rounds(B)).toHaveLength(0);
});
it('preserves an independent write round and cannot overwrite another unexpired assignment', () => {
  const one = beginning(),
    two = beginning(C, 'I challenged their shark to poker.');
  tx(B, (ctx) => module.start_round(ctx, {}));
  const write = rounds(B)[0];
  pick(B, one);
  const assigned = { ...held(B) };
  expect(rounds(B).find((r) => r.id === write.id)).toEqual(write);
  expect(() => pick(B, two)).toThrow(/other bottle is still open/);
  expect(held(B)).toEqual(assigned);
  expect(rounds(B)).toHaveLength(2);
});
it('keeps skip exclusions across rounds and invalidates a reported invitation for other writers', () => {
  const one = beginning(),
    two = beginning(C, 'I challenged their shark to poker.');
  pick(B, one);
  const roundId = held(B).id;
  tx(B, (ctx) => module.skip_bottle(ctx, { roundId }));
  tx(B, (ctx) => module.abandon_round(ctx, { roundId }));
  expect(() => pick(B, one)).toThrow(/already passed/);
  expect(rounds(B)).toHaveLength(1);
  pick(B, two);
  const reportedRoundId = held(B).id;
  tx(B, (ctx) =>
    module.report_content(ctx, { roundId: reportedRoundId, cardId: '', reason: 'other' }),
  );
  expect(h.db.beginning.id.find(two)).toBeNull();
  expect(() => pick(D, two)).toThrow(/no longer available/);
  expect(rounds(D)).toHaveLength(0);
});
it('prevents a second ending after completion, including after the first postcard is hidden', () => {
  const id = beginning();
  pick(B, id);
  expect(reply(B).ok).toBe(true);
  const card = [...h.db.postcard.iter()][0];
  tx(B, (ctx) => module.hide_my_card(ctx, { cardId: card.id }));
  expect(() => pick(B, id)).toThrow(/already finished/);
  expect(rounds(B)).toHaveLength(1);
});
it('cannot bypass the three-round quota through invitation links', () => {
  const id = beginning();
  for (let i = 0; i < 3; i++) beginning(B);
  expect(() => pick(B, id)).toThrow(/today’s limit/);
  expect(rounds(B)).toHaveLength(3);
});
it('requires the existing shore check and pause controls without creating a round', () => {
  const id = beginning();
  env.DRIFT_TURNSTILE_SECRET = 'synthetic-test-secret';
  expect(() => pick(B, id)).toThrow(/shore check/);
  expect(rounds(B)).toHaveLength(0);
  delete env.DRIFT_TURNSTILE_SECRET;
  tx(owner, (ctx) => module.set_pause(ctx, { paused: true }));
  expect(() => pick(B, id)).toThrow(/short break/);
  expect(rounds(B)).toHaveLength(0);
});
it('cannot resume or replace an assignment while its model request is in flight', () => {
  const id = beginning();
  pick(B, id);
  const r = held(B);
  tx(owner, (ctx) =>
    ctx.db.round.id.update({
      ...ctx.db.round.id.find(r.id),
      inFlight: 'synthetic-held',
      busyUntil: Number(h.clock.now().microsSinceUnixEpoch / 1000n) + 1000,
    }),
  );
  expect(() => pick(B, id)).toThrow(/still being checked/);
  expect(rounds(B)).toHaveLength(1);
});
