import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectionId, Timestamp, TimeDuration } from 'spacetimedb';
import {
  createModuleTestHarness,
  TestAuth,
  TestClock,
  type TestHttpResponder,
} from 'spacetimedb/server/test-utils';
import db, * as module from '../src/index';
const env: Record<string, string> = { DRIFT_DEV_MODE: 'true' };
(globalThis as any).__driftTestEnv = env;
const auth = (id: number) =>
  TestAuth.fromJwtPayload(
    JSON.stringify({ iss: 'https://drift.test', sub: String(id), aud: ['drift'] }),
    new ConnectionId(BigInt(id)),
  );
const owner = TestAuth.internal(),
  A = auth(1),
  B = auth(2),
  C = auth(3);
let h: ReturnType<typeof createModuleTestHarness<typeof db.schemaType>>;
const clock = () =>
  new TestClock(new Timestamp(BigInt(Date.parse('2026-10-24T10:00:00Z')) * 1000n));
const tx = (a: any, fn: (ctx: any) => void) => h.withReducerTx(a, fn);
const view = (a: any) => module.my_round(h.viewContext(a));
const active = (a: any) => view(a).find((r) => r.stage !== 'done')!;
const start = (a: any) => {
  tx(a, (c) => module.start_round(c, {}));
  return active(a);
};
const setup = (a: any, text = 'I taught the octopus insider trading.') =>
  module.submit_setup(h.procedureContext(a), {
    roundId: active(a).id,
    requestId: crypto.randomUUID(),
    text,
  });
const catchBottle = (a: any) => {
  const roundId = active(a).id;
  return tx(a, (c) => module.claim_bottle(c, { roundId }));
};
const skip = (a: any) => {
  const roundId = active(a).id;
  return tx(a, (c) => module.skip_bottle(c, { roundId }));
};
const report = (a: any) => {
  const roundId = active(a).id;
  return tx(a, (c) => module.report_content(c, { roundId, cardId: '', reason: 'other' }));
};
const claim = (a: any) => module.my_assignment(h.viewContext(a))[0];
const reply = (
  a: any,
  id = crypto.randomUUID(),
  text = 'Your account has been permanently frozen.',
) =>
  module.submit_reply(h.procedureContext(a), {
    roundId: (active(a) || view(a).at(-1)!).id,
    requestId: id,
    text,
  });
const modelResponse = (data: object, stopReason = 'end_turn') => ({
  code: 200,
  headers: { entries: [] },
  version: { tag: 'Http11' as const },
  body: JSON.stringify({
    stop_reason: stopReason,
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }),
});
const modelCtx = (a: any, responder: TestHttpResponder<typeof db.schemaType>) =>
  h.procedureContextBuilder(a).http(responder).build();
