import { messages, modelRequest, parseModelResponse } from '../../packages/ai-contracts/index';
import {
  schema,
  table,
  t,
  SenderError,
  type ReducerCtx,
  type ProcedureCtx,
} from 'spacetimedb/server';
import { TimeDuration, type Infer } from 'spacetimedb';
import {
  validateLine,
  normalize,
  dayOf,
  promptForDay,
  LEASE_MS,
  ROUNDS_PER_DAY,
} from '../../packages/game-rules/index';

// All participant state is private. Only approved anonymous postcards are public.
const round = table(
  { name: 'round' },
  {
    id: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    day: t.u32(),
    promptId: t.string(),
    promptJson: t.string(),
    stage: t.string(),
    setupId: t.string(),
    assignmentId: t.string(),
    leaseMs: t.f64(),
    version: t.u32(),
    skips: t.u32(),
    excluded: t.string(),
    setupAttempts: t.u32(),
    replyAttempts: t.u32(),
    nudges: t.u32(),
    hint: t.string(),
    cardId: t.string(),
    inFlight: t.string(),
    busyUntil: t.f64(),
  },
);
const bottle = table(
  { name: 'bottle' },
  {
    id: t.string().primaryKey(),
    owner: t.option(t.identity()),
    day: t.u32().index('btree'),
    promptId: t.string(),
    text: t.string(),
    seeded: t.bool(),
    seedIndex: t.u32(),
    claimRound: t.string(),
    claimVersion: t.u32(),
    claimUntil: t.f64(),
    cardId: t.string(),
    hidden: t.bool(),
  },
);
const postcard = table(
  { name: 'postcard', public: true },
  {
    id: t.string().primaryKey(),
    promptId: t.string(),
    setup: t.string(),
    reply: t.string(),
    seeded: t.bool(),
    createdMs: t.f64(),
  },
);
const authorship = table(
  { name: 'authorship' },
  {
    id: t.string().primaryKey(),
    setupOwner: t.option(t.identity()),
    replyOwner: t.identity(),
    hidden: t.bool(),
  },
);
const request = table(
  { name: 'request' },
  {
    id: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    roundId: t.string(),
    operation: t.string(),
    text: t.string(),
    version: t.u32(),
    state: t.string(),
    result: t.string(),
    createdMs: t.f64(),
  },
);
const report = table(
  { name: 'report' },
  {
    id: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    target: t.string(),
    reason: t.string(),
    createdMs: t.f64(),
  },
);
const config = table(
  { name: 'config' },
  {
    id: t.u32().primaryKey(),
    owner: t.identity(),
    paused: t.bool(),
    dispatches: t.u32(),
    dispatchCap: t.u32(),
  },
);
const today = table(
  { name: 'today', public: true },
  { id: t.u32().primaryKey(), day: t.u32(), promptJson: t.string() },
);
const hello = table(
  { name: 'hello' },
  {
    cardId: t.string().primaryKey(),
    setupAccepted: t.bool(),
    replyAccepted: t.bool(),
    phrase: t.string(),
    expiresMs: t.f64(),
  },
);
const db = schema(
  { round, bottle, postcard, authorship, request, report, config, today, hello },
  {
    env: {
      ANTHROPIC_API_KEY: t.option(t.string()),
      DRIFT_DEV_MODE: t.option(t.string()),
      NUDGE_MODEL: t.option(t.string()),
      MODERATION_MODEL: t.option(t.string()),
      DRIFT_HELLO_ENABLED: t.option(t.string()),
      DRIFT_MEETING_SPOT: t.option(t.string()),
      DRIFT_MEETING_SPOT_VERIFIED: t.option(t.string()),
    },
  },
);
export default db;
type Tx = ReducerCtx<typeof db.schemaType>;
type Proc = ProcedureCtx<typeof db.schemaType>;
type Round = Infer<typeof round.rowType>;
type Bottle = Infer<typeof bottle.rowType>;
const now = (ctx: { timestamp: { microsSinceUnixEpoch: bigint } }) =>
  Number(ctx.timestamp.microsSinceUnixEpoch) / 1000;
