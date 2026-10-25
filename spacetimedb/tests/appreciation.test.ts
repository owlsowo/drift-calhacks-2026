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
  A = player(71),
  B = player(72),
  C = player(73);
let h: ReturnType<typeof createModuleTestHarness<typeof db.schemaType>>;
const tx = (auth: typeof owner, fn: (ctx: any) => void) => h.withReducerTx(auth, fn);
const rounds = (auth: typeof owner) => module.my_round(h.viewContext(auth));
const thanks = (auth: typeof owner) => module.my_appreciation(h.viewContext(auth));
const send = (auth: typeof owner, cardId: string) =>
  tx(auth, (ctx) => module.thank_co_writer(ctx, { cardId }));
function beginning() {
  tx(A, (ctx) => module.start_round(ctx, {}));
  const round = rounds(A).find((r) => r.stage === 'write')!;
  expect(
    module.submit_setup(h.procedureContext(A), {
      roundId: round.id,
      requestId: crypto.randomUUID(),
      text: 'I taught the octopus insider trading.',
    }).ok,
  ).toBe(true);
  return rounds(A).find((r) => r.id === round.id)!.setupId;
}
function reply(auth: typeof owner, beginningId?: string) {
  tx(auth, (ctx) =>
    beginningId ? module.pick_up_beginning(ctx, { beginningId }) : module.start_catching(ctx, {}),
  );
  const round = rounds(auth).find((r) => r.stage === 'reply')!;
  expect(
    module.submit_reply(h.procedureContext(auth), {
      roundId: round.id,
      requestId: crypto.randomUUID(),
      text: 'Our lawyers would like another hand.',
    }).ok,
  ).toBe(true);
  return rounds(auth).find((r) => r.id === round.id)!.cardId;
}
const pair = () => reply(B, beginning());
beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  env.DRIFT_DEV_MODE = 'true';
  (globalThis as any).__driftTestEnv = env;
  h = createModuleTestHarness(db, module, {
    clock: new TestClock(new Timestamp(BigInt(Date.parse('2026-10-24T10:00:00Z')) * 1000n)),
    rngSeed: 98,
  });
  tx(owner, (ctx) => module.init(ctx, {}));
});
it('gives each original writer only their private sent and received receipt', () => {
  const cardId = pair();
  expect(thanks(A)).toEqual([{ cardId, sent: false, received: false }]);
  expect(thanks(B)).toEqual([{ cardId, sent: false, received: false }]);
  expect(thanks(C)).toEqual([]);
  expect(thanks(owner)).toEqual([]);
  send(A, cardId);
  expect(thanks(A)).toEqual([{ cardId, sent: true, received: false }]);
  expect(thanks(B)).toEqual([{ cardId, sent: false, received: true }]);
  send(B, cardId);
  expect(thanks(A)).toEqual([{ cardId, sent: true, received: true }]);
  expect(thanks(B)).toEqual([{ cardId, sent: true, received: true }]);
  expect(Object.keys(thanks(A)[0]).sort()).toEqual(['cardId', 'received', 'sent']);
});
it('deduplicates sends and preserves old action flags without analytics, quota or model work', () => {
  const cardId = pair();
  tx(A, (ctx) => module.record_card_action(ctx, { cardId, action: 'open' }));
  tx(B, (ctx) => module.record_card_action(ctx, { cardId, action: 'words_copied' }));
  const authorBefore = h.db.authorship.id.find(cardId)!;
  const unchanged = () => ({
    rounds: [...h.db.round.iter()],
    requests: [...h.db.request.iter()],
    budget: [...h.db.aiBudget.iter()],
    calls: [...h.db.aiCall.iter()],
    activity: [...h.db.activityDay.iter()],
    config: [...h.db.config.iter()],
    publicCards: [...h.db.postcard.iter()],
    publicBeginnings: [...h.db.beginning.iter()],
  });
  const before = unchanged();
  for (let i = 0; i < 3; i++) {
    send(A, cardId);
    send(B, cardId);
  }
  expect(h.db.authorship.id.find(cardId)).toEqual({
    ...authorBefore,
    setupActions: 1 | 32,
    replyActions: 4 | 32,
  });
  expect(unchanged()).toEqual(before);
  tx(A, (ctx) => module.record_card_action(ctx, { cardId, action: 'link_copied' }));
  expect(h.db.authorship.id.find(cardId)?.setupActions).toBe(1 | 16 | 32);
  expect(thanks(A)).toEqual([{ cardId, sent: true, received: true }]);
  expect(() =>
    tx(A, (ctx) => module.record_card_action(ctx, { cardId, action: 'thank_you' })),
  ).toThrow(/Unknown/);
});
it('keeps different replies and the original my_cards/public row shapes independent', () => {
  const beginningId = beginning(),
    first = reply(B, beginningId),
    second = reply(C, beginningId);
  const oldView = module.my_cards(h.viewContext(A));
  const oldPublic = [...h.db.postcard.iter()];
  send(B, first);
  expect(thanks(A)).toEqual([
    { cardId: first, sent: false, received: true },
    { cardId: second, sent: false, received: false },
  ]);
  expect(thanks(C)).toEqual([{ cardId: second, sent: false, received: false }]);
  expect(() => send(C, first)).toThrow(/two writers/);
  expect(module.my_cards(h.viewContext(A))).toEqual(oldView);
  expect(Object.keys(oldView[0]).sort()).toEqual(['hidden', 'id', 'role']);
  expect([...h.db.postcard.iter()]).toEqual(oldPublic);
});
it('denies outsiders, public-ID holders, the owner and missing cards', () => {
  const cardId = pair();
  for (const auth of [C, owner]) expect(() => send(auth, cardId)).toThrow(/two writers/);
  expect(() => send(A, 'missing')).toThrow(/two writers/);
  expect(thanks(A)).toEqual([{ cardId, sent: false, received: false }]);
});
it.each(['sample', 'team'])(
  'denies %s seed cards even with a forged setup owner',
  (starterKind) => {
    const cardId = reply(B);
    tx(owner, (ctx) => {
      const card = ctx.db.postcard.id.find(cardId)!;
      ctx.db.postcard.id.update({ ...card, starterKind });
      const authors = ctx.db.authorship.id.find(cardId)!;
      ctx.db.authorship.id.update({ ...authors, setupOwner: h.viewContext(A).sender });
    });
    expect(thanks(A)).toEqual([]);
    expect(thanks(B)).toEqual([]);
    expect(() => send(A, cardId)).toThrow(/two writers/);
    expect(() => send(B, cardId)).toThrow(/two writers/);
  },
);
it('denies legacy same-author and unowned pairs', () => {
  const cardId = pair();
  tx(owner, (ctx) => {
    const authors = ctx.db.authorship.id.find(cardId)!;
    ctx.db.authorship.id.update({ ...authors, setupOwner: authors.replyOwner });
  });
  expect(() => send(B, cardId)).toThrow(/two writers/);
  expect(thanks(B)).toEqual([]);
  tx(owner, (ctx) =>
    ctx.db.authorship.id.update({ ...ctx.db.authorship.id.find(cardId)!, setupOwner: undefined }),
  );
  expect(() => send(B, cardId)).toThrow(/two writers/);
  expect(thanks(B)).toEqual([]);
});
it('works during service pause and without a current writing pass', () => {
  const cardId = pair();
  env.DRIFT_TURNSTILE_SECRET = 'synthetic-test-secret';
  tx(owner, (ctx) => module.set_pause(ctx, { paused: true }));
  expect(() => send(A, cardId)).not.toThrow();
  expect(thanks(B)).toEqual([{ cardId, sent: false, received: true }]);
});
it.each(['hide', 'report', 'withdraw'] as const)(
  'removes receipts after %s and rejects further sends',
  (action) => {
    const cardId = pair();
    send(A, cardId);
    const beginningId = h.db.postcard.id.find(cardId)!.beginningId;
    tx(B, (ctx) => {
      if (action === 'hide') module.hide_my_card(ctx, { cardId });
      else if (action === 'report')
        module.report_content(ctx, { roundId: '', cardId, reason: 'other' });
    });
    if (action === 'withdraw')
      tx(A, (ctx) => module.withdraw_my_beginning(ctx, { bottleId: beginningId }));
    expect(thanks(A)).toEqual([]);
    expect(thanks(B)).toEqual([]);
    expect(() => send(B, cardId)).toThrow(/two writers/);
  },
);
it('an outsider report cannot suppress a private receipt for its coauthors', () => {
  const cardId = pair();
  send(A, cardId);
  tx(C, (ctx) => module.report_content(ctx, { roundId: '', cardId, reason: 'other' }));
  expect(thanks(C)).toEqual([]);
  expect(thanks(B)).toEqual([{ cardId, sent: false, received: true }]);
  expect(() => send(B, cardId)).not.toThrow();
});
it('refuses stale sends before cleanup and removes receipts with normal thirty-day retention', () => {
  const cardId = pair();
  send(A, cardId);
  h.clock.advance(TimeDuration.fromMillis(30 * 86400000 + 1));
  expect(() => send(B, cardId)).toThrow(/no longer available/);
  tx(owner, (ctx) => module.purge_old_data(ctx, {}));
  expect(h.db.authorship.id.find(cardId)).toBeNull();
  expect(h.db.postcard.id.find(cardId)).toBeNull();
  expect(thanks(A)).toEqual([]);
  expect(thanks(B)).toEqual([]);
});
