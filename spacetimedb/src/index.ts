import { messages, modelRequest, parseModelResponse } from '../../packages/ai-contracts/index';
import {
  getScenePack,
  sceneModelRequest,
  parseSceneModelResponse,
} from '../../packages/scene-contracts/index';
import { teamStartersFor } from '../../packages/starter-content/index';
import {
  ACTIVITY_METRICS,
  CARD_ACTIONS,
  type ActivityMetric as Metric,
} from '../../packages/activity/index';
import {
  DEFAULT_BUDGET_MICROS,
  MAX_BUDGET_MICROS,
  PRICE_VERSION,
  quoteRequest,
  priceUsage,
  percentile,
} from '../../packages/ai-costs/index';
import {
  schema,
  table,
  t,
  SenderError,
  type ReducerCtx,
  type ProcedureCtx,
} from 'spacetimedb/server';
import { TimeDuration, ScheduleAt, type Infer } from 'spacetimedb';
import {
  validateLine,
  normalize,
  dayOf,
  promptForDay,
  PROMPTS,
  LEASE_MS,
  ROUNDS_PER_DAY,
} from '../../packages/game-rules/index';

// Participant ownership and drafts stay private. Approved anonymous beginnings and pairs are public.
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
    // Keep the published column order for additive upgrades; pools no longer use these locks.
    claimRound: t.string().default(''),
    claimVersion: t.u32().default(0),
    claimUntil: t.f64().default(0),
    cardId: t.string(),
    hidden: t.bool(),
    starterKind: t.string().default('sample'),
    createdMs: t.f64().default(0),
  },
);
const beginning = table(
  { name: 'beginning', public: true },
  {
    id: t.string().primaryKey(),
    day: t.u32().index('btree'),
    promptId: t.string(),
    promptJson: t.string(),
    text: t.string(),
    seeded: t.bool(),
    starterKind: t.string(),
    createdMs: t.f64(),
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
    starterKind: t.string().default('sample'),
    beginningId: t.string().default('').index('btree'),
  },
);
// Individual selections stay private; public views expose totals only.
const cardVote = table(
  { name: 'card_vote' },
  {
    id: t.string().primaryKey(),
    cardId: t.string().index('btree'),
    owner: t.identity().index('btree'),
    voted: t.bool(),
    createdMs: t.f64(),
    updatedMs: t.f64(),
  },
);
const voteRate = table(
  { name: 'vote_rate' },
  {
    owner: t.identity().primaryKey(),
    day: t.u32(),
    used: t.u32(),
    updatedMs: t.f64(),
  },
);
const postcardScene = table(
  { name: 'postcard_scene', public: true },
  {
    cardId: t.string().primaryKey(),
    packId: t.string(),
    sceneJson: t.string(),
    createdMs: t.f64(),
  },
);
// This status contains no participant identity and follows the public postcard.
const postcardSceneStatus = table(
  { name: 'postcard_scene_status', public: true },
  {
    cardId: t.string().primaryKey(),
    state: t.string(),
    message: t.string(),
    updatedMs: t.f64(),
  },
);
// An interval survives a worker restart before dispatch. Pending jobs never
// dispatch again: later ticks only enforce their deadline.
const sceneSchedule = table(
  { name: 'scene_schedule' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    cardId: t.string().index('btree'),
  },
);
// One durable attempt per completed postcard prevents two authors or a reconnect
// from paying for the same illustration. Provider billing remains in ai_call.
const sceneJob = table(
  { name: 'scene_job' },
  {
    cardId: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    packId: t.string(),
    state: t.string(),
    message: t.string(),
    costId: t.string(),
    createdMs: t.f64(),
    finishedMs: t.f64(),
    startedMs: t.f64().default(0),
  },
);
const authorship = table(
  { name: 'authorship' },
  {
    id: t.string().primaryKey(),
    setupOwner: t.option(t.identity()),
    replyOwner: t.identity(),
    hidden: t.bool(),
    setupActions: t.u32().default(0),
    replyActions: t.u32().default(0),
    beginningId: t.string().default(''),
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
    costId: t.string().default(''),
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
const reportResolution = table(
  { name: 'report_resolution' },
  {
    reportId: t.string().primaryKey(),
    decision: t.string(),
    resolvedMs: t.f64(),
  },
);
const maintenance = table(
  { name: 'maintenance' },
  { id: t.u64().primaryKey(), scheduledAt: t.scheduleAt() },
);
const shorePass = table(
  { name: 'shore_pass' },
  { owner: t.identity().primaryKey(), expiresMs: t.f64() },
);
const idAllocator = table({ name: 'id_allocator' }, { id: t.u32().primaryKey(), next: t.u64() });
// Coarse first-party totals only: no story text, identity, URL or device data.
const activityDay = table(
  { name: 'activity_day' },
  { id: t.string().primaryKey(), day: t.u32(), mode: t.string(), counts: t.string() },
);
const aiBudget = table(
  { name: 'ai_budget' },
  {
    id: t.u32().primaryKey(),
    limitMicros: t.u64(),
    spentMicros: t.u64(),
    reservedMicros: t.u64(),
    startedMs: t.f64(),
    olderDispatches: t.u32(),
  },
);
// Financial diagnostics contain no story text, owner identity, prompt or contact details.
// Only private request/job rows map this random ID back to a participant, for seven days.
const aiCall = table(
  { name: 'ai_call' },
  {
    id: t.string().primaryKey(),
    operation: t.string(),
    model: t.string(),
    priceVersion: t.string(),
    requestBytes: t.u32(),
    reservedMicros: t.u64(),
    heldMicros: t.u64(),
    estimatedMicros: t.u64(),
    inputTokens: t.u32(),
    outputTokens: t.u32(),
    state: t.string(),
    outcome: t.string(),
    createdMs: t.f64(),
    finishedMs: t.f64(),
    elapsedMs: t.f64(),
    durationKnown: t.bool(),
  },
);
const schemaMigration = table(
  { name: 'schema_migration' },
  {
    id: t.string().primaryKey(),
    appliedMs: t.f64(),
    beginnings: t.u32(),
    pairs: t.u32(),
    rounds: t.u32(),
    orphanPairs: t.u32(),
  },
);
const db = schema(
  {
    round,
    bottle,
    beginning,
    postcard,
    cardVote,
    voteRate,
    postcardScene,
    postcardSceneStatus,
    sceneJob,
    sceneSchedule,
    authorship,
    request,
    report,
    config,
    today,
    hello,
    reportResolution,
    maintenance,
    shorePass,
    aiBudget,
    aiCall,
    idAllocator,
    activityDay,
    schemaMigration,
  },
  {
    env: {
      ANTHROPIC_API_KEY: t.option(t.string()),
      DRIFT_DEV_MODE: t.option(t.string()),
      DRIFT_DEV_STARTERS: t.option(t.string()),
      DRIFT_STARTERS_HUMAN_WRITTEN: t.option(t.string()),
      NUDGE_MODEL: t.option(t.string()),
      MODERATION_MODEL: t.option(t.string()),
      SCENE_MODEL: t.option(t.string()),
      DRIFT_HELLO_ENABLED: t.option(t.string()),
      DRIFT_MEETING_SPOT: t.option(t.string()),
      DRIFT_MEETING_SPOT_VERIFIED: t.option(t.string()),
      DRIFT_TURNSTILE_SECRET: t.option(t.string()),
      DRIFT_TURNSTILE_HOSTNAME: t.option(t.string()),
    },
  },
);
export default db;
type Tx = ReducerCtx<typeof db.schemaType>;
type Proc = ProcedureCtx<typeof db.schemaType>;
type Round = Infer<typeof round.rowType>;
type Bottle = Infer<typeof bottle.rowType>;
// Private co-writer receipt; deliberately outside the analytics CARD_ACTIONS mask.
const THANK_YOU_BIT = 1 << 5;
const now = (ctx: { timestamp: { microsSinceUnixEpoch: bigint } }) =>
  Number(ctx.timestamp.microsSinceUnixEpoch) / 1000;
const same = (a: { toHexString(): string }, b: { toHexString(): string }) =>
  a.toHexString() === b.toHexString();
function newId(ctx: Tx) {
  // Runtime UUID entropy can repeat for simultaneous reducer timestamps. A durable
  // transactional suffix makes IDs unique even when that entropy collides.
  const counter = ctx.db.idAllocator.id.find(0) ?? { id: 0, next: 0n };
  const next = { ...counter, next: counter.next + 1n };
  if (ctx.db.idAllocator.id.find(0)) ctx.db.idAllocator.id.update(next);
  else ctx.db.idAllocator.insert(next);
  return `${ctx.newUuidV4().toString()}-${counter.next.toString(36)}`;
}
function fail(message: string): never {
  throw new SenderError(message);
}
function currentRound(ctx: Tx, id: string) {
  const r = ctx.db.round.id.find(id);
  if (!r || !same(r.owner, ctx.sender)) fail('This round belongs to another writer.');
  return r!;
}
function alreadyReplied(ctx: Tx, beginningId: string) {
  return (
    [...ctx.db.authorship.iter()].some(
      (a) => a.beginningId === beginningId && same(a.replyOwner, ctx.sender),
    ) ||
    [...ctx.db.round.owner.filter(ctx.sender)].some(
      (r) => r.assignmentId === beginningId && !!r.cardId,
    )
  );
}
function currentClaim(ctx: Tx, r: Round) {
  const b = ctx.db.bottle.id.find(r.assignmentId);
  // A catch belongs to this private round, not an exclusive lock on the beginning.
  // Other writers may complete their own endings while this writer is composing.
  if (
    !b ||
    b.hidden ||
    !ctx.db.beginning.id.find(b.id) ||
    r.leaseMs <= now(ctx) ||
    (b.owner && same(b.owner, ctx.sender)) ||
    alreadyReplied(ctx, b.id)
  )
    fail('This bottle has drifted on. Your draft is saved; catch another.');
  return b!;
}
function publishBeginning(ctx: Tx, b: Bottle) {
  const row = {
    id: b.id,
    day: b.day,
    promptId: b.promptId,
    promptJson: promptJson(b.day),
    text: b.text,
    seeded: b.seeded,
    starterKind: b.seeded ? b.starterKind : 'none',
    createdMs: b.createdMs,
  };
  if (ctx.db.beginning.id.find(b.id)) ctx.db.beginning.id.update(row);
  else ctx.db.beginning.insert(row);
}
function hideBeginning(ctx: Tx, b: Bottle) {
  ctx.db.bottle.id.update({ ...b, hidden: true });
  ctx.db.beginning.id.delete(b.id);
  for (const card of ctx.db.postcard.beginningId.filter(b.id)) {
    ctx.db.postcard.id.delete(card.id);
    removeCardScene(ctx, card.id);
    removeCardVotes(ctx, card.id);
    const a = ctx.db.authorship.id.find(card.id);
    if (a) ctx.db.authorship.id.update({ ...a, hidden: true });
    ctx.db.hello.cardId.delete(card.id);
  }
}
// Schema expansion is automatic; this owner-run data backfill is separate and idempotent.
const letterUpgradeInfo = t.row('LetterUpgradeInfo', {
  alreadyApplied: t.bool(),
  beginnings: t.u32(),
  pairs: t.u32(),
  rounds: t.u32(),
  orphanPairs: t.u32(),
});
export const admin_upgrade_letters = db.procedure(letterUpgradeInfo, (ctx) =>
  ctx.withTx((tx) => {
    const config = admin(tx);
    const key = 'independent-letters-v1';
    const applied = tx.db.schemaMigration.id.find(key);
    if (applied)
      return {
        alreadyApplied: true,
        beginnings: applied.beginnings,
        pairs: applied.pairs,
        rounds: applied.rounds,
        orphanPairs: applied.orphanPairs,
      };
    if (!config.paused) fail('The tide must be paused before upgrading existing bottles.');
    const rounds = [...tx.db.round.iter()];
    if (rounds.some((r) => r.inFlight && r.busyUntil > now(tx)))
      fail('Your last request is still being checked. Try the upgrade again shortly.');
    let beginnings = 0,
      pairs = 0,
      changedRounds = 0,
      orphanPairs = 0;
    const cardToBeginning = new Map<string, string>();
    for (const r of rounds)
      if (r.cardId && r.assignmentId) cardToBeginning.set(r.cardId, r.assignmentId);
    for (const original of tx.db.bottle.iter()) {
      const b = original.createdMs ? original : { ...original, createdMs: original.day * 86400000 };
      if (!original.createdMs) tx.db.bottle.id.update(b);
      if (b.cardId) cardToBeginning.set(b.cardId, b.id);
      if (!b.hidden && b.text && !tx.db.beginning.id.find(b.id)) {
        publishBeginning(tx, b);
        beginnings++;
      }
    }
    for (const c of tx.db.postcard.iter()) {
      const id = c.beginningId || cardToBeginning.get(c.id) || `legacy-${c.id}`;
      cardToBeginning.set(c.id, id);
      if (!c.beginningId) {
        tx.db.postcard.id.update({ ...c, beginningId: id });
        pairs++;
      }
      // The original bottle may have expired under the previous seven-day policy.
      // Reconstruct only its approved public setup; never infer an owner or resurrect a hidden pair.
      if (!tx.db.beginning.id.find(id) && !tx.db.bottle.id.find(id)) {
        const a = tx.db.authorship.id.find(c.id);
        if (!a?.hidden) {
          const prompt = PROMPTS.find((p) => p.id === c.promptId);
          if (!prompt) fail('This legacy postcard prompt needs an explicit migration mapping.');
          tx.db.beginning.insert({
            id,
            day: dayOf(c.createdMs),
            promptId: c.promptId,
            promptJson: JSON.stringify(prompt),
            text: c.setup,
            seeded: c.seeded,
            starterKind: c.starterKind,
            createdMs: c.createdMs,
          });
          beginnings++;
          orphanPairs++;
        }
      }
    }
    for (const a of tx.db.authorship.iter()) {
      const id = a.beginningId || cardToBeginning.get(a.id);
      if (id && !a.beginningId) tx.db.authorship.id.update({ ...a, beginningId: id });
    }
    for (const r of rounds) {
      // A legacy write-first release used to lead straight into catching. Its publication is complete.
      // Keep existing reply leases, optional write drafts, IDs, request receipts and ownership intact.
      if (r.stage === 'catch' && r.setupId && !r.inFlight) {
        saveRound(tx, { ...r, stage: 'done' });
        changedRounds++;
      }
    }
    const result = { beginnings, pairs, rounds: changedRounds, orphanPairs };
    tx.db.schemaMigration.insert({ id: key, appliedMs: now(tx), ...result });
    return { alreadyApplied: false, ...result };
  }),
);

function ready(ctx: Tx) {
  const c = ctx.db.config.id.find(0)!;
  if (c.paused) fail('The tide is taking a short break. Your draft is saved.');
  if (
    ctx.env.DRIFT_TURNSTILE_SECRET &&
    (ctx.db.shorePass.owner.find(ctx.sender)?.expiresMs ?? 0) <= now(ctx)
  )
    fail('Your shore check expired. Verify again to keep the bottles human.');
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
function finishRequest(ctx: Tx, id: string, result: object, state = 'finished') {
  const q = ctx.db.request.id.find(id);
  if (!q) return;
  if (q.costId)
    finishAiOutcome(
      ctx,
      q.costId,
      state === 'finished' ? ((result as Result).ok ? 'accepted' : 'not_published') : state,
    );
  ctx.db.request.id.update({ ...q, state, result: JSON.stringify(result) });
}

function countActivity(ctx: Tx, changes: Partial<Record<Metric, number>>) {
  const day = dayOf(now(ctx));
  const mode = ctx.env.DRIFT_DEV_MODE === 'true' ? 'sandbox' : 'live';
  const id = `${day}:${mode}`;
  const old = ctx.db.activityDay.id.find(id);
  const counts = old
    ? JSON.parse(old.counts)
    : Object.fromEntries(ACTIVITY_METRICS.map((key) => [key, 0]));
  for (const key of ACTIVITY_METRICS) counts[key] = (counts[key] ?? 0) + (changes[key] ?? 0);
  const row = { id, day, mode, counts: JSON.stringify(counts) };
  if (old) ctx.db.activityDay.id.update(row);
  else ctx.db.activityDay.insert(row);
}
export const record_card_action = db.reducer(
  { cardId: t.string(), action: t.string() },
  (ctx, { cardId, action }) => {
    if (!cardId || cardId.length > 128) fail('Invalid postcard identifier.');
    if (!Object.hasOwn(CARD_ACTIONS, action)) fail('Unknown postcard action.');
    const author = ctx.db.authorship.id.find(cardId);
    if (!author || author.hidden || !ctx.db.postcard.id.find(cardId))
      fail('This postcard is no longer available.');
    const role = same(author.replyOwner, ctx.sender)
      ? 'reply'
      : author.setupOwner && same(author.setupOwner, ctx.sender)
        ? 'setup'
        : undefined;
    if (!role) fail('This postcard belongs to another writer.');
    const bit = CARD_ACTIONS[action as keyof typeof CARD_ACTIONS];
    const field = role === 'setup' ? 'setupActions' : 'replyActions';
    const previous = author[field] ?? 0;
    if (previous & bit) return;
    ctx.db.authorship.id.update({ ...author, [field]: previous | bit });
    const metric: Metric =
      action === 'open'
        ? role === 'setup'
          ? 'setupOpened'
          : 'replyOpened'
        : action === 'png_requested'
          ? 'pngRequested'
          : action === 'words_copied'
            ? 'wordsCopied'
            : action === 'native_share_resolved'
              ? 'nativeShareResolved'
              : 'linkCopied';
    countActivity(ctx, { [metric]: 1 });
  },
);
const activityInfo = t.row('ActivityInfo', { day: t.u32(), mode: t.string(), counts: t.string() });
export const admin_activity = db.procedure(t.array(activityInfo), (ctx) =>
  ctx.withTx((tx) => {
    admin(tx);
    return [...tx.db.activityDay.iter()]
      .filter((row) => row.day > dayOf(now(tx)) - 30)
      .sort((a, b) => b.day - a.day || a.mode.localeCompare(b.mode))
      .map(({ day, mode, counts }) => ({ day, mode, counts }));
  }),
);

function budgetFor(ctx: Tx) {
  return (
    ctx.db.aiBudget.id.find(0) ??
    ctx.db.aiBudget.insert({
      id: 0,
      limitMicros: DEFAULT_BUDGET_MICROS,
      spentMicros: 0n,
      reservedMicros: 0n,
      startedMs: now(ctx),
      olderDispatches: ctx.db.config.id.find(0)!.dispatches,
    })
  );
}
type ModelWork = ReturnType<typeof modelRequest> | ReturnType<typeof sceneModelRequest>;
function reserveAiCall(ctx: Tx, operation: string, work: ModelWork | undefined) {
  const c = ctx.db.config.id.find(0)!;
  if (c.dispatches >= c.dispatchCap)
    fail('Today’s story-check allowance is used up. Your draft is saved.');
  const quote = work ? quoteRequest(work) : { reservedMicros: 0n, requestBytes: 0 };
  const budget = budgetFor(ctx);
  if (
    quote.reservedMicros > 0n &&
    budget.spentMicros + budget.reservedMicros + quote.reservedMicros > budget.limitMicros
  )
    fail('The tide’s story-check budget is taking a break. Your draft is saved.');
  ctx.db.aiBudget.id.update({
    ...budget,
    reservedMicros: budget.reservedMicros + quote.reservedMicros,
  });
  ctx.db.config.id.update({ ...c, dispatches: c.dispatches + 1 });
  const id = newId(ctx);
  ctx.db.aiCall.insert({
    id,
    operation,
    model: work?.model ?? 'sandbox',
    priceVersion: PRICE_VERSION,
    requestBytes: quote.requestBytes,
    reservedMicros: quote.reservedMicros,
    heldMicros: quote.reservedMicros,
    estimatedMicros: 0n,
    inputTokens: 0,
    outputTokens: 0,
    state: work ? 'pending' : 'sandbox',
    outcome: 'pending',
    createdMs: now(ctx),
    finishedMs: 0,
    elapsedMs: 0,
    durationKnown: false,
  });
  return id;
}
function settleAiUsage(ctx: Tx, id: string, usage: unknown) {
  const row = ctx.db.aiCall.id.find(id);
  if (!row || row.state === 'settled' || row.state === 'reconciled') return;
  const cost = priceUsage(row.model, usage);
  if (cost) {
    const budget = budgetFor(ctx);
    ctx.db.aiBudget.id.update({
      ...budget,
      reservedMicros: budget.reservedMicros - row.heldMicros,
      spentMicros: budget.spentMicros + cost.estimatedMicros,
    });
  }
  ctx.db.aiCall.id.update({
    ...row,
    ...(cost ?? {}),
    heldMicros: cost ? 0n : row.heldMicros,
    state: cost ? 'settled' : 'uncertain',
    finishedMs: now(ctx),
    elapsedMs: Math.max(0, now(ctx) - row.createdMs),
    durationKnown: true,
  });
}
function finishAiOutcome(ctx: Tx, id: string, outcome: string) {
  const row = ctx.db.aiCall.id.find(id);
  if (!row) return;
  ctx.db.aiCall.id.update({
    ...row,
    outcome,
    state: row.state === 'pending' ? 'uncertain' : row.state,
    finishedMs: row.finishedMs || now(ctx),
    elapsedMs: row.durationKnown ? row.elapsedMs : Math.max(0, now(ctx) - row.createdMs),
    durationKnown: true,
  });
}

function promptJson(day: number) {
  const { starters, ...publicPrompt } = promptForDay(day);
  return JSON.stringify(publicPrompt);
}
function refresh(ctx: Tx) {
  if (!ctx.db.maintenance.id.find(0n))
    ctx.db.maintenance.insert({ id: 0n, scheduledAt: ScheduleAt.interval(3600_000_000n) });
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
export const server_time = db.procedure(t.f64(), (ctx) => now(ctx));

function startRound(ctx: Tx, initialStage: 'write' | 'catch') {
  ready(ctx);
  refresh(ctx);
  const day = dayOf(now(ctx));
  const own = [...ctx.db.round.owner.filter(ctx.sender)];
  // An unexpired old claim is resumable; it never acquires a fresh lease at reset.
  const active = own.find((r) =>
    initialStage === 'write'
      ? r.stage === 'write' && r.day === day
      : (r.stage === 'catch' || r.stage === 'reply') &&
        (r.day === day || (r.stage === 'reply' && r.leaseMs > now(ctx))),
  );
  if (active) return active;
  const today = own.filter((r) => r.day === day);
  if (today.length >= ROUNDS_PER_DAY)
    fail('Three little stories is today’s limit. Come back after the tide turns.');
  countActivity(ctx, { roundStarted: 1 });
  return ctx.db.round.insert({
    id: newId(ctx),
    owner: ctx.sender,
    day,
    promptId: promptForDay(day).id,
    promptJson: promptJson(day),
    stage: initialStage,
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
}
export const start_round = db.reducer((ctx) => {
  startRound(ctx, 'write');
});
export const start_catching = db.reducer((ctx) => {
  const r = startRound(ctx, 'catch');
  if (r.stage === 'catch') assign(ctx, r);
});

const response = t.row('ActionResult', { ok: t.bool(), message: t.string(), hint: t.string() });
type Result = { ok: boolean; message: string; hint: string };
const result = (ok: boolean, message = '', hint = ''): Result => ({ ok, message, hint });
export const verify_shore = db.procedure({ token: t.string() }, response, (ctx, { token }) => {
  const secret = ctx.env.DRIFT_TURNSTILE_SECRET;
  if (!secret) return result(true);
  if (ctx.withTx((tx) => (tx.db.shorePass.owner.find(tx.sender)?.expiresMs ?? 0) > now(tx)))
    return result(true);
  if (!token || token.length > 2048)
    return result(false, 'Couldn’t verify this shore check. Try again.');
  try {
    const answer = ctx.http.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeout: TimeDuration.fromMillis(10000),
      body: JSON.stringify({ secret, response: token }),
    });
    if (!answer.ok) return result(false, 'Couldn’t verify this shore check. Try again.');
    const data = JSON.parse(answer.text());
    if (
      data.success !== true ||
      data.action !== 'drift' ||
      !ctx.env.DRIFT_TURNSTILE_HOSTNAME ||
      data.hostname !== ctx.env.DRIFT_TURNSTILE_HOSTNAME
    )
      return result(false, 'Couldn’t verify this shore check. Try again.');
    return ctx.withTx((tx) => {
      const pass = { owner: tx.sender, expiresMs: now(tx) + 3600000 };
      if (tx.db.shorePass.owner.find(tx.sender)) tx.db.shorePass.owner.update(pass);
      else tx.db.shorePass.insert(pass);
      return result(true);
    });
  } catch {
    return result(false, 'Couldn’t verify this shore check. Try again.');
  }
});

function callClaudeProvider(ctx: Proc, work: ModelWork | undefined, costId: string): any {
  const key = ctx.env.ANTHROPIC_API_KEY;
  if (!key) throw Error('Claude is not configured.');
  if (!work) throw Error('Missing reserved model request.');
  const res = ctx.http.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    timeout: TimeDuration.fromMillis(18000),
    body: JSON.stringify(work),
  });
  if (!res.ok) throw Error('provider_http_' + res.status);
  const body = JSON.parse(res.text());
  // Meter valid provider usage even if parsing the creative/moderation output fails.
  ctx.withTx((tx) => settleAiUsage(tx, costId, body.usage));
  return body;
}

function callClaude(
  ctx: Proc,
  kind: 'moderation' | 'nudge',
  work: ModelWork | undefined,
  costId: string,
): any {
  if (!ctx.env.ANTHROPIC_API_KEY && kind === 'moderation' && ctx.env.DRIFT_DEV_MODE === 'true')
    return { decision: 'allow', reason: 'safe' };
  return parseModelResponse(kind, callClaudeProvider(ctx, work, costId));
}

const sceneResult = t.row('SceneResult', { state: t.string(), message: t.string() });
type SceneResult = { state: 'ready' | 'pending' | 'failed'; message: string };
const sceneFailure = 'The illustration couldn’t be completed. Your postcard is saved.';
const sceneUnavailable = 'This postcard is no longer available.';
const SCENE_WAIT_MS = 25000;
const SCENES_PER_DAY = 12;

function stopSceneSchedule(ctx: Tx, cardId: string) {
  for (const scheduled of ctx.db.sceneSchedule.cardId.filter(cardId))
    ctx.db.sceneSchedule.scheduledId.delete(scheduled.scheduledId);
}

function writeSceneStatus(ctx: Tx, cardId: string, state: SceneResult['state'], message = '') {
  const value = { cardId, state, message, updatedMs: now(ctx) };
  if (ctx.db.postcardSceneStatus.cardId.find(cardId))
    ctx.db.postcardSceneStatus.cardId.update(value);
  else ctx.db.postcardSceneStatus.insert(value);
}

function removeCardScene(ctx: Tx, cardId: string) {
  const job = ctx.db.sceneJob.cardId.find(cardId);
  if (job?.state === 'pending' && job.costId) finishAiOutcome(ctx, job.costId, 'scene_removed');
  ctx.db.postcardScene.cardId.delete(cardId);
  ctx.db.postcardSceneStatus.cardId.delete(cardId);
  ctx.db.sceneJob.cardId.delete(cardId);
  stopSceneSchedule(ctx, cardId);
}

function queueCardScene(ctx: Tx, cardId: string) {
  if (ctx.db.sceneJob.cardId.find(cardId) || ctx.db.postcardScene.cardId.find(cardId)) return;
  const card = ctx.db.postcard.id.find(cardId)!;
  const author = ctx.db.authorship.id.find(cardId)!;
  const pack = getScenePack(card.promptId);
  ctx.db.sceneJob.insert({
    cardId,
    owner: author.replyOwner,
    packId: pack.id,
    state: 'queued',
    message: '',
    costId: '',
    createdMs: now(ctx),
    startedMs: 0,
    finishedMs: 0,
  });
  writeSceneStatus(ctx, cardId, 'pending');
  ctx.db.sceneSchedule.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.interval(1_000_000n),
    cardId,
  });
}