const same = (a: { toHexString(): string }, b: { toHexString(): string }) =>
  a.toHexString() === b.toHexString();
function fail(message: string): never {
  throw new SenderError(message);
}
function currentRound(ctx: Tx, id: string) {
  const r = ctx.db.round.id.find(id);
  if (!r || !same(r.owner, ctx.sender)) fail('This round belongs to another writer.');
  return r!;
}
function currentClaim(ctx: Tx, r: Round) {
  const b = ctx.db.bottle.id.find(r.assignmentId);
  if (
    !b ||
    b.hidden ||
    b.cardId ||
    b.claimRound !== r.id ||
    b.claimVersion !== r.version ||
    b.claimUntil <= now(ctx)
  )
    fail('This bottle has drifted on. Your draft is saved; catch another.');
  return b!;
}
function ready(ctx: Tx) {
  const c = ctx.db.config.id.find(0)!;
  if (c.paused) fail('The tide is taking a short break. Your draft is saved.');
  return c;
}
function admin(ctx: Tx) {
  const c = ctx.db.config.id.find(0)!;
  if (!same(c.owner, ctx.sender)) fail('Only the project owner can do that.');
  return c;
}
function unlocked(ctx: Tx, r: Round) {
  if (r.inFlight && r.busyUntil > now(ctx)) fail('Your last request is still being checked.');
}
function saveRound(ctx: Tx, r: Round) {
  ctx.db.round.id.update(r);
}
function finishRequest(ctx: Tx, id: string, result: object) {
  const q = ctx.db.request.id.find(id)!;
  ctx.db.request.id.update({ ...q, state: 'finished', result: JSON.stringify(result) });
}

function promptJson(day: number) {
  const { starters, ...publicPrompt } = promptForDay(day);
  return JSON.stringify(publicPrompt);
}
function refresh(ctx: Tx) {
  const day = dayOf(now(ctx));
  const old = ctx.db.today.id.find(0);
  if (old?.day === day) return;
  const row = { id: 0, day, promptJson: promptJson(day) };
  if (old) ctx.db.today.id.update(row);
  else ctx.db.today.insert(row);
}
export const init = db.init((ctx) => {
  ctx.db.config.insert({
    id: 0,
    owner: ctx.sender,
    paused: false,
    dispatches: 0,
    dispatchCap: 1000,
  });
  refresh(ctx);
});
export const connected = db.clientConnected((ctx) => refresh(ctx));
export const refresh_day = db.reducer((ctx) => refresh(ctx));

export const start_round = db.reducer((ctx) => {
  ready(ctx);
  refresh(ctx);
  const day = dayOf(now(ctx));
  const own = [...ctx.db.round.owner.filter(ctx.sender)];
  // An unexpired old claim is resumable; it never acquires a fresh lease at reset.
  const active = own.find(
    (r) => r.stage !== 'done' && (r.day === day || (r.stage === 'reply' && r.leaseMs > now(ctx))),
  );
  if (active) return;
  const today = own.filter((r) => r.day === day);
  if (today.length >= ROUNDS_PER_DAY)
    fail('Three little stories is today’s limit. Come back after the tide turns.');
  ctx.db.round.insert({
    id: ctx.newUuidV4().toString(),
    owner: ctx.sender,
    day,
    promptId: promptForDay(day).id,
    promptJson: promptJson(day),
    stage: 'write',
    setupId: '',
    assignmentId: '',
    leaseMs: 0,
    version: 0,
    skips: 0,
    excluded: '[]',
    setupAttempts: 0,
    replyAttempts: 0,
    nudges: 0,
    hint: '',
    cardId: '',
    inFlight: '',
    busyUntil: 0,
  });
});

const response = t.row('ActionResult', { ok: t.bool(), message: t.string(), hint: t.string() });
type Result = { ok: boolean; message: string; hint: string };
const result = (ok: boolean, message = '', hint = ''): Result => ({ ok, message, hint });

