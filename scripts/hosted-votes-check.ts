// Fixed hosted negative probe: no challenge solving, round creation or provider dispatch.
import { DbConnection } from '../apps/web/src/module_bindings';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const connection = await new Promise<DbConnection>((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('Hosted vote probe connection timed out.')), 15000);
  DbConnection.builder()
    .withUri('https://maincloud.spacetimedb.com')
    .withDatabaseName('drift-calhacks-2026')
    .onConnect((conn) => {
      clearTimeout(timer);
      resolve(conn);
    })
    .onConnectError(() => {
      clearTimeout(timer);
      reject(Error('Hosted vote probe could not connect.'));
    })
    .build();
});
try {
  await new Promise<void>((resolve, reject) =>
    connection
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .onError(() => reject(Error('Hosted vote subscription failed.')))
      .subscribe([
        'SELECT * FROM service_status',
        'SELECT * FROM postcard',
        'SELECT * FROM card_vote_totals',
        'SELECT * FROM my_card_votes',
      ]),
  );
  const status = [...connection.db.serviceStatus.iter()][0];
  assert.equal(status.sandbox, false);
  assert.equal(status.aiReady, true);
  assert.equal(status.botRequired, true);
  assert.equal(status.paused, false);
  assert.deepEqual([...connection.db.myCardVotes.iter()], []);
  const card = [...connection.db.postcard.iter()][0];
  assert.ok(card, 'An existing public card is required for this negative check.');
  let rejected = '';
  try {
    await connection.reducers.setCardVote({ cardId: card.id, voted: true });
  } catch (error) {
    rejected = String(error);
  }
  assert.match(rejected, /shore check/);
  assert.deepEqual([...connection.db.myCardVotes.iter()], []);
  const privateDenied = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 8000);
    connection
      .subscriptionBuilder()
      .onApplied(() => {
        clearTimeout(timer);
        resolve(false);
      })
      .onError(() => {
        clearTimeout(timer);
        resolve(true);
      })
      .subscribe('SELECT * FROM card_vote');
  });
  assert.equal(privateDenied, true);
  const report = {
    checkedAt: new Date().toISOString(),
    checks: [
      'Hosted service remains live, AI-ready, unpaused and bot-protected',
      'Public vote totals and sender-scoped selections are subscribable; a fresh guest has no selections',
      'An unverified fresh guest cannot vote on an existing public postcard and receives the human-check error',
      'The hosted SDK denies a direct subscription to private individual vote records',
    ],
    scope:
      'Real hosted SDK/read/negative-write guard probe. No challenge solved, vote recorded, round/story created or provider call. Positive multi-viewer voting remains separately established in the disposable local browser checks.',
  };
  await fs.writeFile(
    'docs/evidence/hosted-votes-check.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  connection.disconnect();
}