function finishSceneJob(ctx: Tx, cardId: string, state: 'ready' | 'failed', message = '') {
  const job = ctx.db.sceneJob.cardId.find(cardId);
  if (!job) return;
  ctx.db.sceneJob.cardId.update({ ...job, state, message, finishedMs: now(ctx) });
  writeSceneStatus(ctx, cardId, state, message);
  stopSceneSchedule(ctx, cardId);
}

function expireSceneAttempt(ctx: Tx, job: Infer<typeof sceneJob.rowType>) {
  if (job.state !== 'pending' || now(ctx) <= (job.startedMs || job.createdMs) + SCENE_WAIT_MS)
    return false;
  // A missing response does not prove that the provider did no work. Preserve
  // the billing hold and never send the same paid request again automatically.
  finishAiOutcome(ctx, job.costId, 'scene_uncertain');
  finishSceneJob(ctx, job.cardId, 'failed', sceneFailure);
  return true;
}

function illustrateCard(ctx: Proc, cardId: string): SceneResult {
  if (!cardId || cardId.length > 128) fail('Invalid postcard identifier.');
  return ctx.withTx((tx) => {
    const card = tx.db.postcard.id.find(cardId);
    const author = tx.db.authorship.id.find(cardId);
    if (!card || !author || author.hidden) fail(sceneUnavailable);
    if (!(
      same(author.replyOwner, tx.sender) ||
      (author.setupOwner && same(author.setupOwner, tx.sender))
    ))
      fail('Only this postcard’s writers can request its illustration.');
    if (tx.db.postcardScene.cardId.find(cardId)) {
      writeSceneStatus(tx, cardId, 'ready');
      return { state: 'ready', message: '' };
    }
    const existing = tx.db.sceneJob.cardId.find(cardId);
    if (existing) {
      expireSceneAttempt(tx, existing);
      const status = tx.db.postcardSceneStatus.cardId.find(cardId);
      if (status) return { state: status.state as SceneResult['state'], message: status.message };
      return {
        state: existing.state === 'failed' ? 'failed' : 'pending',
        message: existing.message,
      };
    }
    // This path only backfills old postcards. New endings enqueue atomically
    // with their accepted text and do not require either writer to stay online.
    ready(tx);
    if (
      [...tx.db.sceneJob.owner.filter(author.replyOwner)].filter(
        (job) => dayOf(job.createdMs) === dayOf(now(tx)),
      ).length >= SCENES_PER_DAY
    )
      fail('You’ve illustrated twelve postcards today. Try again tomorrow.');
    queueCardScene(tx, cardId);
    return { state: 'pending', message: '' };
  });
}