function callClaude(ctx: Proc, kind: 'moderation' | 'nudge', payload: object): any {
  const key = ctx.env.ANTHROPIC_API_KEY;
  if (!key) {
    if (kind === 'moderation' && ctx.env.DRIFT_DEV_MODE === 'true')
      return { decision: 'allow', reason: 'safe' };
    throw Error('Claude is not configured.');
  }
  const model =
    kind === 'nudge'
      ? ctx.env.NUDGE_MODEL || 'claude-sonnet-5-5'
      : ctx.env.MODERATION_MODEL || 'claude-haiku-5-5';
  const res = ctx.http.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    timeout: TimeDuration.fromMillis(18000),
    body: JSON.stringify(modelRequest(kind, payload, model)),
  });
  if (!res.ok) throw Error('Model service unavailable.');
  const body = JSON.parse(res.text());
  return parseModelResponse(kind, body);
}

function paidAction(
  ctx: Proc,
  args: { roundId: string; requestId: string; text: string },
  operation: 'setup' | 'reply' | 'nudge',
): Result {
  if (!/^[a-f0-9-]{36}$/i.test(args.requestId)) fail('Invalid request identifier.');
  const text = normalize(args.text);
  if (operation !== 'nudge') {
    const error = validateLine(text);
    if (error) fail(error);
  } else if (text.length > 160) fail('Your draft is too long.');
  const qid = ctx.sender.toHexString() + ':' + args.requestId;
  const reservation = ctx.withTx((tx) => {
    const existing = tx.db.request.id.find(qid);
    if (existing) {
      if (
        existing.roundId !== args.roundId ||
        existing.operation !== operation ||
        existing.text !== text
      )
        fail('That request identifier was already used for different text.');
      return {
        cached: existing.result
          ? (JSON.parse(existing.result) as Result)
          : result(false, 'That request is still pending or uncertain. Your draft is saved.'),
        round: undefined,
        bottle: undefined,
      };
    }
    const c = ready(tx);
    const r = currentRound(tx, args.roundId);
    unlocked(tx, r);
    if (operation === 'setup' && (r.stage !== 'write' || r.day !== dayOf(now(tx))))
      fail('This prompt has closed. Your draft is saved.');
    if (operation !== 'setup' && r.stage !== 'reply') fail('Catch a bottle before finishing it.');
    const b = operation === 'setup' ? undefined : currentClaim(tx, r);
    const count =
      operation === 'setup' ? r.setupAttempts : operation === 'reply' ? r.replyAttempts : r.nudges;
    if (count >= (operation === 'nudge' ? 2 : 3))
      fail(
        operation === 'nudge'
          ? 'You’ve used both nudges. Your own ending is the good part.'
          : 'You’ve used this round’s three checks. Your draft is saved.',
      );
    if (!tx.env.ANTHROPIC_API_KEY && !(operation !== 'nudge' && tx.env.DRIFT_DEV_MODE === 'true'))
      fail(
        operation === 'nudge'
          ? 'AI guidance is not connected yet. You can still write your ending.'
          : 'Story checks aren’t connected yet. Your draft is saved.',
      );
    if (c.dispatches >= c.dispatchCap)
      fail('Today’s story-check allowance is used up. Your draft is saved.');
    tx.db.config.id.update({ ...c, dispatches: c.dispatches + 1 });
    tx.db.request.insert({
      id: qid,
      owner: tx.sender,
      roundId: r.id,
      operation,
      text,
      version: r.version,
      state: 'dispatched',
      result: '',
      createdMs: now(tx),
    });
    saveRound(tx, {
      ...r,
      inFlight: qid,
      busyUntil: now(tx) + 25000,
      setupAttempts: r.setupAttempts + (operation === 'setup' ? 1 : 0),
      replyAttempts: r.replyAttempts + (operation === 'reply' ? 1 : 0),
      nudges: r.nudges + (operation === 'nudge' ? 1 : 0),
    });
    return { cached: undefined, round: r, bottle: b };
  });
  if (reservation.cached) return reservation.cached;
  const r = reservation.round!;
  const b = reservation.bottle;
  let checked: any;
  try {
    checked = callClaude(ctx, operation === 'nudge' ? 'nudge' : 'moderation', {
      instructions: promptForDay(r.day),
      setup: operation === 'setup' ? text : b!.text,
      ...(operation === 'reply' ? { reply: text } : {}),
      ...(operation === 'nudge' ? { draft: text } : {}),
    });
  } catch {
    return ctx.withTx((tx) => {
      const current = currentRound(tx, r.id);
      if (current.inFlight === qid) saveRound(tx, { ...current, inFlight: '', busyUntil: 0 });
      const value = result(false, 'We couldn’t finish that check. Your draft is saved. Try again.');
      finishRequest(tx, qid, value);
      return value;
    });
  }
  return ctx.withTx((tx) => {
    const current = currentRound(tx, r.id);
    const q = tx.db.request.id.find(qid)!;
    // Persisted dispatches are never automatically reissued. Late results cannot mutate a new assignment.
    if (
      q.state !== 'dispatched' ||
      current.inFlight !== qid ||
      current.version !== r.version ||
      now(tx) > current.busyUntil
    ) {
      const value = result(false, 'That check arrived too late. Your draft is saved.');
      finishRequest(tx, qid, value);
      return value;
    }
    saveRound(tx, { ...current, inFlight: '', busyUntil: 0 });
    if (tx.db.config.id.find(0)!.paused) {
      const value = result(false, 'Publishing is paused. Your draft is saved.');
      finishRequest(tx, qid, value);
      return value;
    }
    if (operation !== 'setup') {
      const live = tx.db.bottle.id.find(b!.id);
      if (
        !live ||
        live.hidden ||
        live.cardId ||
        live.claimRound !== r.id ||
        live.claimVersion !== r.version ||
        live.claimUntil <= now(tx)
      ) {
        const value = result(
          false,
          'This bottle has drifted on. Your draft is saved; catch another.',
        );
        finishRequest(tx, qid, value);
        return value;
      }
    } else if (dayOf(now(tx)) !== r.day) {
      const value = result(false, 'The prompt changed during your check. Your draft is saved.');
      finishRequest(tx, qid, value);
      return value;
    }
    if (operation === 'nudge') {
      saveRound(tx, { ...current, inFlight: '', busyUntil: 0, hint: checked.hint });
      const value = result(true, '', checked.hint);
      finishRequest(tx, qid, value);
      return value;
    }
    if (checked.decision !== 'allow') {
      const value = result(
        false,
        checked.decision === 'review'
          ? 'We couldn’t confidently check this version. It remains private; try a different line.'
          : messages[checked.reason],
      );
      finishRequest(tx, qid, value);
      return value;
    }
    if (operation === 'setup') {
      const id = tx.newUuidV4().toString();
      tx.db.bottle.insert({
        id,
        owner: tx.sender,
        day: r.day,
        promptId: r.promptId,
        text,
        seeded: false,
        seedIndex: 0,
        claimRound: '',
        claimVersion: 0,
        claimUntil: 0,
        cardId: '',
        hidden: false,
      });
      saveRound(tx, { ...current, stage: 'catch', setupId: id, inFlight: '', busyUntil: 0 });
    } else {
      const id = tx.newUuidV4().toString();
      tx.db.postcard.insert({
        id,
        promptId: r.promptId,
        setup: b!.text,
        reply: text,
        seeded: b!.seeded,
        createdMs: now(tx),
      });
      tx.db.authorship.insert({ id, setupOwner: b!.owner, replyOwner: tx.sender, hidden: false });
      tx.db.bottle.id.update({
        ...tx.db.bottle.id.find(b!.id)!,
        cardId: id,
        claimRound: '',
        claimUntil: 0,
      });
      saveRound(tx, { ...current, stage: 'done', cardId: id, inFlight: '', busyUntil: 0 });
    }
    const value = result(true);
    finishRequest(tx, qid, value);
    return value;
  });
}
const paidArgs = { roundId: t.string(), requestId: t.string(), text: t.string() };
export const submit_setup = db.procedure(paidArgs, response, (ctx, args) =>
  paidAction(ctx, args, 'setup'),
);
export const submit_reply = db.procedure(paidArgs, response, (ctx, args) =>
  paidAction(ctx, args, 'reply'),
);
export const request_nudge = db.procedure(paidArgs, response, (ctx, args) =>
  paidAction(ctx, args, 'nudge'),
);

