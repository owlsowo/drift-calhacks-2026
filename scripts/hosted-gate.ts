import { DbConnection } from '../apps/web/src/module_bindings';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const connection = await new Promise<DbConnection>((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('Hosted gate connection timeout')), 15000);
  DbConnection.builder()
    .withUri('https://maincloud.spacetimedb.com')
    .withDatabaseName('drift-calhacks-2026')
    .onConnect((conn) => {
      clearTimeout(timer);
      resolve(conn);
    })
    .onConnectError((_ctx, error) => {
      clearTimeout(timer);
      reject(error);
    })
    .build();
});
try {
  await new Promise<void>((resolve, reject) =>
    connection
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .onError(() => reject(Error('Subscription failed')))
      .subscribe(['SELECT * FROM service_status']),
  );
  const status = [...connection.db.serviceStatus.iter()][0];
  assert.equal(status.botRequired, true);
  assert.equal(status.sandbox, false);
  assert.equal(status.aiReady, true);
  const forged = await connection.procedures.verifyShore({ token: 'invalid-synthetic-token' });
  assert.equal(forged.ok, false);
  let rejected = '';
  try {
    await connection.reducers.startRound({});
  } catch (error) {
    rejected = String(error);
  }
  assert.match(rejected, /shore check/);
  const evidence = {
    checkedAt: new Date().toISOString(),
    mode: 'Real hosted Turnstile negative check; no challenge solved and no paid AI dispatch attempted',
    checks: [
      'Hosted service reports AI ready, sandbox off and bot protection required',
      'A forged token is rejected through real Cloudflare Siteverify',
      'An unverified identity cannot start a round',
    ],
    status,
  };
  await fs.writeFile('docs/evidence/hosted-gate.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  connection.disconnect();
}
