import './csp-serialization';
import { DbConnection } from './module_bindings';
import { encodeDraft, decodeDraft } from './drafts';
import type { CardAction } from '../../../packages/activity/index';
import {
  emptyBook,
  loadBottleBook,
  mergeBook,
  saveBottleBook,
  type BottleBook,
} from './bottle-book';
import type {
  Round,
  Assignment,
  OwnedCard,
  Outgoing,
  Postcard,
  ServiceInfo,
  HelloAvailability,
  ReportedCard,
  Beginning,
  UnopenedReturn,
} from './module_bindings/types';
export type Snapshot = {
  connected: boolean;
  connecting: boolean;
  error: string;
  identity: string;
  storageAvailable: boolean;
  clockOffsetMs: number;
  rounds: Round[];
  assignments: Assignment[];
  ownership: OwnedCard[];
  unopenedReturns: UnopenedReturn[];
  outgoing: Outgoing[];
  cards: Postcard[];
  beginnings: Beginning[];
  book: BottleBook;
  bookStored: boolean;
  hellos: HelloAvailability[];
  reported: ReportedCard[];
  service?: ServiceInfo;
  today?: { day: number; promptJson: string };
};
const blank: Snapshot = {
  connected: false,
  connecting: true,
  error: '',
  identity: '',
  storageAvailable: true,
  clockOffsetMs: 0,
  rounds: [],
  assignments: [],
  ownership: [],
  unopenedReturns: [],
  outgoing: [],
  cards: [],
  beginnings: [],
  book: emptyBook(),
  bookStored: true,
  hellos: [],
  reported: [],
};
let state = blank;
let connection: DbConnection | undefined;
const listeners = new Set<() => void>();
const reportedActions = new Set<string>();
let queued = false;
const database = import.meta.env.VITE_SPACETIMEDB_DATABASE || 'drift-local';
const host =
  import.meta.env.VITE_SPACETIMEDB_HOST || `${location.protocol}//${location.hostname}:3000`;
const tokenKey = `drift:${host}:${database}:identity`;
const bookScope = `${host}:${database}`;
state = { ...state, book: loadBottleBook(bookScope) };
const memory = new Map<string, string>();
function storageUnavailable() {
  if (state.storageAvailable) emit({ storageAvailable: false });
}
const read = (key: string) => {
  if (memory.has(key)) return memory.get(key) || undefined;
  try {
    return localStorage.getItem(key) || undefined;
  } catch {
    storageUnavailable();
    return undefined;
  }
};
const hasRetainedText = (key: string) =>
  key.startsWith('drift:draft:') || key.startsWith('drift:request:');