function generateCardScene(ctx: Proc, cardId: string) {
  const reservation = ctx.withTx((tx) => {
    const job = tx.db.sceneJob.cardId.find(cardId);
    const card = tx.db.postcard.id.find(cardId);
    const author = tx.db.authorship.id.find(cardId);
    if (!job || !card || !author || author.hidden) {
      removeCardScene(tx, cardId);
      return;
    }
    if (tx.db.postcardScene.cardId.find(cardId)) {
      finishSceneJob(tx, cardId, 'ready');
      return;
    }
    if (job.state === 'pending') {
      expireSceneAttempt(tx, job);
      return;
    }
    if (job.state !== 'queued') {
      stopSceneSchedule(tx, cardId);
      return;
    }
    try {
      if (tx.db.config.id.find(0)!.paused)
        fail('Illustrations are paused. Your postcard is saved.');
      if (!tx.env.ANTHROPIC_API_KEY)
        fail('Illustrations aren’t connected yet. Your postcard is saved.');
      const pack = getScenePack(card.promptId);
      if (pack.id !== job.packId) fail(sceneFailure);
      const prompt = PROMPTS.find((item) => item.id === card.promptId);
      const work = sceneModelRequest(
        {
          promptId: card.promptId,
          promptTitle: prompt?.title ?? 'A bottle exchange',
          setup: card.setup,
          reply: card.reply,
        },
        tx.env.SCENE_MODEL,
      );
      const costId = reserveAiCall(tx, 'scene', work);
      tx.db.sceneJob.cardId.update({ ...job, state: 'pending', costId, startedMs: now(tx) });
      return { card, pack, work, costId };
    } catch (error) {
      finishSceneJob(
        tx,
        cardId,
        'failed',
        error instanceof SenderError ? error.message : sceneFailure,
      );
      return;
    }
  });
  if (!reservation) return;
  const { card, pack, work, costId } = reservation;
  let scene;
  try {
    scene = parseSceneModelResponse(callClaudeProvider(ctx, work, costId), pack);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const outcome = /^provider_http_\d{3}$/.test(message) ? message : 'scene_error';
    ctx.withTx((tx) => {
      finishAiOutcome(tx, costId, outcome);
      const job = tx.db.sceneJob.cardId.find(cardId);
      if (job?.costId === costId && job.state === 'pending')
        finishSceneJob(tx, cardId, 'failed', sceneFailure);
    });
    return;
  }
  ctx.withTx((tx) => {
    const job = tx.db.sceneJob.cardId.find(cardId);
    const current = tx.db.postcard.id.find(cardId);
    const author = tx.db.authorship.id.find(cardId);
    // Hiding, withdrawing, reporting, expiration and a late response must never
    // resurrect the public visual or its status.
    if (
      !job ||
      job.costId !== costId ||
      job.state !== 'pending' ||
      !current ||
      !author ||
      author.hidden ||
      current.promptId !== card.promptId ||
      current.setup !== card.setup ||
      current.reply !== card.reply ||
      now(tx) > (job.startedMs || job.createdMs) + SCENE_WAIT_MS ||
      tx.db.config.id.find(0)!.paused
    ) {
      finishAiOutcome(tx, costId, 'scene_not_published');
      if (!current || !author || author.hidden) removeCardScene(tx, cardId);
      else if (job?.costId === costId) finishSceneJob(tx, cardId, 'failed', sceneFailure);
      return;
    }
    tx.db.postcardScene.insert({
      cardId,
      packId: pack.id,
      sceneJson: JSON.stringify(scene),
      createdMs: now(tx),
    });
    finishSceneJob(tx, cardId, 'ready');
    finishAiOutcome(tx, costId, 'scene_published');
  });
}

