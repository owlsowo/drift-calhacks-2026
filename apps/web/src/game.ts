import { DbConnection } from './module_bindings';
import type {
  Round,
  Assignment,
  OwnedCard,
  Outgoing,
  Postcard,
  ServiceInfo,
  HelloAvailability,
  ReportedCard,
} from './module_bindings/types';
export type Snapshot = {
  connected: boolean;
  connecting: boolean;
  error: string;
  identity: string;
  clockOffsetMs: number;
  rounds: Round[];
  assignments: Assignment[];
  ownership: OwnedCard[];
  outgoing: Outgoing[];
  cards: Postcard[];
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
  clockOffsetMs: 0,
  rounds: [],
  assignments: [],
  ownership: [],
  outgoing: [],
  cards: [],
  hellos: [],
  reported: [],
};
let state = blank;
let connection: DbConnection | undefined;
const listeners = new Set<() => void>();
let queued = false;
const database = import.meta.env.VITE_SPACETIMEDB_DATABASE || 'drift-local';
const host =
  import.meta.env.VITE_SPACETIMEDB_HOST || `${location.protocol}//${location.hostname}:3000`;
const tokenKey = `drift:${host}:${database}:identity`;
const read = (key: string) => {
  try {
    return localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
};
export const persist = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Play remains possible when storage is unavailable. */
  }
};
export const saved = (key: string) => read(key) || '';
function emit(patch: Partial<Snapshot> = {}) {
  if (connection?.isActive) {
    state = {
      ...state,
      ...patch,
      rounds: [...connection.db.myRound.iter()],
      assignments: [...connection.db.myAssignment.iter()],
      ownership: [...connection.db.myCards.iter()],
      outgoing: [...connection.db.myOutgoing.iter()],
      cards: [...connection.db.postcard.iter()],
      hellos: [...connection.db.myHello.iter()],
      reported: [...connection.db.myReportedCards.iter()],
      service: [...connection.db.serviceStatus.iter()][0],
      today: [...connection.db.today.iter()][0],
    };
  } else state = { ...state, ...patch };
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
  connection = DbConnection.builder()
    .withUri(host)
    .withDatabaseName(database)
    .withToken(read(tokenKey))
    .withAutomaticReconnect({})
    .onConnect((conn, identity, token) => {
      persist(tokenKey, token);
      state = { ...state, identity: identity.toHexString() };
      for (const table of [
        conn.db.myRound,
        conn.db.myAssignment,
        conn.db.myCards,
        conn.db.myOutgoing,
        conn.db.postcard,
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
        .onApplied(() => emit({ connected: true, connecting: false, error: '' }))
        .onError(() =>
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
          'SELECT * FROM my_outgoing',
          'SELECT * FROM postcard',
          'SELECT * FROM service_status',
          'SELECT * FROM today',
          'SELECT * FROM my_hello',
          'SELECT * FROM my_reported_cards',
        ]);
      void syncClock(conn);
    })
    .onAutomaticReconnect((_conn, identity, token) => {
      persist(tokenKey, token);
      emit({
        identity: identity.toHexString(),
        connected: false,
        connecting: true,
        error: 'Restoring your bottle…',
      });
      if (connection) void syncClock(connection);
    })
    .onConnectError(() =>
      emit({
        connected: false,
        connecting: false,
        error: 'The shore is out of reach. Your draft stays here.',
      }),
    )
    .onDisconnect(() =>
      emit({
        connected: false,
        connecting: true,
        error: 'Reconnecting. Your words are safe here.',
      }),
    )
    .build();
}
export const game = {
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
    emit({ connecting: true, error: '' });
    connect();
  },
  async start() {
    if (!connection?.isActive) throw Error('Connect before starting your story.');
    await connection.reducers.startRound({});
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
  async report(roundId: string, cardId: string, reason: string) {
    await connection!.reducers.reportContent({ roundId, cardId, reason });
  },
  async paid(operation: 'setup' | 'reply' | 'nudge', roundId: string, text: string) {
    if (!connection?.isActive) throw Error('You’re offline. Your draft is saved.');
    const key = `drift:request:${state.identity}:${operation}:${roundId}`;
    let prior: { text: string; id: string } | undefined;
    try {
      prior = JSON.parse(saved(key));
    } catch {
      /* First dispatch. */
    }
    const requestId = prior?.text === text ? prior.id : crypto.randomUUID();
    persist(key, JSON.stringify({ text, id: requestId }));
    const args = { roundId, requestId, text };
    const value =
      operation === 'setup'
        ? await connection.procedures.submitSetup(args)
        : operation === 'reply'
          ? await connection.procedures.submitReply(args)
          : await connection.procedures.requestNudge(args);
    if (!value.message.includes('pending or uncertain')) persist(key, '');
    if (!value.ok) throw Error(value.message);
    return value;
  },
};
setInterval(() => {
  void game.refresh().catch(() => {});
}, 60000);
if (import.meta.hot) import.meta.hot.dispose(() => connection?.disconnect());
