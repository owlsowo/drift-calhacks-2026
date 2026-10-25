// Fixed hosted negative probe: no challenge solving, round creation or provider dispatch.
import { DbConnection } from '../apps/web/src/module_bindings';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const connection = await new Promise<DbConnection>((resolve, reject) => {
  const timer = setTimeout(
    () => reject(Error('Hosted scene probe connection timed out.')),
    15000,
  );
  DbConnection.builder()
    .withUri('https://maincloud.spacetimedb.com')
    .withDatabaseName('drift-calhacks-2026')
    .onConnect((conn) => {
      clearTimeout(timer);
      resolve(conn);
    })
    .onConnectError(() => {
      clearTimeout(timer);
      reject(Error('Hosted scene probe could not connect.'));
    })
    .build();
});
try {
  await new Promise<void>((resolve, reject) =>
    connection
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .onError(() => reject(Error('Hosted service subscription failed.')))
      .subscribe(['SELECT * FROM service_status', 'SELECT * FROM my_appreciation', 'SELECT * FROM postcard_scene', 'SELECT * FROM postcard_scene_status']),
  );
  const status = [...connection.db.serviceStatus.iter()][0];
  assert.equal(status.sandbox, false);
  assert.equal(status.aiReady, true);
  assert.equal(status.botRequired, true);
  assert.equal(status.paused, false);
  assert.deepEqual([...connection.db.myAppreciation.iter()], []);
  const rejected = await connection.procedures.illustrateCard({ cardId: 'invalid-synthetic-scene-probe' });
  assert.equal(rejected.state, 'failed');
  assert.match(rejected.message, /unavailable|not available|can’t|no longer/i);
  assert.equal([...connection.db.postcardSceneStatus.iter()].some(row => row.cardId === 'invalid-synthetic-scene-probe'), false);
  const report = {
    checkedAt: new Date().toISOString(),
    checks: [
      'Hosted service remains live, AI-ready, unpaused and bot-protected',
      'The new public scene/status tables are subscribable while a fresh identity has no private appreciation receipts',
      'The illustration procedure rejects a nonexistent postcard without queueing generation',
    ],
    scope:
      'Real hosted SDK/service/scene procedure guard probe. No challenge solved, round/story created or provider call made. This is not a hosted multi-writer Claude completion test.',
  };
  await fs.writeFile(
    'docs/evidence/hosted-scene-check.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  connection.disconnect();
}
