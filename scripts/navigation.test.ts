import test from 'node:test';
import assert from 'node:assert/strict';
import {
  driftHistoryState,
  driftRouteUrl,
  readDriftRoute,
  sameDriftRoute,
  type DriftRoute,
} from '../apps/web/src/navigation';
import { confirmedAction } from '../apps/web/src/confirmed-action';

test('deep links take precedence over private history and reject ambiguous, malformed or oversized IDs', () => {
  const privateState = driftHistoryState({ view: 'play', roundId: 'private-round' });
  assert.deepEqual(readDriftRoute('?card=pair-1', privateState), {
    view: 'card',
    cardId: 'pair-1',
  });
  assert.deepEqual(readDriftRoute('?bottle=beginning_1', privateState), {
    view: 'beginning',
    beginningId: 'beginning_1',
  });
  assert.deepEqual(readDriftRoute('?view=bottles', privateState), { view: 'collection' });
  for (const query of [
    '?card=one&card=two',
    '?card=one&bottle=two',
    '?card=',
    '?card=%3Cscript%3E',
    '?view=play',
    `?card=${'a'.repeat(129)}`,
  ]) {
    assert.deepEqual(readDriftRoute(query, privateState), { view: 'today' });
  }
});
test('private play survives same-entry reload without a round ID or draft in the URL', () => {
  const route: DriftRoute = { view: 'play', roundId: 'private-round' };
  assert.equal(driftRouteUrl('/', route), '/');
  assert.deepEqual(readDriftRoute('', driftHistoryState(route)), route);
  assert.deepEqual(readDriftRoute('', null), { view: 'today' });
  assert.deepEqual(
    readDriftRoute('', {
      __driftNavigation: { version: 9, view: 'play', roundId: 'private-round' },
    }),
    { view: 'today' },
  );
  assert.deepEqual(
    readDriftRoute('', { __driftNavigation: { version: 1, view: 'play', roundId: '../bad' } }),
    { view: 'today' },
  );
  assert.equal(JSON.stringify(driftHistoryState(route)).includes('draft'), false);
});
test('route snapshots restore exact public targets and Home independently through browser history', () => {
  const routes: DriftRoute[] = [
    { view: 'today' },
    { view: 'beginning', beginningId: 'b-1' },
    { view: 'play', roundId: 'private-1' },
    { view: 'card', cardId: 'pair-2' },
    { view: 'beginning', beginningId: 'b-1' },
    { view: 'collection' },
    { view: 'today' },
  ];
  const entries = routes.map((route) => ({
    url: driftRouteUrl('/game/', route),
    state: driftHistoryState(route),
  }));
  for (const index of [6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6]) {
    const entry = entries[index];
    const recovered = readDriftRoute(new URL(entry.url, 'https://drift.test').search, entry.state);
    assert.deepEqual(recovered, routes[index]);
  }
  assert.equal(sameDriftRoute(routes[3], { view: 'card', cardId: 'pair-3' }), false);
});

function fixture() {
  let state: { connected: boolean; roundId?: string } = { connected: true };
  const listeners = new Set<() => void>();
  return {
    get state() {
      return state;
    },
    listeners,
    set(next: typeof state) {
      state = next;
      for (const listener of listeners) listener();
    },
    options: {
      snapshot: () => state,
      subscribe: (check: () => void) => {
        listeners.add(check);
        return () => {
          listeners.delete(check);
        };
      },
      read: (current: typeof state) => (current.connected ? current.roundId : undefined),
      message: 'Could not confirm the round.',
      timeoutMs: 25,
    },
  };
}
test('a subscribed committed round resolves even when its reducer acknowledgement never arrives', async () => {
  const f = fixture();
  let calls = 0;
  const value = confirmedAction({
    ...f.options,
    act: () => {
      calls++;
      f.set({ connected: true, roundId: 'same-daily-round' });
      return new Promise(() => {});
    },
  });
  assert.equal(await value, 'same-daily-round');
  assert.equal(calls, 1);
  assert.equal(f.listeners.size, 0);
});
test('an existing authoritative round is resumed without dispatching another start', async () => {
  const f = fixture();
  f.set({ connected: true, roundId: 'already-started' });
  let calls = 0;
  assert.equal(
    await confirmedAction({
      ...f.options,
      act: async () => {
        calls++;
      },
    }),
    'already-started',
  );
  assert.equal(calls, 0);
  assert.equal(f.listeners.size, 0);
});
test('a start error or deadline without a committed round rejects and cleans its listener', async () => {
  const failed = fixture();
  await assert.rejects(
    confirmedAction({
      ...failed.options,
      act: async () => {
        throw Error('Start denied.');
      },
    }),
    /Start denied/,
  );
  assert.equal(failed.listeners.size, 0);
  const lost = fixture();
  await assert.rejects(
    confirmedAction({ ...lost.options, act: () => new Promise(() => {}) }),
    /Could not confirm/,
  );
  assert.equal(lost.listeners.size, 0);
});
test('acknowledgement alone and disconnected cached rows cannot manufacture confirmation', async () => {
  const f = fixture();
  f.set({ connected: false, roundId: 'stale-round' });
  await assert.rejects(confirmedAction({ ...f.options, act: async () => {} }), /Could not confirm/);
  assert.equal(f.listeners.size, 0);
});