export const persist = (key: string, value: string) => {
  if (hasRetainedText(key)) value = encodeDraft(value);
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    storageUnavailable();
  }
};
export const saved = (key: string) => {
  const raw = read(key) || '';
  if (!raw || !hasRetainedText(key)) return raw;
  const item = decodeDraft(raw);
  if (item.expired) {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      storageUnavailable();
    }
    return '';
  }
  if (item.legacy) persist(key, item.text);
  return item.text;
};
function forget(key: string) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    storageUnavailable();
  }
}
function pruneLocalText() {
  const keys = new Set(memory.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.add(key);
    }
  } catch {
    storageUnavailable();
  }
  for (const key of keys) if (hasRetainedText(key)) saved(key);
}
export function localDrafts(identity: string) {
  if (!identity) return [];
  const prefix = `drift:draft:${identity}:`;
  const keys = new Set(memory.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.add(key);
    }
  } catch {
    storageUnavailable();
  }
  return [...keys]
    .filter((key) => key.startsWith(prefix))
    .flatMap((key) => {
      const text = saved(key);
      return text.trim() ? [{ key, text }] : [];
    });
}
function emit(patch: Partial<Snapshot> = {}) {
  if (connection?.isActive) {
    state = {
      ...state,
      ...patch,
      rounds: [...connection.db.myRound.iter()],
      assignments: [...connection.db.myAssignment.iter()],
      ownership: [...connection.db.myCards.iter()],
      unopenedReturns: [...connection.db.myUnopenedReturns.iter()],
      outgoing: [...connection.db.myOutgoing.iter()],
      cards: [...connection.db.postcard.iter()],
      beginnings: [...connection.db.beginning.iter()],
      hellos: [...connection.db.myHello.iter()],
      reported: [...connection.db.myReportedCards.iter()],
      service: [...connection.db.serviceStatus.iter()][0],
      today: [...connection.db.today.iter()][0],
    };
  } else state = { ...state, ...patch };
  const book = mergeBook(mergeBook(state.book, loadBottleBook(bookScope)), {
    beginningIds: [
      ...state.outgoing.map((beginning) => beginning.id),
      ...state.ownership
        .filter((item) => item.role === 'setup' && !item.hidden)
        .flatMap((item) => {
          const id = state.cards.find((card) => card.id === item.id)?.beginningId;
          return id ? [id] : [];
        }),
    ],
    pairIds: state.ownership.filter((item) => item.role === 'reply').map((item) => item.id),
  });
  if (
    JSON.stringify(book) !== JSON.stringify(state.book) ||
    (!state.bookStored && state.connected)
  ) {
    state = { ...state, book, bookStored: saveBottleBook(bookScope, book) };
  }
  for (const listener of listeners) listener();
}
function schedule() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    emit();
  });
}
async function syncClock(conn: DbConnection) {
  const start = Date.now();
  try {
    const server = await conn.procedures.serverTime({});
    const offset = server - (start + Date.now()) / 2;
    if (connection === conn && conn.isActive) emit({ clockOffsetMs: offset });
  } catch {
    /* The server still enforces all deadlines if clock synchronization fails. */
  }
}
function connect() {
  if (connection) return;
  pruneLocalText();
  connection = DbConnection.builder()
    .withUri(host)
    .withDatabaseName(database)
    .withToken(read(tokenKey))
    .withAutomaticReconnect({})
    .onConnect((conn, identity, token) => {
      if (connection !== conn) return;
      persist(tokenKey, token);
      state = { ...state, identity: identity.toHexString() };
      for (const table of [
        conn.db.myRound,
        conn.db.myAssignment,
        conn.db.myCards,
        conn.db.myUnopenedReturns,
        conn.db.myOutgoing,
        conn.db.postcard,
        conn.db.beginning,
        conn.db.serviceStatus,
        conn.db.today,
        conn.db.myHello,
        conn.db.myReportedCards,
      ]) {
        table.onInsert(schedule);
        table.onDelete(schedule);
        table.onUpdate(schedule);
      }
      conn
        .subscriptionBuilder()
        .onApplied(() => {
          if (connection === conn && conn.isActive)
            emit({ connected: true, connecting: false, error: '' });
        })
        .onError(
          () =>
            connection === conn &&
            emit({
              error: 'Your connection needs a moment. Your draft is saved.',
              connected: false,
              connecting: false,
            }),
        )
        .subscribe([
          'SELECT * FROM my_round',
          'SELECT * FROM my_assignment',
          'SELECT * FROM my_cards',
          'SELECT * FROM my_unopened_returns',
          'SELECT * FROM my_outgoing',
          'SELECT * FROM postcard',
          'SELECT * FROM beginning',
          'SELECT * FROM service_status',
          'SELECT * FROM today',
          'SELECT * FROM my_hello',
          'SELECT * FROM my_reported_cards',
        ]);
      void syncClock(conn);
    })
    .onAutomaticReconnect((conn, identity, token) => {
      if (connection !== conn) return;
      persist(tokenKey, token);
      emit({
        identity: identity.toHexString(),
        connected: false,
        connecting: true,
        error: 'Restoring your bottle…',
      });
      if (connection) void syncClock(connection);
    })
    .onConnectError(
      (conn) =>
        connection === conn &&
        emit({
          connected: false,
          connecting: false,
          error: 'The shore is out of reach. Your draft stays here.',
        }),
    )
    .onDisconnect(
      (conn) =>
        connection === conn &&
        emit({
          connected: false,
          connecting: true,
          error: 'Reconnecting. Your words are safe here.',
        }),
    )
    .build();
}
function waitForRound(kind: 'write' | 'catch'): Promise<string> {
  const find = () =>
    state.rounds.find((round) =>
      kind === 'write'
        ? round.stage === 'write' && round.day === state.today?.day
        : (round.stage === 'catch' && round.day === state.today?.day) ||
          (round.stage === 'reply' &&
            (round.day === state.today?.day || round.leaseMs > Date.now() + state.clockOffsetMs)),
    )?.id;
  const existing = find();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      listeners.delete(check);
      reject(Error('Your bottle is taking a moment. Try the same action again.'));
    }, 10000);
    const check = () => {
      const id = find();
      if (id) {
        clearTimeout(timer);
        listeners.delete(check);
        resolve(id);
      }
    };
    listeners.add(check);
    check();
  });
}
export const game = {
  async cardAction(cardId: string, action: CardAction) {
    if (!connection?.isActive || !state.identity) return;
    const key = `${state.identity}:${cardId}:${action}`;
    if (reportedActions.has(key)) return;
    reportedActions.add(key);
    try {
      await connection.reducers.recordCardAction({ cardId, action });
    } catch {
      // Best effort: diagnostics never turn a successful reading/export into an error.
      // The server also deduplicates, so a later view/reconnect can safely try again.
      reportedActions.delete(key);
    }
  },
  async setHello(cardId: string, accepted: boolean) {
    if (!connection?.isActive) throw Error('Reconnect before changing your invitation.');
    await connection.reducers.setHelloIntent({ cardId, accepted });
  },
  async helloInfo(cardId: string) {
    if (!connection?.isActive) throw Error('Reconnect to see your invitation.');
    return connection.procedures.getHello({ cardId });
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    connect();
    return () => {
      listeners.delete(fn);
    };
  },
  snapshot: () => state,
  reconnect() {
    connection?.disconnect();
    connection = undefined;
    emit({ connected: false, connecting: true, error: '' });
    connect();
  },
  async start() {
    if (!connection?.isActive) throw Error('Connect before starting your story.');
    await connection.reducers.startRound({});
    return waitForRound('write');
  },
  async startCatching() {
    if (!connection?.isActive) throw Error('Connect before catching a bottle.');
    await connection.reducers.startCatching({});
    return waitForRound('catch');
  },
  async startInvited(beginningId: string) {
    if (!connection?.isActive) throw Error('Connect before opening this invitation.');
    await connection.reducers.pickUpBeginning({ beginningId });
    return waitForRound('catch');
  },
  async verifyGate(token: string) {
    if (!connection?.isActive) throw Error('Reconnect before verifying your shore check.');
    const value = await connection.procedures.verifyShore({ token });
    if (!value.ok) throw Error(value.message);
  },
  async refresh() {
    if (connection?.isActive)
      await Promise.all([connection.reducers.refreshDay({}), syncClock(connection)]);
  },
  async claim(roundId: string) {
    await connection!.reducers.claimBottle({ roundId });
  },
  async skip(roundId: string) {
    await connection!.reducers.skipBottle({ roundId });
  },
  async abandon(roundId: string) {
    await connection!.reducers.abandonRound({ roundId });
  },
  async hide(cardId: string) {
    await connection!.reducers.hideMyCard({ cardId });
  },
  async withdraw(bottleId: string) {
    if (!connection?.isActive) throw Error('Reconnect before withdrawing your bottle.');
    await connection.reducers.withdrawMyBeginning({ bottleId });
  },
  async report(roundId: string, cardId: string, reason: string) {
    await connection!.reducers.reportContent({ roundId, cardId, reason });
  },
  async paid(operation: 'setup' | 'reply' | 'nudge', roundId: string, text: string) {
    if (!connection?.isActive) throw Error('You’re offline. Your draft is saved.');
    const round = state.rounds.find((item) => item.id === roundId);
    if (operation !== 'setup' && !round)
      throw Error('Your bottle is still arriving. Reconnect and try again.');
    const context = operation === 'setup' ? undefined : `${round!.assignmentId}:${round!.version}`;
    const key = `drift:request:${state.identity}:${operation}:${roundId}`;
    let prior: { text: string; id: string; context?: string } | undefined;
    try {
      const item = JSON.parse(saved(key));
      if (
        typeof item?.text === 'string' &&
        typeof item?.id === 'string' &&
        /^[a-f0-9-]{36}$/i.test(item.id)
      )
        prior = item;
    } catch {
      /* First dispatch. */
    }
    // Legacy records keep their ID for one server-validated replay; never redispatch an
    // uncertain same-assignment request just because its old cache lacks metadata.
    const requestId =
      prior?.text === text && (prior.context === undefined || prior.context === context)
        ? prior.id
        : crypto.randomUUID();
    persist(key, JSON.stringify({ text, id: requestId, context }));
    const args = { roundId, requestId, text };
    const value =
      operation === 'setup'
        ? await connection.procedures.submitSetup(args)
        : operation === 'reply'
          ? await connection.procedures.submitReply(args)
          : await connection.procedures.requestNudge(args);
    if (!value.message.includes('pending or uncertain')) {
      try {
        // A late response must not erase a newer assignment's pending retry record.
        if (JSON.parse(saved(key)).id === requestId) forget(key);
      } catch {
        /* Another completed action may already have removed its record. */
      }
    }
    if (!value.ok) throw Error(value.message);
    return value;
  },
};
setInterval(() => {
  pruneLocalText();
  void game.refresh().catch(() => {});
}, 60000);
if (import.meta.hot) import.meta.hot.dispose(() => connection?.disconnect());