const pricedResponse = (data: object, usage: object = { input_tokens: 513, output_tokens: 19 }) => {
  const response = modelResponse(data);
  response.body = JSON.stringify({ ...JSON.parse(response.body), usage });
  return response;
};
beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  env.DRIFT_DEV_MODE = 'true';
  h = createModuleTestHarness(db, module, { clock: clock(), rngSeed: 71 });
  tx(owner, (c) => module.init(c, {}));
});
describe('authoritative game state', () => {
  it('server IDs remain unique when reducer UUID entropy collides', () => {
    const collided = { toString: () => '00000000-0000-4000-8000-000000000000' };
    const collisionContext = (ctx: any) =>
      new Proxy(
        {},
        {
          get: (_target, key) =>
            key === 'newUuidV4' ? () => collided : Reflect.get(ctx, key, ctx),
        },
      ) as any;
    for (const writer of [A, B, C])
      tx(writer, (c) => {
        module.start_round(collisionContext(c), {});
      });
    expect(new Set([...h.db.round.iter()].map((r) => r.id)).size).toBe(3);
    const original = active(A).id;
    tx(A, (c) => {
      module.abandon_round(c, { roundId: original });
      module.start_round(collisionContext(c), {});
    });
    expect(active(A).id).not.toBe(original);
    expect([...h.db.round.iter()]).toHaveLength(4);
  });
  it('only the owner can retire an unpublished bottle and revoke an in-progress claim', () => {
    start(A);
    setup(A);
    const bottleId = active(A).setupId;
    tx(B, (c) => module.start_catching(c, {}));
    expect(() => tx(C, (c) => module.retire_bottle(c, { bottleId }))).toThrow(/owner/);
    tx(owner, (c) => module.retire_bottle(c, { bottleId }));
    expect(module.my_outgoing(h.viewContext(A))).toHaveLength(0);
    expect(claim(B)).toBeUndefined();
    expect(reply(B).ok).toBe(false);
    expect([...h.db.postcard.iter()]).toHaveLength(0);
  });
  it('catch-first gives a real postcard before inviting the same round to toss a beginning', () => {
    start(B);
    setup(B);
    tx(A, (c) => module.start_catching(c, {}));
    expect(active(A).stage).toBe('reply');
    expect(active(A).setupId).toBe('');
    const assignment = claim(A).id;
    tx(A, (c) => module.start_catching(c, {}));
    expect(claim(A).id).toBe(assignment);
    expect(reply(A).ok).toBe(true);
    expect(active(A).stage).toBe('write');
    expect(active(A).cardId).toBeTruthy();
    expect(module.my_cards(h.viewContext(B))).toHaveLength(1);
    expect(setup(A, 'I challenged their shark to poker.').ok).toBe(true);
    expect(view(A)).toHaveLength(1);
    expect(active(A)).toBeUndefined();
    expect(module.my_outgoing(h.viewContext(A))).toHaveLength(1);
  });
  it('catch-first empty production pool consumes no round and leaves write-first available', () => {
    env.DRIFT_DEV_MODE = 'false';
    expect(() => tx(A, (c) => module.start_catching(c, {}))).toThrow(/No bottles/);
    expect(view(A)).toHaveLength(0);
    start(A);
    expect(active(A).stage).toBe('write');
  });
  it('a catch-first writer can keep the result and skip tossing without losing the postcard', () => {
    tx(A, (c) => module.start_catching(c, {}));
    reply(A);
    const id = active(A).cardId;
    const roundId = active(A).id;
    tx(A, (c) => module.abandon_round(c, { roundId }));
    expect(active(A)).toBeUndefined();
    expect(h.db.postcard.id.find(id)).toBeTruthy();
    expect(module.my_cards(h.viewContext(A))).toHaveLength(1);
  });
  it('verifies Turnstile on the server, scopes passes to one identity and expires them', () => {
    env.DRIFT_TURNSTILE_SECRET = 'synthetic-server-secret';
    env.DRIFT_TURNSTILE_HOSTNAME = 'drift.test';
    expect(() => start(A)).toThrow(/shore check/);
    const answer = (data: object) => () => ({
      code: 200,
      headers: { entries: [] },
      version: { tag: 'Http11' as const },
      body: JSON.stringify(data),
    });
    expect(
      module.verify_shore(modelCtx(A, answer({ success: false })), { token: 'forged' }).ok,
    ).toBe(false);
    expect(
      module.verify_shore(
        modelCtx(A, answer({ success: true, hostname: 'wrong.test', action: 'drift' })),
        { token: 'wrong-host' },
      ).ok,
    ).toBe(false);
    expect(
      module.verify_shore(
        modelCtx(A, answer({ success: true, hostname: 'drift.test', action: 'other' })),
        { token: 'wrong-action' },
      ).ok,
    ).toBe(false);
    expect(
      module.verify_shore(
        modelCtx(A, answer({ success: true, hostname: 'drift.test', action: 'drift' })),
        { token: 'valid' },
      ).ok,
    ).toBe(true);
    expect(() => start(A)).not.toThrow();
    expect(() => start(B)).toThrow(/shore check/);
    expect(module.verify_shore(h.procedureContext(A), { token: '' }).ok).toBe(true);
    h.clock.advance(TimeDuration.fromMillis(3600001));
    expect(() => setup(A)).not.toThrow();
    expect(setup(A).ok).toBe(false);
    expect([...h.db.request.iter()]).toHaveLength(0);
  });
  it('installs one hourly schedule and purges hidden-card identity mappings', () => {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    reply(B);
    const card = [...h.db.postcard.iter()][0];
    tx(A, (c) => module.hide_my_card(c, { cardId: card.id }));
    expect([...h.db.authorship.iter()]).toHaveLength(1);
    tx(owner, (c) => module.purge_old_data(c, {}));
    expect([...h.db.authorship.iter()]).toHaveLength(0);
    tx(A, (c) => module.refresh_day(c, {}));
    expect([...h.db.maintenance.iter()]).toHaveLength(1);
    expect(() => tx(C, (c) => module.purge_old_data(c, {}))).toThrow(/owner/);
  });
  it('scheduled maintenance removes expired private text and public postcards', () => {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    reply(B);
    h.clock.advance(TimeDuration.fromMillis(31 * 86400000));
    const arg = [...h.db.maintenance.iter()][0];
    tx(owner, (c) => module.maintenance_tick(c, { arg }));
    expect([...h.db.request.iter()]).toHaveLength(0);
    expect([...h.db.bottle.iter()]).toHaveLength(0);
    expect([...h.db.round.iter()]).toHaveLength(0);
    expect([...h.db.postcard.iter()]).toHaveLength(0);
    expect([...h.db.authorship.iter()]).toHaveLength(0);
  });
  it('resumes the same round, keeps private views scoped, and excludes self assignment', () => {
    start(A);
    start(A);
    expect(view(A)).toHaveLength(1);
    expect(view(B)).toHaveLength(0);
    expect(setup(A).ok).toBe(true);
    catchBottle(A);
    expect(claim(A).seeded).toBe(true);
    expect(claim(B)).toBeUndefined();
    const aid = active(A).id;
    expect(() => tx(B, (c) => module.claim_bottle(c, { roundId: aid }))).toThrow(/another writer/);
  });
  it('two claimants cannot hold the same bottle', () => {
    for (const a of [A, B, C]) {
      start(a);
      setup(a);
    }
    catchBottle(A);
    catchBottle(B);
    const a = claim(A),
      b = claim(B);
    expect(a.id).not.toBe(b.id);
    expect(a.text).toBeTruthy();
    expect(b.text).toBeTruthy();
  });
  it('publishes a single card and returns it only to its real authors', () => {
    start(A);
    setup(A);
    start(B);
    setup(B, 'I challenged their shark to poker.');
    catchBottle(B);
    const id = crypto.randomUUID();
    expect(reply(B, id).ok).toBe(true);
    expect(reply(B, id).ok).toBe(true);
    expect([...h.db.postcard.iter()]).toHaveLength(1);
    expect(module.my_cards(h.viewContext(A))).toHaveLength(1);
    expect(module.my_cards(h.viewContext(B))).toHaveLength(1);
    expect(module.my_cards(h.viewContext(C))).toHaveLength(0);
  });
  it('rejects changed content with a reused request id', () => {
    start(A);
    const id = crypto.randomUUID();
    const args = {
      roundId: active(A).id,
      requestId: id,
      text: 'I taught the octopus insider trading.',
    };
    expect(module.submit_setup(h.procedureContext(A), args).ok).toBe(true);
    expect(
      module.submit_setup(h.procedureContext(A), {
        ...args,
        text: 'I challenged their shark to poker.',
      }),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/different text/) });
  });
  it('withholds an expired claim and never renews it across reset', () => {
    h.clock.set(new Timestamp(BigInt(Date.parse('2026-10-24T23:58:00Z')) * 1000n));
    start(A);
    setup(A);
    catchBottle(A);
    const deadline = claim(A).leaseMs;
    h.clock.advance(TimeDuration.fromMillis(180000));
    tx(A, (c) => module.start_round(c, {}));
    expect(claim(A).leaseMs).toBe(deadline);
    h.clock.advance(TimeDuration.fromMillis(8 * 60000));
    expect(reply(A)).toMatchObject({ ok: false, message: expect.stringMatching(/drifted on/) });
    expect([...h.db.postcard.iter()]).toHaveLength(0);
  });
  it('reassigns an expired bottle without retaining the old writer’s private assignment', () => {
    start(B);
    setup(B);
    tx(A, (c) => module.start_catching(c, {}));
    const id = claim(A).id;
    h.clock.advance(TimeDuration.fromMillis(10 * 60000 + 1));
    tx(C, (c) => module.start_catching(c, {}));
    expect(claim(C).id).toBe(id);
    expect(claim(A)).toBeUndefined();
    expect(reply(A)).toMatchObject({ ok: false });
    expect([...h.db.postcard.iter()]).toHaveLength(0);
  });
  it('enforces one skip, keeps exclusions, and gives reporting a free release', () => {
    start(A);
    setup(A);
    catchBottle(A);
    const first = claim(A).id;
    skip(A);
    catchBottle(A);
    expect(claim(A).id).not.toBe(first);
    expect(() => skip(A)).toThrow(/used your skip/);
    report(A);
    expect(active(A).skips).toBe(1);
    expect(active(A).stage).toBe('catch');
  });
  it('restricts hide and pause to authorized callers', () => {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    reply(B);
    const card = [...h.db.postcard.iter()][0];
    expect(() => tx(C, (c) => module.hide_my_card(c, { cardId: card.id }))).toThrow(/two authors/);
    expect(() => tx(C, (c) => module.set_pause(c, { paused: true }))).toThrow(/project owner/);
    tx(A, (c) => module.hide_my_card(c, { cardId: card.id }));
    expect([...h.db.postcard.iter()]).toHaveLength(0);
    expect(module.my_cards(h.viewContext(B))[0].hidden).toBe(true);
  });
  it('enforces three rounds per day and a global dispatch cap', () => {
    for (let i = 0; i < 3; i++) {
      start(A);
      setup(A);
      catchBottle(A);
      reply(A);
    }
    expect(() => start(A)).toThrow(/Three little stories/);
    tx(owner, (c) => {
      const cfg = c.db.config.id.find(0)!;
      c.db.config.id.update({ ...cfg, dispatchCap: cfg.dispatches });
    });
    start(B);
    expect(setup(B)).toMatchObject({ ok: false, message: expect.stringMatching(/allowance/) });
  });
});
describe('two-phase model boundary', () => {
  it('checks the actual combined setup and reply before publication', () => {
    start(A);
    setup(A);
    start(B);
    setup(B, 'I challenged their shark to poker.');
    catchBottle(B);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const roundId = active(B).id;
    let dispatches = 0;
    const ctx = modelCtx(B, (_test, req, body) => {
      dispatches++;
      expect(req.uri).toBe('https://api.anthropic.com/v1/messages');
      const input = JSON.parse(new TextDecoder().decode(body));
      expect(input.model).toBe('claude-haiku-5-5');
      const user = JSON.parse(input.messages[0].content);
      expect(user.setup).toBe('I taught the octopus insider trading.');
      expect(user.reply).toBe('Your account has been permanently frozen.');
      return modelResponse({ decision: 'allow', reason: 'safe' });
    });
    const args = {
      roundId,
      requestId: crypto.randomUUID(),
      text: 'Your account has been permanently frozen.',
    };
    expect(module.submit_reply(ctx, args).ok).toBe(true);
    expect(module.submit_reply(ctx, args).ok).toBe(true);
    expect(dispatches).toBe(1);
    expect([...h.db.postcard.iter()]).toHaveLength(1);
  });
  it.each(['refusal', 'max_tokens'])('withholds %s responses and preserves the round', (stop) => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const ctx = modelCtx(A, () => modelResponse({ decision: 'allow', reason: 'safe' }, stop));
    expect(
      module.submit_setup(ctx, {
        roundId: active(A).id,
        requestId: crypto.randomUUID(),
        text: 'I taught the octopus insider trading.',
      }).ok,
    ).toBe(false);
    expect(active(A).stage).toBe('write');
    expect([...h.db.bottle.iter()]).toHaveLength(0);
    expect(active(A).inFlight).toBe('');
  });
  it.each([
    { decision: 'allow', reason: 'abuse' },
    { decision: 'allow', reason: 'safe', extra: 'unexpected' },
    { decision: 'allow' },
    { decision: 'unknown', reason: 'safe' },
  ])('withholds malformed or contradictory moderation %j', (bad) => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const ctx = modelCtx(A, () => modelResponse(bad));
    expect(
      module.submit_setup(ctx, {
        roundId: active(A).id,
        requestId: crypto.randomUUID(),
        text: 'I taught the octopus insider trading.',
      }).ok,
    ).toBe(false);
    expect([...h.db.bottle.iter()]).toHaveLength(0);
  });
  it('does not apply a late answer after reporting cancels the assignment', () => {
    start(A);
    setup(A);
    catchBottle(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const roundId = active(A).id;
    const ctx = modelCtx(A, () => {
      tx(A, (c) => module.report_content(c, { roundId, cardId: '', reason: 'other' }));
      return modelResponse({ decision: 'allow', reason: 'safe' });
    });
    expect(
      module.submit_reply(ctx, {
        roundId,
        requestId: crypto.randomUUID(),
        text: 'Your account has been permanently frozen.',
      }).ok,
    ).toBe(false);
    expect(active(A).stage).toBe('catch');
    expect([...h.db.postcard.iter()]).toHaveLength(0);
  });
  it('rechecks deadlines after an external call', () => {
    start(A);
    setup(A);
    catchBottle(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const roundId = active(A).id;
    const ctx = modelCtx(A, () => {
      h.clock.advance(TimeDuration.fromMillis(11 * 60000));
      return modelResponse({ decision: 'allow', reason: 'safe' });
    });
    expect(
      module.submit_reply(ctx, {
        roundId,
        requestId: crypto.randomUUID(),
        text: 'Your account has been permanently frozen.',
      }).ok,
    ).toBe(false);
    expect([...h.db.postcard.iter()]).toHaveLength(0);
  });
  it('honors an emergency pause that occurs during a call', () => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const ctx = modelCtx(A, () => {
      tx(owner, (c) => module.set_pause(c, { paused: true }));
      return modelResponse({ decision: 'allow', reason: 'safe' });
    });
    expect(
      module.submit_setup(ctx, {
        roundId: active(A).id,
        requestId: crypto.randomUUID(),
        text: 'I taught the octopus insider trading.',
      }).ok,
    ).toBe(false);
    expect([...h.db.bottle.iter()]).toHaveLength(0);
  });
  it('grounds nudges in the assignment and private draft without publishing', () => {
    start(A);
    setup(A);
    catchBottle(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const roundId = active(A).id;
    const assigned = claim(A).text;
    const ctx = modelCtx(A, (_test, _req, body) => {
      const payload = JSON.parse(new TextDecoder().decode(body));
      expect(payload.model).toBe('claude-sonnet-5-5');
      const input = JSON.parse(payload.messages[0].content);
      expect(input.setup).toBe(assigned);
      expect(input.draft).toBe('Our lawyers');
      return modelResponse({
        kind: 'nudge',
        hint: 'Consider how the shark might take a poker rule literally.',
      });
    });
    const value = module.request_nudge(ctx, {
      roundId,
      requestId: crypto.randomUUID(),
      text: 'Our lawyers',
    });
    expect(value.ok).toBe(true);
    expect(value.hint).toContain('Consider');
    expect([...h.db.postcard.iter()]).toHaveLength(0);
    expect(active(A).nudges).toBe(1);
  });
  it('rejects an answer-writing nudge and charges its dispatched attempt', () => {
    start(A);
    setup(A);
    catchBottle(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const ctx = modelCtx(A, () =>
      modelResponse({ kind: 'nudge', hint: 'Our lawyers would like another hand.' }),
    );
    expect(
      module.request_nudge(ctx, { roundId: active(A).id, requestId: crypto.randomUUID(), text: '' })
        .ok,
    ).toBe(false);
    expect(active(A).hint).toBe('');
    expect(active(A).nudges).toBe(1);
  });
});
describe('private mutual hello', () => {
  function enableHello() {
    env.DRIFT_HELLO_ENABLED = 'true';
    env.DRIFT_MEETING_SPOT_VERIFIED = 'true';
    env.DRIFT_MEETING_SPOT = 'Synthetic test meeting point';
  }
  function makeCard() {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    reply(B);
    return [...h.db.postcard.iter()][0].id;
  }
  function intent(a: any, cardId: string, accepted: boolean) {
    tx(a, (ctx) => module.set_hello_intent(ctx, { cardId, accepted }));
  }
  const details = (a: any, cardId: string) => module.get_hello(h.procedureContext(a), { cardId });
  it('stays disabled without a verified meeting point', () => {
    const cardId = makeCard();
    env.DRIFT_HELLO_ENABLED = 'true';
    env.DRIFT_MEETING_SPOT = 'Synthetic test meeting point';
    expect(() => intent(A, cardId, true)).toThrow(/not available/);
  });
  it('keeps one-sided choices and recognition words private', () => {
    enableHello();
    const cardId = makeCard();
    intent(A, cardId, true);
    expect(details(A, cardId)).toMatchObject({ mutual: false, phrase: '', spot: '' });
    expect(details(B, cardId)).toMatchObject({ mutual: false, phrase: '', spot: '' });
    expect(module.my_hello(h.viewContext(B))[0]).toMatchObject({ optedIn: false, mutual: false });
    expect(Object.keys(module.my_hello(h.viewContext(A))[0])).not.toContain('phrase');
    expect(() => details(C, cardId)).toThrow(/two writers/);
    expect(() => intent(C, cardId, true)).toThrow(/two writers/);
  });
  it('releases the same private phrase only after both authors accept', () => {
    enableHello();
    const cardId = makeCard();
    intent(A, cardId, true);
    intent(B, cardId, true);
    const a = details(A, cardId),
      b = details(B, cardId);
    expect(a.mutual).toBe(true);
    expect(a.phrase.split(' ')).toHaveLength(2);
    expect(a).toEqual(b);
    expect(a.spot).toBe('Synthetic test meeting point');
    expect(JSON.stringify(h.db.postcard.id.find(cardId))).not.toContain(a.phrase);
  });
  it('withdrawal revokes access for both authors', () => {
    enableHello();
    const cardId = makeCard();
    intent(A, cardId, true);
    intent(B, cardId, true);
    intent(A, cardId, false);
    expect(details(B, cardId)).toMatchObject({ mutual: false, phrase: '', spot: '' });
    expect(module.my_hello(h.viewContext(B))[0].mutual).toBe(false);
  });
  it('enforces expiry when accessed without relying on cleanup', () => {
    enableHello();
    const cardId = makeCard();
    intent(A, cardId, true);
    intent(B, cardId, true);
    h.clock.advance(TimeDuration.fromMillis(10 * 60000 + 1));
    expect(details(A, cardId)).toMatchObject({ mutual: false, phrase: '', spot: '' });
    expect(() => intent(A, cardId, true)).toThrow(/expired/);
  });
  it('hiding a card cancels its invitation', () => {
    enableHello();
    const cardId = makeCard();
    intent(A, cardId, true);
    intent(B, cardId, true);
    tx(A, (ctx) => module.hide_my_card(ctx, { cardId }));
    expect(h.db.hello.cardId.find(cardId)).toBeNull();
    expect(() => details(B, cardId)).toThrow(/two writers/);
  });
  it('does not offer invitations on team starters', () => {
    enableHello();
    start(A);
    setup(A);
    catchBottle(A);
    reply(A);
    const cardId = [...h.db.postcard.iter()][0].id;
    expect(module.my_hello(h.viewContext(A))).toHaveLength(0);
    expect(() => intent(A, cardId, true)).toThrow(/two writers/);
  });
});
describe('viewer reporting', () => {
  it('hides a reported share card only for its reporter, without granting publication control', () => {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    reply(B);
    const cardId = [...h.db.postcard.iter()][0].id;
    tx(C, (ctx) => module.report_content(ctx, { roundId: '', cardId, reason: 'other' }));
    tx(C, (ctx) => module.report_content(ctx, { roundId: '', cardId, reason: 'other' }));
    expect(h.db.postcard.id.find(cardId)).not.toBeNull();
    expect([...h.db.report.iter()]).toHaveLength(1);
    expect(module.my_reported_cards(h.viewContext(C))).toEqual([{ id: cardId }]);
    expect(module.my_reported_cards(h.viewContext(A))).toHaveLength(0);
    expect(() => tx(C, (ctx) => module.hide_my_card(ctx, { cardId }))).toThrow(/two authors/);
  });
  it('bounds distinct reports per identity per UTC day', () => {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    reply(B);
    const cardId = [...h.db.postcard.iter()][0].id;
    tx(C, (ctx) => {
      for (let i = 0; i < 20; i++)
        ctx.db.report.insert({
          id: crypto.randomUUID(),
          owner: ctx.sender,
          target: 'synthetic-' + i,
          reason: 'other',
          createdMs: Number(ctx.timestamp.microsSinceUnixEpoch) / 1000,
        });
    });
    expect(() =>
      tx(C, (ctx) => module.report_content(ctx, { roundId: '', cardId, reason: 'other' })),
    ).toThrow(/report limit/);
  });
});
describe('owner operations', () => {
  it('keeps the report queue private and lets the owner dismiss a caught-bottle report', () => {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    const roundId = active(B).id;
    tx(B, (ctx) => module.report_content(ctx, { roundId, cardId: '', reason: 'other' }));
    const r = [...h.db.report.iter()][0];
    expect(h.db.bottle.id.find(r.target)?.hidden).toBe(true);
    expect(() => module.admin_reports(h.procedureContext(C))).toThrow(/project owner/);
    expect(() =>
      tx(C, (ctx) => module.resolve_report(ctx, { reportId: r.id, decision: 'dismiss' })),
    ).toThrow(/project owner/);
    expect(module.admin_reports(h.procedureContext(owner))[0].content).toBe(
      'I taught the octopus insider trading.',
    );
    tx(owner, (ctx) => module.resolve_report(ctx, { reportId: r.id, decision: 'dismiss' }));
    expect(h.db.bottle.id.find(r.target)?.hidden).toBe(false);
    expect(module.admin_status(h.procedureContext(owner)).openReports).toBe(0);
    expect(module.my_reported_cards(h.viewContext(B))).toEqual([{ id: r.target }]);
  });
  it('lets the owner remove a reported public card without granting viewers that authority', () => {
    start(A);
    setup(A);
    start(B);
    setup(B);
    catchBottle(B);
    reply(B);
    const cardId = [...h.db.postcard.iter()][0].id;
    tx(C, (ctx) => module.report_content(ctx, { roundId: '', cardId, reason: 'hurtful' }));
    const r = [...h.db.report.iter()][0];
    tx(owner, (ctx) => module.resolve_report(ctx, { reportId: r.id, decision: 'hide' }));
    expect(h.db.postcard.id.find(cardId)).toBeNull();
    expect(module.my_cards(h.viewContext(A))[0].hidden).toBe(true);
  });
  it('exposes bounded spending controls only to the owner', () => {
    expect(() => module.admin_status(h.procedureContext(A))).toThrow(/project owner/);
    expect(() => tx(A, (ctx) => module.set_dispatch_cap(ctx, { cap: 10000 }))).toThrow(
      /project owner/,
    );
    tx(owner, (ctx) => module.set_dispatch_cap(ctx, { cap: 200 }));
    expect(module.admin_status(h.procedureContext(owner)).cap).toBe(200);
    expect(() => tx(owner, (ctx) => module.set_dispatch_cap(ctx, { cap: 10001 }))).toThrow(
      /at most/,
    );
  });
  it('records review and provider failures as private diagnostics without publishing', () => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const args = {
      roundId: active(A).id,
      requestId: crypto.randomUUID(),
      text: 'I taught the octopus insider trading.',
    };
    expect(
      module.submit_setup(
        modelCtx(A, () => modelResponse({ decision: 'review', reason: 'uncertain' })),
        args,
      ).ok,
    ).toBe(false);
    const ctx = modelCtx(A, () => ({
      code: 401,
      headers: { entries: [] },
      version: { tag: 'Http11' },
      body: 'not printed',
    }));
    expect(module.submit_setup(ctx, { ...args, requestId: crypto.randomUUID() }).ok).toBe(false);
    const stats = module.admin_status(h.procedureContext(owner));
    expect(stats.reviewSubmissions).toBe(1);
    expect(stats.failedModelCalls).toBe(1);
    expect([...h.db.bottle.iter()]).toHaveLength(0);
  });
});
describe('starter provenance', () => {
  it('labels development starter content as sample throughout the canonical card', () => {
    start(A);
    setup(A);
    catchBottle(A);
    expect(claim(A).starterKind).toBe('sample');
    reply(A);
    expect([...h.db.postcard.iter()][0]).toMatchObject({ seeded: true, starterKind: 'sample' });
  });
  it('does not silently use samples when production has no eligible peer', () => {
    start(A);
    setup(A);
    delete env.DRIFT_DEV_MODE;
    expect(() => catchBottle(A)).toThrow(/No bottles are available/);
    expect(active(A).stage).toBe('catch');
    expect(h.db.bottle.id.find(active(A).setupId)).not.toBeNull();
  });
  it('an environment attestation cannot relabel bundled development samples as human', () => {
    start(A);
    setup(A);
    delete env.DRIFT_DEV_MODE;
    env.DRIFT_STARTERS_HUMAN_WRITTEN = 'true';
    expect(() => catchBottle(A)).toThrow(/No bottles are available/);
    env.DRIFT_DEV_MODE = 'true';
    catchBottle(A);
    expect(claim(A).starterKind).toBe('sample');
  });
});

