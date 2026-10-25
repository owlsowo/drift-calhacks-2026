import { beforeEach, expect, it } from 'vitest';
import { ConnectionId, Timestamp } from 'spacetimedb';
import { createModuleTestHarness, TestAuth, TestClock } from 'spacetimedb/server/test-utils';
import db, * as module from '../src/index';
const env: Record<string, string> = { DRIFT_DEV_MODE: 'true' };
const owner = TestAuth.internal();
const player = (id: number) =>
  TestAuth.fromJwtPayload(
    JSON.stringify({ iss: 'https://migration.test', sub: String(id), aud: ['drift'] }),
    new ConnectionId(BigInt(id)),
  );
const A = player(21),
  B = player(22);
let h: ReturnType<typeof createModuleTestHarness<typeof db.schemaType>>;
const tx = (auth: typeof owner, fn: (ctx: any) => void) => h.withReducerTx(auth, fn);
const upgrade = (auth = owner) => module.admin_upgrade_letters(h.procedureContext(auth));
const pause = () => tx(owner, (ctx) => module.set_pause(ctx, { paused: true }));
beforeEach(() => {
  (globalThis as any).__driftTestEnv = env;
  h = createModuleTestHarness(db, module, {
    clock: new TestClock(new Timestamp(BigInt(Date.parse('2026-10-24T10:00:00Z')) * 1000n)),
    rngSeed: 81,
  });
  tx(owner, (ctx) => module.init(ctx, {}));
});
function pair() {
  tx(A, (ctx) => module.start_round(ctx, {}));
  const a = module.my_round(h.viewContext(A))[0];
  expect(
    module.submit_setup(h.procedureContext(A), {
      roundId: a.id,
      requestId: crypto.randomUUID(),
      text: 'I challenged their shark to poker.',
    }).ok,
  ).toBe(true);
  tx(B, (ctx) => module.start_catching(ctx, {}));
  const b = module.my_round(h.viewContext(B))[0];
  expect(
    module.submit_reply(h.procedureContext(B), {
      roundId: b.id,
      requestId: crypto.randomUUID(),
      text: 'Our lawyers would like another hand.',
    }).ok,
  ).toBe(true);
  const card = [...h.db.postcard.iter()][0];
  return {
    a: h.db.round.id.find(a.id)!,
    b: h.db.round.id.find(b.id)!,
    card,
    bottle: h.db.bottle.id.find(card.beginningId)!,
  };
}
it('requires the owner and a paused tide, then records an idempotent empty upgrade', () => {
  expect(() => upgrade(A)).toThrow(/Only the project owner/);
  expect(() => upgrade()).toThrow(/paused/);
  expect([...h.db.schemaMigration.iter()]).toHaveLength(0);
  pause();
  expect(upgrade()).toMatchObject({ alreadyApplied: false, beginnings: 0, pairs: 0, rounds: 0 });
  expect(upgrade()).toMatchObject({ alreadyApplied: true, beginnings: 0, pairs: 0, rounds: 0 });
});
it('backfills legacy IDs without replacing words, ownership, requests, quota or action flags', () => {
  const { a, b, card, bottle } = pair();
  tx(owner, (ctx) => {
    ctx.db.beginning.id.delete(bottle.id);
    ctx.db.bottle.id.update({
      ...bottle,
      createdMs: 0,
      claimRound: b.id,
      claimUntil: b.leaseMs,
      claimVersion: b.version,
    });
    ctx.db.postcard.id.update({ ...card, beginningId: '' });
    const authors = ctx.db.authorship.id.find(card.id)!;
    ctx.db.authorship.id.update({ ...authors, beginningId: '', setupActions: 1, replyActions: 4 });
    ctx.db.round.id.update({ ...a, stage: 'catch' });
    ctx.db.round.id.update({ ...b, stage: 'write' });
  });
  const requests = [...h.db.request.iter()];
  pause();
  expect(upgrade()).toMatchObject({
    alreadyApplied: false,
    beginnings: 1,
    pairs: 1,
    rounds: 1,
    orphanPairs: 0,
  });
  expect(h.db.postcard.id.find(card.id)).toEqual({ ...card, beginningId: bottle.id });
  expect(h.db.authorship.id.find(card.id)).toMatchObject({
    beginningId: bottle.id,
    setupOwner: a.owner,
    replyOwner: b.owner,
    setupActions: 1,
    replyActions: 4,
  });
  expect(h.db.round.id.find(a.id)).toEqual({ ...a, stage: 'done' });
  expect(h.db.round.id.find(b.id)).toEqual({ ...b, stage: 'write' });
  expect([...h.db.round.iter()]).toHaveLength(2);
  expect([...h.db.request.iter()]).toEqual(requests);
  expect(h.db.bottle.id.find(bottle.id)?.createdMs).toBe(bottle.day * 86400000);
  expect(upgrade().alreadyApplied).toBe(true);
  expect([...h.db.postcard.iter()]).toHaveLength(1);
});
it('does not revive a hidden beginning or hidden pair', () => {
  const { card, bottle } = pair();
  tx(owner, (ctx) => module.retire_bottle(ctx, { bottleId: bottle.id }));
  tx(owner, (ctx) =>
    ctx.db.bottle.id.update({ ...ctx.db.bottle.id.find(bottle.id)!, createdMs: 0 }),
  );
  pause();
  upgrade();
  expect(h.db.beginning.id.find(bottle.id)).toBeNull();
  expect(h.db.postcard.id.find(card.id)).toBeNull();
  expect(h.db.authorship.id.find(card.id)?.hidden).toBe(true);
});
it('recovers only approved public text when an older private bottle has already expired', () => {
  const { card, bottle } = pair();
  tx(owner, (ctx) => {
    ctx.db.beginning.id.delete(bottle.id);
    ctx.db.bottle.id.delete(bottle.id);
    ctx.db.postcard.id.update({ ...card, beginningId: '' });
    ctx.db.authorship.id.update({ ...ctx.db.authorship.id.find(card.id)!, beginningId: '' });
  });
  pause();
  expect(upgrade()).toMatchObject({ beginnings: 1, pairs: 1, orphanPairs: 1 });
  expect(h.db.bottle.id.find(bottle.id)).toBeNull();
  expect(h.db.beginning.id.find(bottle.id)).toMatchObject({
    id: bottle.id,
    text: card.setup,
    promptId: card.promptId,
  });
  expect(h.db.authorship.id.find(card.id)?.beginningId).toBe(bottle.id);
  expect(h.db.postcard.id.find(card.id)?.reply).toBe(card.reply);
});
it('waits for reserved in-flight work without making partial migration changes', () => {
  tx(A, (ctx) => module.start_round(ctx, {}));
  const round = module.my_round(h.viewContext(A))[0];
  tx(owner, (ctx) =>
    ctx.db.round.id.update({
      ...round,
      inFlight: 'pending-fixture',
      busyUntil: round.day * 86400000 + 24 * 3600000,
    }),
  );
  pause();
  expect(() => upgrade()).toThrow(/still being checked/);
  expect([...h.db.schemaMigration.iter()]).toHaveLength(0);
  expect(h.db.round.id.find(round.id)?.inFlight).toBe('pending-fixture');
});
