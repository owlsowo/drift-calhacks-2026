import { DbConnection } from '../apps/web/src/module_bindings';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const host = process.env.DRIFT_TEST_HOST || 'http://127.0.0.1:3000';
const database = process.env.DRIFT_TEST_DATABASE || 'drift-local';
// This test writes synthetic records. Never point it at an attendee database.
if (!/localhost|127\.0\.0\.1/.test(new URL(host).hostname))
  throw Error('Use a local test database.');
type Client = { connection: DbConnection; token: string };
const clients: Client[] = [];
const checks: string[] = [];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn: () => boolean) {
  const deadline = Date.now() + 8000;
  while (!fn()) {
    if (Date.now() > deadline) throw Error('Timed out waiting for authoritative state.');
    await pause(20);
  }
}
async function connect(token?: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(database)
      .withToken(token)
      .onConnect((conn, _identity, issued) => {
        conn
          .subscriptionBuilder()
          .onApplied(() => {
            const client = { connection: conn, token: issued };
            clients.push(client);
            resolve(client);
          })
          .onError(() => reject(Error('Test subscription failed.')))
          .subscribe([
            'SELECT * FROM my_round',
            'SELECT * FROM my_assignment',
            'SELECT * FROM my_outgoing',
            'SELECT * FROM my_cards',
            'SELECT * FROM postcard',
            'SELECT * FROM service_status',
          ]);
      })
      .onConnectError(() => reject(Error('Local database is unavailable.')))
      .build();
    setTimeout(() => {
      if (!connection.isActive) reject(Error('Connection timed out.'));
    }, 8000).unref();
  });
}
const ownRound = (c: Client) =>
  [...c.connection.db.myRound.iter()].find((r) => r.stage !== 'done')!;
const assignment = (c: Client) => [...c.connection.db.myAssignment.iter()][0];
const pass = (name: string) => {
  checks.push(name);
  console.log('PASS', name);
};
try {
  const writers = await Promise.all(Array.from({ length: 10 }, () => connect()));
  assert.ok(
    writers.every((c) => [...c.connection.db.serviceStatus.iter()][0]?.sandbox),
    'Run only in the explicitly marked local sandbox.',
  );
  await Promise.all(writers.map((c) => c.connection.reducers.startRound({})));
  await Promise.all(writers.map((c) => waitFor(() => !!ownRound(c))));
  const setupResults = await Promise.all(
    writers.map((c, i) =>
      c.connection.procedures.submitSetup({
        roundId: ownRound(c).id,
        requestId: crypto.randomUUID(),
        text: `I gave octopus ${i} tax advice.`,
      }),
    ),
  );
  setupResults.forEach((response, i) =>
    assert.equal(response.ok, true, `Writer ${i}: ${response.message}`),
  );
  await Promise.all(writers.map((c) => waitFor(() => ownRound(c).stage === 'catch')));
  await Promise.all(
    writers.map((c) => c.connection.reducers.claimBottle({ roundId: ownRound(c).id })),
  );
  await Promise.all(writers.map((c) => waitFor(() => !!assignment(c))));
  const caught = writers.map((c) => assignment(c).id);
  assert.equal(new Set(caught).size, writers.length);
  for (const c of writers)
    assert.notEqual(assignment(c).id, [...c.connection.db.myOutgoing.iter()][0].id);
  pass('Ten simultaneous catches produce ten exclusive assignments, with no self-assignment');
  const first = await connect();
  const twin = await connect(first.token);
  await Promise.all([
    first.connection.reducers.startRound({}),
    twin.connection.reducers.startRound({}),
  ]);
  await waitFor(
    () =>
      [...first.connection.db.myRound.iter()].length === 1 &&
      [...twin.connection.db.myRound.iter()].length === 1,
  );
  assert.equal(ownRound(first).id, ownRound(twin).id);
  pass('Two concurrent tabs sharing an identity resume exactly one active round');
  for (const name of [
    'round',
    'bottle',
    'request',
    'report',
    'report_resolution',
    'authorship',
    'hello',
    'config',
  ]) {
    const denied = await new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Private table probe timed out: ' + name)), 8000);
      first.connection
        .subscriptionBuilder()
        .onError(() => {
          clearTimeout(timer);
          resolve(true);
        })
        .onApplied(() => {
          clearTimeout(timer);
          resolve(false);
        })
        .subscribe(`SELECT * FROM ${name}`);
    });
    assert.equal(denied, true, `Private table ${name} must reject guest subscriptions`);
  }
  pass('The running server rejects guest subscriptions to every private table');
  await assert.rejects(first.connection.reducers.setPause({ paused: true }));
  pass('A guest cannot invoke the owner pause control');
  const outsider = ownRound(first).id;
  await assert.rejects(writers[0].connection.reducers.abandonRound({ roundId: outsider }));
  pass('A guessed round identifier does not confer ownership');
  const c = writers[0];
  const roundId = ownRound(c).id;
  const requestId = crypto.randomUUID();
  const args = { roundId, requestId, text: 'Your account has been permanently frozen.' };
  const results = await Promise.all([
    c.connection.procedures.submitReply(args),
    c.connection.procedures.submitReply(args),
  ]);
  assert.ok(results.every((r) => r.ok || r.message.includes('pending')));
  await waitFor(() => [...c.connection.db.myCards.iter()].filter((x) => !x.hidden).length === 1);
  assert.equal([...c.connection.db.myCards.iter()].filter((x) => !x.hidden).length, 1);
  pass('Concurrent duplicate reply requests produce one canonical postcard');
  await fs.writeFile(
    new URL('../docs/evidence/live-invariants.json', import.meta.url),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        database: 'local sandbox',
        participants: 'synthetic test identities',
        checks,
      },
      null,
      2,
    ),
  );
} finally {
  for (const c of clients) c.connection.disconnect();
}