describe('private AI budget and latency accounting', () => {
  const stats = () => module.admin_ai_usage(h.procedureContext(owner));
  const calls = () => module.admin_ai_calls(h.procedureContext(owner));
  const argsFor = (a: any) => ({
    roundId: active(a).id,
    requestId: crypto.randomUUID(),
    text: 'I challenged their shark to poker.',
  });
  const allow = () => pricedResponse({ decision: 'allow', reason: 'safe' });
  it('settles real usage once, measures server elapsed time and leaves no participant data in the cost row', () => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const args = argsFor(A);
    let hits = 0;
    const ctx = modelCtx(A, () => {
      hits++;
      h.clock.advance(TimeDuration.fromMillis(1450));
      return allow();
    });
    expect(module.submit_setup(ctx, args).ok).toBe(true);
    expect(module.submit_setup(ctx, args).ok).toBe(true);
    expect(hits).toBe(1);
    expect(stats()).toMatchObject({
      spentEstimateMicros: 61n,
      reservedMicros: 0n,
      settledCalls: 1,
      p50Ms: 1450,
      p95Ms: 1450,
      measuredCalls: 1,
    });
    const row = calls()[0];
    expect(row.id).not.toContain(active(A).owner.toHexString());
    expect(row).toMatchObject({
      state: 'settled',
      outcome: 'accepted',
      inputTokens: 513,
      outputTokens: 19,
    });
    expect(Object.keys(row)).not.toContain('owner');
    expect(Object.keys(row)).not.toContain('text');
    expect([...h.db.request.iter()][0].costId).toBe(row.id);
  });
  it('refuses before dispatch or consuming attempts when the budget is exhausted or the model is unpriced', () => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    tx(owner, (c) => module.set_ai_budget(c, { limitMicros: 0n }));
    const ctx = modelCtx(A, () => {
      throw Error('Must not dispatch.');
    });
    expect(module.submit_setup(ctx, argsFor(A)).message).toMatch(/budget/);
    tx(owner, (c) => module.set_ai_budget(c, { limitMicros: 10_000_000n }));
    env.MODERATION_MODEL = 'unreviewed-model';
    expect(module.submit_setup(ctx, argsFor(A)).ok).toBe(false);
    expect(active(A).setupAttempts).toBe(0);
    expect([...h.db.request.iter()]).toHaveLength(0);
    expect(stats().retainedCalls).toBe(0);
    expect(module.admin_status(h.procedureContext(owner)).dispatches).toBe(0);
  });
  it('reserves transactionally across writers, then releases unused headroom for the next call', () => {
    start(A);
    start(B);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const bArgs = argsFor(B);
    let bHits = 0;
    const bCtx = modelCtx(B, () => {
      bHits++;
      return allow();
    });
    const aCtx = modelCtx(A, () => {
      const held = stats().reservedMicros;
      expect(held).toBeGreaterThan(122n);
      tx(owner, (c) => module.set_ai_budget(c, { limitMicros: held + held / 2n }));
      expect(module.submit_setup(bCtx, bArgs).message).toMatch(/budget/);
      expect(active(B).setupAttempts).toBe(0);
      return allow();
    });
    expect(module.submit_setup(aCtx, argsFor(A)).ok).toBe(true);
    expect(bHits).toBe(0);
    expect(module.submit_setup(bCtx, bArgs).ok).toBe(true);
    expect(bHits).toBe(1);
    expect(stats()).toMatchObject({
      spentEstimateMicros: 122n,
      reservedMicros: 0n,
      settledCalls: 2,
    });
  });
  it('accounts for malformed/late outputs even when neither is allowed to publish', () => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const invalid = modelCtx(A, () => pricedResponse({ decision: 'allow', reason: 'abuse' }));
    expect(module.submit_setup(invalid, argsFor(A)).ok).toBe(false);
    const late = modelCtx(A, () => {
      h.clock.advance(TimeDuration.fromMillis(30000));
      return allow();
    });
    const args = argsFor(A);
    expect(module.submit_setup(late, args).ok).toBe(false);
    expect(module.submit_setup(late, args).ok).toBe(false);
    expect(stats()).toMatchObject({
      spentEstimateMicros: 122n,
      reservedMicros: 0n,
      settledCalls: 2,
    });
    expect([...h.db.bottle.iter()]).toHaveLength(0);
  });
  it('keeps unknown usage on hold until bounded owner reconciliation and never charges a replay twice', () => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const ctx = modelCtx(A, () => modelResponse({ decision: 'allow', reason: 'safe' }));
    const args = argsFor(A);
    expect(module.submit_setup(ctx, args).ok).toBe(true);
    const row = calls()[0],
      held = stats().reservedMicros;
    expect(held).toBeGreaterThan(0n);
    expect(stats()).toMatchObject({ spentEstimateMicros: 0n, uncertainCalls: 1 });
    module.submit_setup(ctx, args);
    expect(stats().reservedMicros).toBe(held);
    expect(() =>
      tx(owner, (c) => module.reconcile_ai_call(c, { costId: row.id, chargedMicros: 120n })),
    ).toThrow(/one minute/);
    h.clock.advance(TimeDuration.fromMillis(60000));
    tx(owner, (c) => module.reconcile_ai_call(c, { costId: row.id, chargedMicros: 120n }));
    tx(owner, (c) => module.reconcile_ai_call(c, { costId: row.id, chargedMicros: 120n }));
    expect(stats()).toMatchObject({
      spentEstimateMicros: 120n,
      reservedMicros: 0n,
      settledCalls: 1,
    });
    expect(() =>
      tx(owner, (c) => module.reconcile_ai_call(c, { costId: row.id, chargedMicros: 121n })),
    ).toThrow(/Only uncertain/);
  });
  it('owner health checks use the same budget, publish nothing and cannot bypass owner permissions', () => {
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    expect(() => module.admin_ai_usage(h.procedureContext(A))).toThrow(/project owner/);
    expect(() => module.admin_ai_calls(h.procedureContext(A))).toThrow(/project owner/);
    expect(() => tx(A, (c) => module.set_ai_budget(c, { limitMicros: 50_000_000n }))).toThrow(
      /project owner/,
    );
    expect(() =>
      tx(A, (c) => module.reconcile_ai_call(c, { costId: 'x', chargedMicros: 0n })),
    ).toThrow(/project owner/);
    expect(() => module.admin_probe_claude(h.procedureContext(A), { kind: 'nudge' })).toThrow(
      /project owner/,
    );
    const ctx = modelCtx(owner, () =>
      pricedResponse(
        { kind: 'nudge', hint: 'Try giving the aquarium an ordinary office problem.' },
        { input_tokens: 600, output_tokens: 30 },
      ),
    );
    expect(module.admin_probe_claude(ctx, { kind: 'nudge' }).ok).toBe(true);
    expect(stats()).toMatchObject({
      spentEstimateMicros: 1500n,
      reservedMicros: 0n,
      retainedCalls: 1,
    });
    expect(() => module.admin_probe_claude(ctx, { kind: 'nudge' })).toThrow(/one minute apart/);
    expect([...h.db.round.iter()]).toHaveLength(0);
    expect([...h.db.postcard.iter()]).toHaveLength(0);
    expect(() => tx(owner, (c) => module.set_ai_budget(c, { limitMicros: 50_000_001n }))).toThrow(
      /at most/,
    );
  });
  it('retention removes settled anonymous detail while keeping totals and unresolved holds', () => {
    start(A);
    env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    module.submit_setup(
      modelCtx(A, () => allow()),
      argsFor(A),
    );
    start(B);
    module.submit_setup(
      modelCtx(B, () => ({
        code: 401,
        headers: { entries: [] },
        version: { tag: 'Http11' },
        body: 'no private body stored',
      })),
      argsFor(B),
    );
    const unresolved = calls().find((r) => r.state === 'uncertain')!;
    const held = stats().reservedMicros;
    h.clock.advance(TimeDuration.fromMillis(31 * 86400000));
    tx(owner, (c) => module.purge_old_data(c, {}));
    expect([...h.db.request.iter()]).toHaveLength(0);
    expect(calls()).toHaveLength(1);
    expect(stats()).toMatchObject({ spentEstimateMicros: 61n, reservedMicros: held });
    tx(owner, (c) => module.reconcile_ai_call(c, { costId: unresolved.id, chargedMicros: 0n }));
    tx(owner, (c) => module.purge_old_data(c, {}));
    expect(calls()).toHaveLength(0);
    expect(stats()).toMatchObject({ spentEstimateMicros: 61n, reservedMicros: 0n });
  });
});