function assign(ctx: Tx, r: Round) {
  if (r.day !== dayOf(now(ctx))) fail('This prompt has closed. Start today’s story.');
  const excluded = new Set(JSON.parse(r.excluded) as string[]);
  // Skips and reports persist across the identity's rounds for this day.
  for (const previous of ctx.db.round.owner.filter(ctx.sender))
    if (previous.day === r.day) for (const id of JSON.parse(previous.excluded)) excluded.add(id);
  let found = [...ctx.db.bottle.day.filter(r.day)].find(
    (b) =>
      !b.hidden &&
      !b.cardId &&
      !b.seeded &&
      b.owner &&
      !same(b.owner, ctx.sender) &&
      (!b.claimRound || b.claimUntil <= now(ctx)) &&
      !excluded.has(b.id),
  );
  if (!found) {
    const prompt = promptForDay(r.day);
    const available = prompt.starters
      .map((text, index) => ({ text, index }))
      .filter((s) => !excluded.has('seed:' + s.index));
    if (!available.length)
      fail('No bottles are available just now. Your setup is safe; try again later.');
    const seed = available[ctx.random.integerInRange(0, available.length - 1)];
    found = {
      id: ctx.newUuidV4().toString(),
      owner: undefined,
      day: r.day,
      promptId: r.promptId,
      text: seed.text,
      seeded: true,
      seedIndex: seed.index,
      claimRound: '',
      claimVersion: 0,
      claimUntil: 0,
      cardId: '',
      hidden: false,
    };
    ctx.db.bottle.insert(found);
  }
  const version = r.version + 1;
  const deadline = now(ctx) + LEASE_MS;
  ctx.db.bottle.id.update({
    ...found,
    claimRound: r.id,
    claimVersion: version,
    claimUntil: deadline,
  });
  saveRound(ctx, {
    ...r,
    stage: 'reply',
    assignmentId: found.id,
    leaseMs: deadline,
    version,
    hint: '',
    inFlight: '',
    busyUntil: 0,
  });
}
export const claim_bottle = db.reducer({ roundId: t.string() }, (ctx, { roundId }) => {
  ready(ctx);
  const r = currentRound(ctx, roundId);
  unlocked(ctx, r);
  if (r.stage === 'reply') {
    const b = ctx.db.bottle.id.find(r.assignmentId);
    if (b && !b.hidden && !b.cardId && b.claimRound === r.id && b.claimUntil > now(ctx)) return;
  } else if (r.stage !== 'catch') fail('Toss your setup first.');
  assign(ctx, r);
});
function release(ctx: Tx, r: Round, reported: boolean) {
  if (!reported) unlocked(ctx, r);
  const b = ctx.db.bottle.id.find(r.assignmentId);
  if (r.stage !== 'reply') fail('There’s no assigned bottle.');
  if (!reported && r.skips >= 1) fail('You’ve used your skip for this round.');
  const excluded = new Set<string>(JSON.parse(r.excluded));
  if (b) {
    excluded.add(b.seeded ? 'seed:' + b.seedIndex : b.id);
    if (b.claimRound === r.id) ctx.db.bottle.id.update({ ...b, claimRound: '', claimUntil: 0 });
  }
  saveRound(ctx, {
    ...r,
    stage: 'catch',
    assignmentId: '',
    leaseMs: 0,
    version: r.version + 1,
    skips: r.skips + (reported ? 0 : 1),
    excluded: JSON.stringify([...excluded]),
    hint: '',
    inFlight: '',
    busyUntil: 0,
  });
}
export const skip_bottle = db.reducer({ roundId: t.string() }, (ctx, { roundId }) => {
  ready(ctx);
  release(ctx, currentRound(ctx, roundId), false);
});
export const abandon_round = db.reducer({ roundId: t.string() }, (ctx, { roundId }) => {
  const r = currentRound(ctx, roundId);
  unlocked(ctx, r);
  if (r.stage === 'reply') release(ctx, r, true);
  saveRound(ctx, { ...ctx.db.round.id.find(r.id)!, stage: 'done', inFlight: '', busyUntil: 0 });
});
export const report_content = db.reducer(
  { roundId: t.string(), cardId: t.string(), reason: t.string() },
  (ctx, { roundId, cardId, reason }) => {
    if (!['personal', 'hurtful', 'unsafe', 'other'].includes(reason))
      fail('Choose a report reason.');
    if (roundId) {
      const r = currentRound(ctx, roundId);
      const b = currentClaim(ctx, r);
      recordReport(ctx, b.id, reason);
      ctx.db.bottle.id.update({ ...b, hidden: true });
      release(ctx, r, true);
      return;
    }
    const a = ctx.db.authorship.id.find(cardId);
    if (!a || !ctx.db.postcard.id.find(cardId)) fail('This postcard is no longer available.');
    recordReport(ctx, cardId, reason);
    // Authors can withdraw their publication. Other viewers hide it only for themselves.
    if (same(a.replyOwner, ctx.sender) || (a.setupOwner && same(a.setupOwner, ctx.sender)))
      hide(ctx, cardId);
  },
);
function recordReport(ctx: Tx, target: string, reason: string) {
  const previous = [...ctx.db.report.owner.filter(ctx.sender)];
  if (previous.some((r) => r.target === target)) return;
  if (previous.filter((r) => dayOf(r.createdMs) === dayOf(now(ctx))).length >= 20)
    fail('You’ve reached today’s report limit. The team can help with anything else.');
  ctx.db.report.insert({
    id: ctx.newUuidV4().toString(),
    owner: ctx.sender,
    target,
    reason,
    createdMs: now(ctx),
  });
}
const reportedCard = t.row('ReportedCard', { id: t.string() });
export const my_reported_cards = db.view(
  { name: 'my_reported_cards', public: true },
  t.array(reportedCard),
  (ctx) => [...ctx.db.report.owner.filter(ctx.sender)].map((r) => ({ id: r.target })),
);
function hide(ctx: Tx, id: string) {
  const a = ctx.db.authorship.id.find(id);
  if (!a || !(same(a.replyOwner, ctx.sender) || (a.setupOwner && same(a.setupOwner, ctx.sender))))
    fail('Only the two authors can hide this postcard.');
  ctx.db.postcard.id.delete(id);
  ctx.db.authorship.id.update({ ...a!, hidden: true });
  ctx.db.hello.cardId.delete(id);
}
function helloEnabled(env: Tx['env']) {
  return (
    env.DRIFT_HELLO_ENABLED === 'true' &&
    env.DRIFT_MEETING_SPOT_VERIFIED === 'true' &&
    !!env.DRIFT_MEETING_SPOT?.trim() &&
    env.DRIFT_MEETING_SPOT.length <= 100
  );
}
function helloAuthor(ctx: Tx, cardId: string) {
  const a = ctx.db.authorship.id.find(cardId);
  const card = ctx.db.postcard.id.find(cardId);
  if (
    !a ||
    !card ||
    a.hidden ||
    !a.setupOwner ||
    card.seeded ||
    !(same(a.replyOwner, ctx.sender) || same(a.setupOwner, ctx.sender))
  ) {
    fail('This invitation is only for the two writers of an attendee postcard.');
  }
  return { a: a!, card: card! };
}
export const set_hello_intent = db.reducer(
  { cardId: t.string(), accepted: t.bool() },
  (ctx, { cardId, accepted }) => {
    if (!helloEnabled(ctx.env)) fail('Saying hello is not available at this event yet.');
    const { a, card } = helloAuthor(ctx, cardId);
    const expiresMs = card.createdMs + 10 * 60 * 1000;
    if (accepted && now(ctx) >= expiresMs)
      fail('This invitation has expired. The postcard is still yours.');
    const old = ctx.db.hello.cardId.find(cardId);
    const value = old
      ? { ...old }
      : { cardId, setupAccepted: false, replyAccepted: false, phrase: '', expiresMs };
    if (same(a.replyOwner, ctx.sender)) value.replyAccepted = accepted;
    else value.setupAccepted = accepted;
    if (value.setupAccepted && value.replyAccepted && !value.phrase) {
      const adjectives = [
        'amber',
        'brave',
        'calm',
        'copper',
        'cosmic',
        'gentle',
        'happy',
        'little',
        'lucky',
        'mellow',
        'minty',
        'quiet',
        'silver',
        'sunny',
        'tiny',
        'velvet',
      ];
      const nouns = [
        'anchor',
        'coral',
        'dolphin',
        'island',
        'jellyfish',
        'lagoon',
        'lantern',
        'lobster',
        'moon',
        'oyster',
        'puffin',
        'ripple',
        'sailboat',
        'seashell',
        'starfish',
        'turtle',
      ];
      value.phrase =
        adjectives[ctx.random.integerInRange(0, adjectives.length - 1)] +
        ' ' +
        nouns[ctx.random.integerInRange(0, nouns.length - 1)];
    }
    if (!accepted) value.phrase = '';
    if (old) ctx.db.hello.cardId.update(value);
    else ctx.db.hello.insert(value);
  },
);
const helloDetails = t.row('HelloDetails', {
  mutual: t.bool(),
  spot: t.string(),
  phrase: t.string(),
  expiresMs: t.f64(),
});
export const get_hello = db.procedure({ cardId: t.string() }, helloDetails, (ctx, { cardId }) =>
  ctx.withTx((tx) => {
    if (!helloEnabled(tx.env)) fail('Saying hello is not available at this event yet.');
    const { card } = helloAuthor(tx, cardId);
    const row = tx.db.hello.cardId.find(cardId);
    const expiresMs = card.createdMs + 10 * 60 * 1000;
    // Time and permissions are checked at access, independently of cleanup.
    if (!row?.setupAccepted || !row.replyAccepted || now(tx) >= expiresMs) {
      return { mutual: false, spot: '', phrase: '', expiresMs };
    }
    return { mutual: true, spot: tx.env.DRIFT_MEETING_SPOT!, phrase: row.phrase, expiresMs };
  }),
);
const helloAvailability = t.row('HelloAvailability', {
  cardId: t.string(),
  optedIn: t.bool(),
  mutual: t.bool(),
  expiresMs: t.f64(),
});
export const my_hello = db.view(
  { name: 'my_hello', public: true },
  t.array(helloAvailability),
  (ctx) => {
    const values = [];
    for (const a of ctx.db.authorship.iter()) {
      if (
        a.hidden ||
        !a.setupOwner ||
        !(same(a.replyOwner, ctx.sender) || same(a.setupOwner, ctx.sender))
      )
        continue;
      const card = ctx.db.postcard.id.find(a.id);
      if (!card || card.seeded) continue;
      const row = ctx.db.hello.cardId.find(a.id);
      values.push({
        cardId: a.id,
        optedIn: same(a.replyOwner, ctx.sender)
          ? (row?.replyAccepted ?? false)
          : (row?.setupAccepted ?? false),
        mutual: !!row?.setupAccepted && !!row?.replyAccepted,
        expiresMs: card.createdMs + 10 * 60 * 1000,
      });
    }
    return values;
  },
);
export const hide_my_card = db.reducer({ cardId: t.string() }, (ctx, { cardId }) =>
  hide(ctx, cardId),
);
export const set_pause = db.reducer({ paused: t.bool() }, (ctx, { paused }) => {
  const c = admin(ctx);
  ctx.db.config.id.update({ ...c, paused });
});
export const purge_old_data = db.reducer((ctx) => {
  admin(ctx);
  const cutoff = now(ctx) - 30 * 86400000;
  for (const c of ctx.db.postcard.iter())
    if (c.createdMs < cutoff) {
      ctx.db.postcard.id.delete(c.id);
      ctx.db.authorship.id.delete(c.id);
      ctx.db.hello.cardId.delete(c.id);
    }
  for (const q of ctx.db.request.iter())
    if (q.createdMs < now(ctx) - 7 * 86400000) ctx.db.request.id.delete(q.id);
  for (const b of ctx.db.bottle.iter())
    if (b.day < dayOf(now(ctx)) - 7) ctx.db.bottle.id.delete(b.id);
  for (const r of ctx.db.report.iter()) if (r.createdMs < cutoff) ctx.db.report.id.delete(r.id);
  for (const r of ctx.db.round.iter())
    if (r.day < dayOf(now(ctx)) - 30) ctx.db.round.id.delete(r.id);
});

