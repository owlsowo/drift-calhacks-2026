// Fixed hosted negative probe: no challenge solving, round creation or provider dispatch.
import { DbConnection } from '../apps/web/src/module_bindings';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const connection = await new Promise<DbConnection>((resolve, reject) => {
  const timer = setTimeout(
    () => reject(Error('Hosted invitation probe connection timed out.')),
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
      reject(Error('Hosted invitation probe could not connect.'));
    })
    .build();
});
try {
  await new Promise<void>((resolve, reject) =>
    connection
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .onError(() => reject(Error('Hosted service subscription failed.')))
      .subscribe(['SELECT * FROM service_status', 'SELECT * FROM my_unopened_returns']),
  );
  const status = [...connection.db.serviceStatus.iter()][0];
  assert.equal(status.sandbox, false);
  assert.equal(status.aiReady, true);
  assert.equal(status.botRequired, true);
  assert.equal(status.paused, false);
  assert.deepEqual([...connection.db.myUnopenedReturns.iter()], []);
  let rejection = '';
  try {
    await connection.reducers.pickUpBeginning({ beginningId: 'invalid-synthetic-invitation' });
  } catch (error) {
    rejection = String(error);
  }
  assert.match(rejection, /shore check/);
  const report = {
    checkedAt: new Date().toISOString(),
    checks: [
      'Hosted service remains live, AI-ready, unpaused and bot-protected',
      'The additive unopened-return view is available and reveals no reading state to a fresh anonymous identity',
      'The new invitation reducer rejects an unverified identity before selecting a beginning',
    ],
    scope:
      'Real hosted SDK/service/reducer guard probe. No challenge solved, round/story created or provider call made. This is not a hosted multi-writer Claude completion test.',
  };
  await fs.writeFile(
    'docs/evidence/hosted-invitation-check.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  connection.disconnect();
}