export const scene_tick = db.procedure(
  { onSchedule: sceneSchedule },
  { arg: sceneSchedule.rowType },
  t.unit(),
  (ctx, { arg }) => {
    if (!same(ctx.sender, ctx.databaseIdentity))
      fail('Illustrations can only be generated by the scheduled worker.');
    generateCardScene(ctx, arg.cardId);
    return {};
  },
);

export const illustrate_card = db.procedure(
  { cardId: t.string() },
  sceneResult,
  (ctx, { cardId }) => {
    try {
      return illustrateCard(ctx, cardId);
    } catch (error) {
      return {
        state: 'failed',
        message: error instanceof SenderError ? error.message : sceneFailure,
      };
    }
  },
);

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
      const earlierBottle =
        operation !== 'setup' && tx.db.round.id.find(args.roundId)?.version !== existing.version;
      return {
        cached: earlierBottle
          ? result(
              false,
              'That check belongs to an earlier bottle. Your draft is saved. Try again for this bottle.',
            )
          : existing.result
            ? (JSON.parse(existing.result) as Result)
            : result(false, 'That request is still pending or uncertain. Your draft is saved.'),
        round: undefined,
        bottle: undefined,
        work: undefined,
        costId: '',
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
    const kind = operation === 'nudge' ? 'nudge' : 'moderation';
    const prompt = promptForDay(r.day);
    const work = tx.env.ANTHROPIC_API_KEY
      ? modelRequest(
          kind,
          {
            instructions: { setup: prompt.setup, reply: prompt.reply },
            setup: operation === 'setup' ? text : b!.text,
            ...(operation === 'reply' ? { reply: text } : {}),
            ...(operation === 'nudge' ? { draft: text } : {}),
          },
          kind === 'nudge' ? tx.env.NUDGE_MODEL : tx.env.MODERATION_MODEL,
        )
      : undefined;
    const costId = reserveAiCall(tx, operation, work);
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
      costId,
    });
    saveRound(tx, {
      ...r,
      inFlight: qid,
      busyUntil: now(tx) + 25000,
      setupAttempts: r.setupAttempts + (operation === 'setup' ? 1 : 0),
      replyAttempts: r.replyAttempts + (operation === 'reply' ? 1 : 0),
      nudges: r.nudges + (operation === 'nudge' ? 1 : 0),
    });
    return { cached: undefined, round: r, bottle: b, work, costId };
  });
  if (reservation.cached) return reservation.cached;
  const r = reservation.round!;
  const b = reservation.bottle;
  let checked: any;
  try {
    checked = callClaude(
      ctx,
      operation === 'nudge' ? 'nudge' : 'moderation',
      reservation.work,
      reservation.costId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = /^provider_http_\d{3}$/.test(message)
      ? message
      : message === 'Incomplete model result.'
        ? 'model_incomplete'
        : 'model_error';
    return ctx.withTx((tx) => {
      const current = currentRound(tx, r.id);
      if (current.inFlight === qid) saveRound(tx, { ...current, inFlight: '', busyUntil: 0 });
      const value = result(false, 'We couldn’t finish that check. Your draft is saved. Try again.');
      finishRequest(tx, qid, value, code);
      return value;
    });
  }
  return ctx.withTx((tx) => {
    const current = currentRound(tx, r.id);
    const q = tx.db.request.id.find(qid)!;
    // Persisted dispatches are never automatically reissued. Late results cannot mutate a new assignment.
    if (
      !q ||
      q.state !== 'dispatched' ||
      current.inFlight !== qid ||
      current.version !== r.version ||
      now(tx) > current.busyUntil
    ) {
      const value = result(false, 'That check arrived too late. Your draft is saved.');
      finishRequest(tx, qid, value, 'late');
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
        !tx.db.beginning.id.find(live.id) ||
        current.assignmentId !== b!.id ||
        current.stage !== 'reply' ||
        current.leaseMs <= now(tx) ||
        alreadyReplied(tx, live.id)
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
      finishRequest(tx, qid, value, checked.decision);
      return value;
    }
    if (operation === 'setup') {
      const id = newId(tx);
      const created = tx.db.bottle.insert({
        id,
        owner: tx.sender,
        day: r.day,
        promptId: r.promptId,
        text,
        seeded: false,
        starterKind: 'none',
        createdMs: now(tx),
        seedIndex: 0,
        claimRound: '',
        claimVersion: 0,
        claimUntil: 0,
        cardId: '',
        hidden: false,
      });
      publishBeginning(tx, created);
      saveRound(tx, {
        ...current,
        stage: 'done',
        setupId: id,
        inFlight: '',
        busyUntil: 0,
      });
      countActivity(tx, { setupPublished: 1 });
    } else {
      const id = newId(tx);
      tx.db.postcard.insert({
        id,
        beginningId: b!.id,
        promptId: r.promptId,
        setup: b!.text,
        reply: text,
        seeded: b!.seeded,
        starterKind: b!.seeded ? b!.starterKind : 'none',
        createdMs: now(tx),
      });
      tx.db.authorship.insert({
        id,
        setupOwner: b!.owner,
        replyOwner: tx.sender,
        beginningId: b!.id,
        hidden: false,
        setupActions: 0,
        replyActions: 0,
      });
      queueCardScene(tx, id);
      const elapsed = Math.max(0, now(tx) - (r.leaseMs - LEASE_MS));
      const timing: Metric =
        elapsed <= 30_000
          ? 'completionLe30s'
          : elapsed <= 120_000
            ? 'completionLe120s'
            : 'completionOver120s';
      const source: Metric = !b!.seeded
        ? 'peerCompleted'
        : b!.starterKind === 'team'
          ? 'teamCompleted'
          : 'sampleCompleted';
      countActivity(tx, { [source]: 1, [timing]: 1 });
      tx.db.bottle.id.update({
        ...tx.db.bottle.id.find(b!.id)!,
        // Kept as the first return for compatibility; it does not consume the beginning.
        cardId: tx.db.bottle.id.find(b!.id)!.cardId || id,
      });
      saveRound(tx, {
        ...current,
        stage: 'done',
        cardId: id,
        inFlight: '',
        busyUntil: 0,
      });
    }
    const value = result(true);
    finishRequest(tx, qid, value);
    return value;
  });
}
const paidArgs = { roundId: t.string(), requestId: t.string(), text: t.string() };
function safePaidAction(
  ctx: Proc,
  args: { roundId: string; requestId: string; text: string },
  operation: 'setup' | 'reply' | 'nudge',
): Result {
  try {
    return paidAction(ctx, args, operation);
  } catch (error) {
    // Procedures do not expose reducer-style SenderError values. Return expected
    // application failures explicitly so callers never receive a module-fatal wrapper.
    return result(
      false,
      error instanceof SenderError
        ? error.message
        : 'We couldn’t complete that request. Your draft is saved.',
    );
  }
}
export const submit_setup = db.procedure(paidArgs, response, (ctx, args) =>
  safePaidAction(ctx, args, 'setup'),
);
export const submit_reply = db.procedure(paidArgs, response, (ctx, args) =>
  safePaidAction(ctx, args, 'reply'),
);
export const request_nudge = db.procedure(paidArgs, response, (ctx, args) =>
  safePaidAction(ctx, args, 'nudge'),
);