describe('private daily activity diagnostics', () => {
  const counts = (mode = 'sandbox') => {
    const row = module.admin_activity(h.procedureContext(owner)).find((r) => r.mode === mode);
    return row ? JSON.parse(row.counts) : {};
  };
  const completePeer = () => {
    start(A);
    setup(A);
    tx(B, (c) => module.start_catching(c, {}));
    expect(reply(B).ok).toBe(true);
    return module.my_cards(h.viewContext(B))[0].id;
  };
  it('counts committed game transitions once through request replay and resumptions', () => {
    const r = start(A);
    start(A);
    const args = {
      roundId: r.id,
      requestId: crypto.randomUUID(),
      text: 'I challenged their shark to poker.',
    };
    expect(module.submit_setup(h.procedureContext(A), args).ok).toBe(true);
    expect(module.submit_setup(h.procedureContext(A), args).ok).toBe(true);
    tx(B, (c) => module.start_catching(c, {}));
    tx(B, (c) => module.start_catching(c, {}));
    h.clock.advance(TimeDuration.fromMillis(45_000));
    const requestId = crypto.randomUUID();
    expect(reply(B, requestId).ok).toBe(true);
    expect(reply(B, requestId).ok).toBe(true);
    expect(counts()).toMatchObject({
      roundStarted: 2,
      setupPublished: 1,
      catchAssigned: 1,
      peerCompleted: 1,
      sampleCompleted: 0,
      completionLe30s: 0,
      completionLe120s: 1,
      completionOver120s: 0,
    });
  });
  it('deduplicates author/card/action reports and rejects outsiders, unknown tags and hidden cards', () => {
    const cardId = completePeer();
    const record = (who: any, action: string) =>
      tx(who, (c) => module.record_card_action(c, { cardId, action }));
    for (let i = 0; i < 2; i++) {
      record(A, 'open');
      record(B, 'open');
      record(B, 'png_requested');
      record(A, 'words_copied');
      record(B, 'words_copied');
      record(B, 'native_share_resolved');
      record(B, 'link_copied');
    }
    expect(counts()).toMatchObject({
      setupOpened: 1,
      replyOpened: 1,
      pngRequested: 1,
      wordsCopied: 2,
      nativeShareResolved: 1,
      linkCopied: 1,
    });
    expect(() => record(C, 'open')).toThrow(/another writer/);
    expect(() => record(A, '__proto__')).toThrow(/Unknown/);
    const before = counts();
    tx(A, (c) => module.hide_my_card(c, { cardId }));
    expect(() => record(A, 'png_requested')).toThrow(/no longer available/);
    expect(counts()).toEqual(before);
    const aggregate = [...h.db.activityDay.iter()][0];
    expect(Object.keys(aggregate).sort()).toEqual(['counts', 'day', 'id', 'mode']);
    expect(aggregate.counts).not.toContain('octopus');
    expect(aggregate.counts).not.toContain(h.viewContext(A).sender.toHexString());
  });
  it('keeps sample completions separate from peer returns', () => {
    start(A);
    setup(A);
    catchBottle(A);
    expect(claim(A).seeded).toBe(true);
    expect(reply(A).ok).toBe(true);
    expect(counts()).toMatchObject({
      sampleCompleted: 1,
      peerCompleted: 0,
      teamCompleted: 0,
      setupOpened: 0,
    });
  });
  it('keeps sandbox/live configuration rows separate, owner-only and expiring', () => {
    expect(module.admin_activity(h.procedureContext(owner))).toEqual([]);
    start(A);
    env.DRIFT_DEV_MODE = 'false';
    start(B);
    expect(counts('sandbox').roundStarted).toBe(1);
    expect(counts('live').roundStarted).toBe(1);
    expect(() => module.admin_activity(h.procedureContext(C))).toThrow(/Only the project owner/);
    h.clock.advance(TimeDuration.fromMillis(30 * 86400000));
    tx(owner, (c) => module.purge_old_data(c, {}));
    expect([...h.db.activityDay.iter()]).toHaveLength(0);
  });
  it('rolls an empty catch back without recording a start or consuming a round', () => {
    env.DRIFT_DEV_MODE = 'false';
    expect(() => tx(A, (c) => module.start_catching(c, {}))).toThrow(/No bottles/);
    expect([...h.db.round.iter()]).toHaveLength(0);
    expect([...h.db.activityDay.iter()]).toHaveLength(0);
  });
});