export const my_round = db.view(
  { name: 'my_round', public: true },
  t.array(round.rowType),
  (ctx) => [...ctx.db.round.owner.filter(ctx.sender)],
);
const assigned = t.row('Assignment', {
  id: t.string(),
  text: t.string(),
  seeded: t.bool(),
  leaseMs: t.f64(),
  roundId: t.string(),
});
export const my_assignment = db.view(
  { name: 'my_assignment', public: true },
  t.array(assigned),
  (ctx) => {
    const result = [];
    for (const r of ctx.db.round.owner.filter(ctx.sender)) {
      if (r.stage !== 'reply') continue;
      const b = ctx.db.bottle.id.find(r.assignmentId);
      if (b && !b.hidden && !b.cardId && b.claimRound === r.id)
        result.push({
          id: b.id,
          text: b.text,
          seeded: b.seeded,
          leaseMs: r.leaseMs,
          roundId: r.id,
        });
    }
    return result;
  },
);
const ownedCard = t.row('OwnedCard', { id: t.string(), role: t.string(), hidden: t.bool() });
export const my_cards = db.view({ name: 'my_cards', public: true }, t.array(ownedCard), (ctx) => {
  const rows = [];
  for (const a of ctx.db.authorship.iter()) {
    if (same(a.replyOwner, ctx.sender)) rows.push({ id: a.id, role: 'reply', hidden: a.hidden });
    else if (a.setupOwner && same(a.setupOwner, ctx.sender))
      rows.push({ id: a.id, role: 'setup', hidden: a.hidden });
  }
  return rows;
});
const outgoing = t.row('Outgoing', {
  id: t.string(),
  text: t.string(),
  cardId: t.string(),
  day: t.u32(),
});
export const my_outgoing = db.view(
  { name: 'my_outgoing', public: true },
  t.array(outgoing),
  (ctx) => {
    const rows = [];
    for (const r of ctx.db.round.owner.filter(ctx.sender)) {
      const b = ctx.db.bottle.id.find(r.setupId);
      if (b) rows.push({ id: b.id, text: b.text, cardId: b.cardId, day: b.day });
    }
    return rows;
  },
);
const status = t.row('ServiceInfo', {
  id: t.u32(),
  paused: t.bool(),
  sandbox: t.bool(),
  aiReady: t.bool(),
  helloEnabled: t.bool(),
});
export const service_status = db.anonymousView(
  { name: 'service_status', public: true },
  t.array(status),
  (ctx) => {
    const c = ctx.db.config.id.find(0);
    return [
      {
        id: 0,
        paused: c?.paused ?? true,
        sandbox: ctx.env.DRIFT_DEV_MODE === 'true',
        aiReady: !!ctx.env.ANTHROPIC_API_KEY,
        helloEnabled: helloEnabled(ctx.env),
      },
    ];
  },
);