function excludedBeginnings(ctx: Tx, r: Round) {
  const excluded = new Set(JSON.parse(r.excluded) as string[]);
  // Skips and reports persist across the identity's rounds for this day.
  for (const previous of ctx.db.round.owner.filter(ctx.sender))
    if (previous.day === r.day) for (const id of JSON.parse(previous.excluded)) excluded.add(id);
  return excluded;
}
function bindBeginning(ctx: Tx, r: Round, found: Bottle) {
  saveRound(ctx, {
    ...r,
    stage: 'reply',
    assignmentId: found.id,
    leaseMs: now(ctx) + LEASE_MS,
    version: r.version + 1,
    hint: '',
    inFlight: '',
    busyUntil: 0,
  });
  countActivity(ctx, { catchAssigned: 1 });
}
function assign(ctx: Tx, r: Round) {
  if (r.day !== dayOf(now(ctx))) fail('This prompt has closed. Start today’s story.');
  const excluded = excludedBeginnings(ctx, r);
  const candidates = [...ctx.db.bottle.day.filter(r.day)].filter(
    (b) =>
      !b.hidden &&
      !b.seeded &&
      b.owner &&
      !same(b.owner, ctx.sender) &&
      !alreadyReplied(ctx, b.id) &&
      !excluded.has(b.id),
  );
  let found = candidates.length
    ? candidates[ctx.random.integerInRange(0, candidates.length - 1)]
    : undefined;
  if (!found) {
    const approved =
      ctx.env.DRIFT_STARTERS_HUMAN_WRITTEN === 'true' ? teamStartersFor(r.promptId) : [];
    const humanWritten = approved.length > 0;
    if (
      !humanWritten &&
      (ctx.env.DRIFT_DEV_MODE !== 'true' || ctx.env.DRIFT_DEV_STARTERS === 'false')
    )
      fail('No bottles are available just now. Your setup is safe; try again later.');
    const prompt = promptForDay(r.day);
    const available = (humanWritten ? approved : prompt.starters)
      .map((text, index) => ({ text, index }))
      .filter((s) => !excluded.has('seed:' + s.index));
    if (!available.length)
      fail('No bottles are available just now. Your setup is safe; try again later.');
    const seed = available[ctx.random.integerInRange(0, available.length - 1)];
    found = {
      id: newId(ctx),
      owner: undefined,
      day: r.day,
      promptId: r.promptId,
      text: seed.text,
      seeded: true,
      starterKind: humanWritten ? 'team' : 'sample',
      createdMs: now(ctx),
      seedIndex: seed.index,
      claimRound: '',
      claimVersion: 0,
      claimUntil: 0,
      cardId: '',
      hidden: false,
    };
    ctx.db.bottle.insert(found);
    publishBeginning(ctx, found);
  }
  bindBeginning(ctx, r, found);
}
export const pick_up_beginning = db.reducer({ beginningId: t.string() }, (ctx, { beginningId }) => {
  ready(ctx);
  const b = ctx.db.bottle.id.find(beginningId);
  if (!b || b.hidden || !ctx.db.beginning.id.find(beginningId))
    fail('This bottle is no longer available. Pick up another one.');
  if (b.owner && same(b.owner, ctx.sender))
    fail('This is your beginning. Invite someone else to finish it.');
  if (alreadyReplied(ctx, b.id)) fail('You’ve already finished this beginning.');
  const held = [...ctx.db.round.owner.filter(ctx.sender)].find(
    (r) => r.stage === 'reply' && r.assignmentId === b.id && r.leaseMs > now(ctx),
  );
  if (held) {
    unlocked(ctx, held);
    return; // Resume the same private assignment, without extending its deadline.
  }
  if (b.day !== dayOf(now(ctx)))
    fail('This beginning belongs to an earlier tide. Pick up today’s bottle.');
  const r = startRound(ctx, 'catch');
  unlocked(ctx, r);
  if (r.stage === 'reply' && r.leaseMs > now(ctx))
    fail('Your other bottle is still open. Finish it before opening this invitation.');
  const excluded = excludedBeginnings(ctx, r);
  if (excluded.has(b.seeded ? 'seed:' + b.seedIndex : b.id))
    fail('You’ve already passed this beginning. Pick up another one.');
  bindBeginning(ctx, r, b);
});
export const claim_bottle = db.reducer({ roundId: t.string() }, (ctx, { roundId }) => {
  ready(ctx);
  const r = currentRound(ctx, roundId);
  unlocked(ctx, r);
  if (r.stage === 'reply') {
    const b = ctx.db.bottle.id.find(r.assignmentId);
    if (b && !b.hidden && r.leaseMs > now(ctx) && !alreadyReplied(ctx, b.id)) return;
  } else if (r.stage !== 'catch') fail('Pick up a bottle to write an ending.');
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
      hideBeginning(ctx, b);
      release(ctx, r, true);
      return;
    }
    const a = ctx.db.authorship.id.find(cardId);
    if (!a || !ctx.db.postcard.id.find(cardId)) fail('This postcard is no longer available.');
    recordReport(ctx, cardId, reason);
    const vote = ctx.db.cardVote.id.find(`${cardId}:${ctx.sender.toHexString()}`);
    if (vote?.voted) ctx.db.cardVote.id.update({ ...vote, voted: false, updatedMs: now(ctx) });
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
    id: newId(ctx),
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
  removeCardScene(ctx, id);
  removeCardVotes(ctx, id);
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
export const withdraw_my_beginning = db.reducer({ bottleId: t.string() }, (ctx, { bottleId }) => {
  const b = ctx.db.bottle.id.find(bottleId);
  if (!b?.owner || !same(b.owner, ctx.sender))
    fail('Only the writer who released this beginning can withdraw it.');
  // Withdrawal remains available during a pause or an expired writing check.
  // Existing paid-result validation also rejects replies/hints after this hide.
  hideBeginning(ctx, b);
});
export const thank_co_writer = db.reducer({ cardId: t.string() }, (ctx, { cardId }) => {
  const a = ctx.db.authorship.id.find(cardId);
  const card = ctx.db.postcard.id.find(cardId);
  if (
    !a ||
    !card ||
    a.hidden ||
    !a.setupOwner ||
    card.seeded ||
    same(a.setupOwner, a.replyOwner) ||
    !(same(a.setupOwner, ctx.sender) || same(a.replyOwner, ctx.sender))
  )
    fail('This thank-you is only for the two writers of a shared postcard.');
  if (
    card.createdMs < now(ctx) - 30 * 86400000 ||
    [...ctx.db.report.owner.filter(ctx.sender)].some(
      (r) => r.target === cardId || r.target === card.beginningId,
    )
  )
    fail('This postcard is no longer available.');
  const field = same(a.setupOwner, ctx.sender) ? 'setupActions' : 'replyActions';
  if (a[field] & THANK_YOU_BIT) return;
  // Preserve existing private open/share flags without recording an analytics event.
  ctx.db.authorship.id.update({ ...a, [field]: a[field] | THANK_YOU_BIT });
});
export const set_card_vote = db.reducer(
  { cardId: t.string(), voted: t.bool() },
  (ctx, { cardId, voted }) => {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cardId)) fail('Invalid postcard identifier.');
    const key = `${cardId}:${ctx.sender.toHexString()}`;
    const existing = ctx.db.cardVote.id.find(key);
    if ((existing?.voted ?? false) === voted) return;
    const time = now(ctx);
    // Undo remains available during pauses, after verification expiry or after a removal.
    if (!voted) {
      if (existing) ctx.db.cardVote.id.update({ ...existing, voted: false, updatedMs: time });
      return;
    }
    const card = ctx.db.postcard.id.find(cardId);
    const author = ctx.db.authorship.id.find(cardId);
    if (
      !card ||
      !author ||
      author.hidden ||
      card.createdMs < time - 30 * 86400000 ||
      [...ctx.db.report.owner.filter(ctx.sender)].some(
        (row) => row.target === cardId || row.target === card.beginningId,
      )
    )
      fail('This postcard is no longer available.');
    ready(ctx);
    const day = dayOf(time),
      rate = ctx.db.voteRate.owner.find(ctx.sender);
    if (rate?.day === day && rate.used >= 100)
      fail('You’ve upvoted one hundred endings today. Read more and return with the next tide.');
    if (rate && time - rate.updatedMs < 250) fail('Let this upvote settle, then try again.');
    const nextRate = {
      owner: ctx.sender,
      day,
      used: rate?.day === day ? rate.used + 1 : 1,
      updatedMs: time,
    };
    if (rate) ctx.db.voteRate.owner.update(nextRate);
    else ctx.db.voteRate.insert(nextRate);
    const row = {
      id: key,
      cardId,
      owner: ctx.sender,
      voted: true,
      createdMs: existing?.createdMs ?? time,
      updatedMs: time,
    };
    if (existing) ctx.db.cardVote.id.update(row);
    else ctx.db.cardVote.insert(row);
  },
);
const voteTotal = t.row('VoteTotal', { cardId: t.string(), count: t.u32() });
export const card_vote_totals = db.view(
  { name: 'card_vote_totals', public: true },
  t.array(voteTotal),
  (ctx) => {
    const totals = new Map<string, number>();
    for (const row of ctx.db.cardVote.iter())
      if (row.voted && ctx.db.postcard.id.find(row.cardId))
        totals.set(row.cardId, (totals.get(row.cardId) ?? 0) + 1);
    return [...totals].map(([cardId, count]) => ({ cardId, count }));
  },
);
const myVote = t.row('MyVote', { cardId: t.string() });
export const my_card_votes = db.view(
  { name: 'my_card_votes', public: true },
  t.array(myVote),
  (ctx) =>
    [...ctx.db.cardVote.owner.filter(ctx.sender)]
      .filter((row) => row.voted && ctx.db.postcard.id.find(row.cardId))
      .map((row) => ({ cardId: row.cardId })),
);
function removeCardVotes(ctx: Tx, cardId: string) {
  for (const row of ctx.db.cardVote.cardId.filter(cardId)) ctx.db.cardVote.id.delete(row.id);
}
export const set_pause = db.reducer({ paused: t.bool() }, (ctx, { paused }) => {
  const c = admin(ctx);
  ctx.db.config.id.update({ ...c, paused });
});
export const set_dispatch_cap = db.reducer({ cap: t.u32() }, (ctx, { cap }) => {
  const c = admin(ctx);
  if (cap > 10000) fail('Use a dispatch cap of at most 10,000.');
  ctx.db.config.id.update({ ...c, dispatchCap: cap });
});
const adminStatusInfo = t.row('AdminStatusInfo', {
  dispatches: t.u32(),
  cap: t.u32(),
  paused: t.bool(),
  openReports: t.u32(),
  reviewSubmissions: t.u32(),
  failedModelCalls: t.u32(),
});
export const admin_status = db.procedure(adminStatusInfo, (ctx) =>
  ctx.withTx((tx) => {
    const c = admin(tx);
    const reports = [...tx.db.report.iter()].filter(
      (r) => !tx.db.reportResolution.reportId.find(r.id),
    );
    const requests = [...tx.db.request.iter()];
    return {
      dispatches: c.dispatches,
      cap: c.dispatchCap,
      paused: c.paused,
      openReports: reports.length,
      reviewSubmissions: requests.filter((r) => r.state === 'review').length,
      failedModelCalls: requests.filter(
        (r) => r.state.startsWith('model_') || r.state.startsWith('provider_http_'),
      ).length,
    };
  }),
);
const aiStatusInfo = t.row('AiStatusInfo', {
  priceVersion: t.string(),
  startedMs: t.f64(),
  olderDispatches: t.u32(),
  budgetMicros: t.u64(),
  spentEstimateMicros: t.u64(),
  reservedMicros: t.u64(),
  retainedCalls: t.u32(),
  settledCalls: t.u32(),
  uncertainCalls: t.u32(),
  pendingCalls: t.u32(),
  sandboxCalls: t.u32(),
  inputTokens: t.u64(),
  outputTokens: t.u64(),
  measuredCalls: t.u32(),
  p50Ms: t.f64(),
  p95Ms: t.f64(),
});
export const admin_ai_usage = db.procedure(aiStatusInfo, (ctx) =>
  ctx.withTx((tx) => {
    admin(tx);
    const budget = budgetFor(tx);
    const rows = [...tx.db.aiCall.iter()];
    const measured = rows
      .filter((r) => r.model !== 'sandbox' && r.durationKnown)
      .map((r) => r.elapsedMs);
    return {
      priceVersion: PRICE_VERSION,
      startedMs: budget.startedMs,
      olderDispatches: budget.olderDispatches,
      budgetMicros: budget.limitMicros,
      spentEstimateMicros: budget.spentMicros,
      reservedMicros: budget.reservedMicros,
      retainedCalls: rows.length,
      settledCalls: rows.filter((r) => r.state === 'settled' || r.state === 'reconciled').length,
      uncertainCalls: rows.filter((r) => r.state === 'uncertain').length,
      pendingCalls: rows.filter((r) => r.state === 'pending').length,
      sandboxCalls: rows.filter((r) => r.state === 'sandbox').length,
      inputTokens: rows.reduce((sum, r) => sum + BigInt(r.inputTokens), 0n),
      outputTokens: rows.reduce((sum, r) => sum + BigInt(r.outputTokens), 0n),
      measuredCalls: measured.length,
      p50Ms: percentile(measured, 0.5),
      p95Ms: percentile(measured, 0.95),
    };
  }),
);
export const admin_ai_calls = db.procedure(t.array(aiCall.rowType), (ctx) =>
  ctx.withTx((tx) => {
    admin(tx);
    return [...tx.db.aiCall.iter()].sort((a, b) => b.createdMs - a.createdMs).slice(0, 50);
  }),
);
export const set_ai_budget = db.reducer({ limitMicros: t.u64() }, (ctx, { limitMicros }) => {
  admin(ctx);
  if (limitMicros > MAX_BUDGET_MICROS) fail('Use an AI budget of at most $50.');
  const budget = budgetFor(ctx);
  ctx.db.aiBudget.id.update({ ...budget, limitMicros });
});
export const reconcile_ai_call = db.reducer(
  { costId: t.string(), chargedMicros: t.u64() },
  (ctx, { costId, chargedMicros }) => {
    admin(ctx);
    const row = ctx.db.aiCall.id.find(costId);
    if (!row) fail('This cost record is unavailable.');
    if (row.state === 'reconciled' && row.estimatedMicros === chargedMicros) return;
    if (!['pending', 'uncertain'].includes(row.state))
      fail('Only uncertain or stalled billing can be reconciled.');
    if (now(ctx) - row.createdMs < 60_000)
      fail('Keep the hold until the call is at least one minute old.');
    if (chargedMicros > MAX_BUDGET_MICROS) fail('Use a reconciled amount of at most $50.');
    const budget = budgetFor(ctx);
    ctx.db.aiBudget.id.update({
      ...budget,
      reservedMicros: budget.reservedMicros - row.heldMicros,
      spentMicros: budget.spentMicros + chargedMicros,
    });
    ctx.db.aiCall.id.update({
      ...row,
      state: 'reconciled',
      heldMicros: 0n,
      estimatedMicros: chargedMicros,
      finishedMs: row.finishedMs || now(ctx),
    });
  },
);
// A fixed synthetic owner health check verifies the real provider without publishing a test bottle.
export const admin_probe_claude = db.procedure({ kind: t.string() }, response, (ctx, { kind }) => {
  const reserved = ctx.withTx((tx) => {
    admin(tx);
    if (!['moderation', 'nudge'].includes(kind)) fail('Choose moderation or nudge.');
    if (!tx.env.ANTHROPIC_API_KEY) fail('Story checks are not connected.');
    if (
      [...tx.db.aiCall.iter()].some(
        (r) => r.operation.startsWith('probe_') && r.createdMs + 60_000 > now(tx),
      )
    )
      fail('Keep owner health checks at least one minute apart.');
    const work = modelRequest(
      kind as 'moderation' | 'nudge',
      {
        instructions: {
          setup: 'Why were you banned from the aquarium?',
          reply: 'Write the aquarium’s official response.',
        },
        setup: 'I challenged their shark to poker.',
        ...(kind === 'nudge' ? { draft: '' } : {}),
      },
      kind === 'nudge' ? tx.env.NUDGE_MODEL : tx.env.MODERATION_MODEL,
    );
    return { work, costId: reserveAiCall(tx, 'probe_' + kind, work) };
  });
  try {
    const checked = callClaude(ctx, kind as 'moderation' | 'nudge', reserved.work, reserved.costId);
    ctx.withTx((tx) => finishAiOutcome(tx, reserved.costId, 'probe_valid'));
    return result(
      true,
      'Synthetic provider check completed; nothing was published.',
      checked.hint ?? '',
    );
  } catch {
    ctx.withTx((tx) => finishAiOutcome(tx, reserved.costId, 'probe_error'));
    return result(false, 'We couldn’t finish that synthetic provider check.');
  }
});
const reportQueueItem = t.row('ReportQueueItem', {
  id: t.string(),
  reason: t.string(),
  content: t.string(),
  createdMs: t.f64(),
});
export const admin_reports = db.procedure(t.array(reportQueueItem), (ctx) =>
  ctx.withTx((tx) => {
    admin(tx);
    return [...tx.db.report.iter()]
      .filter((r) => !tx.db.reportResolution.reportId.find(r.id))
      .sort((a, b) => a.createdMs - b.createdMs)
      .slice(0, 50)
      .map((r) => {
        const card = tx.db.postcard.id.find(r.target);
        const b = tx.db.bottle.id.find(r.target);
        return {
          id: r.id,
          reason: r.reason,
          content: card
            ? card.setup + ' / ' + card.reply
            : (b?.text ?? '[Content no longer retained]'),
          createdMs: r.createdMs,
        };
      });
  }),
);
export const resolve_report = db.reducer(
  { reportId: t.string(), decision: t.string() },
  (ctx, { reportId, decision }) => {
    admin(ctx);
    if (!['dismiss', 'hide'].includes(decision)) fail('Choose dismiss or hide.');
    const r = ctx.db.report.id.find(reportId);
    if (!r) fail('This report is no longer available.');
    const b = ctx.db.bottle.id.find(r.target);
    if (b) {
      if (decision === 'hide') hideBeginning(ctx, b);
      else {
        ctx.db.bottle.id.update({ ...b, hidden: false });
        publishBeginning(ctx, b);
      }
    }
    if (decision === 'hide' && !b) {
      const a = ctx.db.authorship.id.find(r.target);
      if (a) {
        ctx.db.postcard.id.delete(a.id);
        removeCardScene(ctx, a.id);
        removeCardVotes(ctx, a.id);
        ctx.db.authorship.id.update({ ...a, hidden: true });
        ctx.db.hello.cardId.delete(a.id);
      }
    }
    const row = { reportId, decision, resolvedMs: now(ctx) };
    if (ctx.db.reportResolution.reportId.find(reportId))
      ctx.db.reportResolution.reportId.update(row);
    else ctx.db.reportResolution.insert(row);
  },
);
function purgeExpired(ctx: Tx) {
  const cutoff = now(ctx) - 30 * 86400000;
  for (const row of ctx.db.activityDay.iter())
    if (row.day <= dayOf(now(ctx)) - 30) ctx.db.activityDay.id.delete(row.id);
  for (const c of ctx.db.postcard.iter())
    if (c.createdMs < cutoff) {
      ctx.db.postcard.id.delete(c.id);
      removeCardScene(ctx, c.id);
      removeCardVotes(ctx, c.id);
      ctx.db.authorship.id.delete(c.id);
      ctx.db.hello.cardId.delete(c.id);
    }
  for (const vote of ctx.db.cardVote.iter())
    if (!ctx.db.postcard.id.find(vote.cardId)) ctx.db.cardVote.id.delete(vote.id);
  for (const rate of ctx.db.voteRate.iter())
    if (rate.updatedMs < cutoff) ctx.db.voteRate.owner.delete(rate.owner);
  for (const q of ctx.db.request.iter())
    if (q.createdMs < now(ctx) - 7 * 86400000) ctx.db.request.id.delete(q.id);
  for (const scene of ctx.db.postcardScene.iter())
    if (!ctx.db.postcard.id.find(scene.cardId)) removeCardScene(ctx, scene.cardId);
  for (const status of ctx.db.postcardSceneStatus.iter())
    if (!ctx.db.postcard.id.find(status.cardId)) removeCardScene(ctx, status.cardId);
  for (const job of ctx.db.sceneJob.iter()) {
    if (!ctx.db.postcard.id.find(job.cardId)) {
      removeCardScene(ctx, job.cardId);
      continue;
    }
    expireSceneAttempt(ctx, job);
    const next = ctx.db.sceneJob.cardId.find(job.cardId)!;
    if (
      (next.state === 'ready' || next.state === 'failed') &&
      next.costId &&
      next.createdMs < now(ctx) - 7 * 86400000
    )
      ctx.db.sceneJob.cardId.update({ ...next, costId: '' });
  }
  for (const scheduled of ctx.db.sceneSchedule.iter())
    if (!ctx.db.sceneJob.cardId.find(scheduled.cardId))
      ctx.db.sceneSchedule.scheduledId.delete(scheduled.scheduledId);
  // Completed anonymous cost rows expire after 30 days; totals survive. Unknown holds
  // remain until owner reconciliation and contain no text or participant identity.
  for (const row of ctx.db.aiCall.iter())
    if (row.createdMs < cutoff && row.heldMicros === 0n && row.state !== 'pending')
      ctx.db.aiCall.id.delete(row.id);
  for (const b of ctx.db.bottle.iter())
    if ((b.createdMs || b.day * 86400000) < cutoff) {
      ctx.db.bottle.id.delete(b.id);
      ctx.db.beginning.id.delete(b.id);
    }
  for (const r of ctx.db.report.iter())
    if (r.createdMs < cutoff) {
      ctx.db.report.id.delete(r.id);
      ctx.db.reportResolution.reportId.delete(r.id);
    }
  for (const r of ctx.db.round.iter())
    if (r.day < dayOf(now(ctx)) - 30) ctx.db.round.id.delete(r.id);
  // Hidden cards have already lost their public row. Clean these mappings too.
  for (const a of ctx.db.authorship.iter())
    if (!ctx.db.postcard.id.find(a.id)) {
      ctx.db.authorship.id.delete(a.id);
      removeCardScene(ctx, a.id);
      removeCardVotes(ctx, a.id);
      ctx.db.hello.cardId.delete(a.id);
    }
  for (const h of ctx.db.hello.iter())
    if (h.expiresMs <= now(ctx)) ctx.db.hello.cardId.delete(h.cardId);
  for (const pass of ctx.db.shorePass.iter())
    if (pass.expiresMs <= now(ctx)) ctx.db.shorePass.owner.delete(pass.owner);
}
export const purge_old_data = db.reducer((ctx) => {
  admin(ctx);
  purgeExpired(ctx);
});
export const retire_bottle = db.reducer({ bottleId: t.string() }, (ctx, { bottleId }) => {
  admin(ctx);
  const b = ctx.db.bottle.id.find(bottleId);
  if (!b) return;
  hideBeginning(ctx, b);
  ctx.db.bottle.id.update({
    ...ctx.db.bottle.id.find(b.id)!,
    hidden: true,
    text: '',
  });
});
export const maintenance_tick = db.reducer(
  { onSchedule: maintenance },
  { arg: maintenance.rowType },
  (ctx) => {
    purgeExpired(ctx);
    refresh(ctx);
  },
);

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
  starterKind: t.string(),
});
export const my_assignment = db.view(
  { name: 'my_assignment', public: true },
  t.array(assigned),
  (ctx) => {
    const result = [];
    for (const r of ctx.db.round.owner.filter(ctx.sender)) {
      if (r.stage !== 'reply') continue;
      const b = ctx.db.bottle.id.find(r.assignmentId);
      if (b && !b.hidden)
        result.push({
          id: b.id,
          text: b.text,
          seeded: b.seeded,
          leaseMs: r.leaseMs,
          roundId: r.id,
          starterKind: b.seeded ? b.starterKind : 'none',
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
const appreciation = t.row('Appreciation', {
  cardId: t.string(),
  sent: t.bool(),
  received: t.bool(),
});
export const my_appreciation = db.view(
  { name: 'my_appreciation', public: true },
  t.array(appreciation),
  (ctx) => {
    const rows = [];
    const reported = new Set([...ctx.db.report.owner.filter(ctx.sender)].map((r) => r.target));
    for (const a of ctx.db.authorship.iter()) {
      if (
        a.hidden ||
        !a.setupOwner ||
        same(a.setupOwner, a.replyOwner) ||
        !(same(a.setupOwner, ctx.sender) || same(a.replyOwner, ctx.sender))
      )
        continue;
      const card = ctx.db.postcard.id.find(a.id);
      if (!card || card.seeded || reported.has(card.id) || reported.has(card.beginningId)) continue;
      const isSetup = same(a.setupOwner, ctx.sender);
      rows.push({
        cardId: card.id,
        sent: !!((isSetup ? a.setupActions : a.replyActions) & THANK_YOU_BIT),
        received: !!((isSetup ? a.replyActions : a.setupActions) & THANK_YOU_BIT),
      });
    }
    return rows;
  },
);
// Separate additive view: existing clients keep the original my_cards wire shape.
// The open bit is recorded only when the author's full postcard is visible.
const unopenedReturn = t.row('UnopenedReturn', { id: t.string() });
export const my_unopened_returns = db.view(
  { name: 'my_unopened_returns', public: true },
  t.array(unopenedReturn),
  (ctx) => {
    const rows = [];
    for (const a of ctx.db.authorship.iter()) {
      if (
        a.setupOwner &&
        same(a.setupOwner, ctx.sender) &&
        !a.hidden &&
        !(a.setupActions & CARD_ACTIONS.open) &&
        ctx.db.postcard.id.find(a.id)
      )
        rows.push({ id: a.id });
    }
    return rows;
  },
);
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
      if (b && !b.hidden) rows.push({ id: b.id, text: b.text, cardId: b.cardId, day: b.day });
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
  botRequired: t.bool(),
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
        botRequired: !!ctx.env.DRIFT_TURNSTILE_SECRET,
      },
    ];
  },
);
