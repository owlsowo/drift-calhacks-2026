import { waitForGameConnection } from './browser-game-state.mjs';
import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const origin = process.env.DRIFT_WEB_URL,
  database = process.env.DRIFT_TEST_DATABASE;
if (!origin?.startsWith('http://127.0.0.1:') || !database?.startsWith('drift-test-'))
  throw Error('Use npm run test:retention.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const checks = [],
  errors = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const week = 7 * 86400000;
async function ready(context) {
  const p = await context.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(origin);
  await waitForGameConnection(p);
  return p;
}
function requestIds() {
  const bundledConfig = new URL('../../work/spacetime-cli/cli.toml', import.meta.url).pathname;
  const config = existsSync(bundledConfig)
    ? bundledConfig
    : new URL('../.spacetime/cli.toml', import.meta.url).pathname;
  const r = spawnSync(
    process.execPath,
    [
      'scripts/spacetime.mjs',
      '--config-path',
      config,
      'sql',
      '--server',
      'http://127.0.0.1:3000',
      '--format',
      'json',
      database,
      'SELECT id FROM request',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0, 'Local owner readback succeeds');
  const data = JSON.parse(r.stdout.split('\n').find((line) => line.startsWith('[')))[0];
  return data.rows.map((row) => row[0]);
}
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const expired = JSON.stringify({
      driftDraft: 1,
      text: 'expired synthetic retry text',
      expiresAt: Date.now() - 1,
    });
    localStorage.setItem('drift:request:expired-fixture:setup:old', expired);
    localStorage.setItem('drift:draft:expired-fixture:old', expired);
  });
  const page = await ready(context);
  assert.deepEqual(
    await page.evaluate(() => [
      localStorage.getItem('drift:request:expired-fixture:setup:old'),
      localStorage.getItem('drift:draft:expired-fixture:old'),
    ]),
    [null, null],
  );
  pass('Connection startup removes expired retry and draft text, including inactive identities');
  const setup = await page.evaluate(async () => {
    const { game } = await import('/src/game.ts');
    const roundId = await game.start();
    const text = 'I taught the octopus insider trading.';
    const id = crypto.randomUUID();
    const key = `drift:request:${game.snapshot().identity}:setup:${roundId}`;
    localStorage.setItem(key, JSON.stringify({ id, text }));
    const { DbConnection } = await import('/src/module_bindings/index.ts');
    const original = DbConnection.builder;
    window.testDropReply = true;
    window.testDispatches = [];
    window.testConnectionEvents = [];
    DbConnection.builder = () => {
      const builder = original.call(DbConnection),
        onConnect = builder.onConnect.bind(builder);
      const build = builder.build.bind(builder);
      builder.build = () => {
        const conn = build();
        window.testConnection = conn;
        return conn;
      };
      builder.onConnect = (callback) =>
        onConnect((conn, ...args) => {
          window.testConnectionEvents.push({
            event: 'connect',
            active: conn.isActive,
            time: performance.now(),
          });
          const submit = conn.procedures.submitSetup.bind(conn.procedures);
          conn.procedures.submitSetup = async (args) => {
            window.testDispatches.push(args.requestId);
            const result = await submit(args);
            if (window.testDropReply) {
              window.testDropReply = false;
              throw Error('Synthetic response lost after actual local commit');
            }
            return result;
          };
          callback(conn, ...args);
        });
      builder.onDisconnect((conn, error) =>
        window.testConnectionEvents.push({
          event: 'disconnect',
          active: conn.isActive,
          name: error?.name,
          time: performance.now(),
        }),
      );
      builder.onConnectError((conn, error) =>
        window.testConnectionEvents.push({
          event: 'error',
          active: conn.isActive,
          name: error?.name,
          time: performance.now(),
        }),
      );
      return builder;
    };
    game.reconnect();
    return { key, id, text, roundId, connectedDuringReconnect: game.snapshot().connected };
  });
  assert.equal(setup.connectedDuringReconnect, false);
  await waitForGameConnection(page);
  const envelope = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), setup.key);
  assert.equal(JSON.parse(envelope.text).id, setup.id);
  assert.equal(envelope.driftDraft, 1);
  assert.ok(
    envelope.expiresAt > Date.now() + week - 60000 && envelope.expiresAt <= Date.now() + week,
  );
  pass(
    'Legacy pending retry text migrates into a seven-day envelope without replacing its request ID',
  );
  const lost = await page.evaluate(async (setup) => {
    const { game, saved } = await import('/src/game.ts');
    let error = '';
    try {
      await game.paid('setup', setup.roundId, setup.text);
    } catch (e) {
      error = e.message;
    }
    return {
      error,
      cached: JSON.parse(saved(setup.key)),
      ids: window.testDispatches,
      active: window.testConnection?.isActive,
      connected: game.snapshot().connected,
      events: window.testConnectionEvents,
      stateError: game.snapshot().error,
    };
  }, setup);
  if (lost.error && !lost.error.includes('Synthetic response lost'))
    console.log('Retry connection diagnostic', {
      error: lost.error,
      active: lost.active,
      connected: lost.connected,
      events: lost.events,
      stateError: lost.stateError,
    });
  assert.match(lost.error, /Synthetic response lost/);
  assert.equal(lost.cached.id, setup.id);
  assert.deepEqual(lost.ids, [setup.id]);
  assert.equal(requestIds().length, 1);
  pass(
    'An injected response loss after a real local commit preserves the original retry ID and text',
  );
  await page.reload();
  await waitForGameConnection(page);
  const replay = await page.evaluate(async (setup) => {
    const { game, saved } = await import('/src/game.ts');
    const result = await game.paid('setup', setup.roundId, setup.text);
    return { ok: result.ok, cached: saved(setup.key), raw: localStorage.getItem(setup.key) };
  }, setup);
  assert.equal(replay.ok, true);
  assert.equal(replay.cached, '');
  assert.equal(replay.raw, null);
  const ids = requestIds();
  assert.equal(ids.length, 1);
  assert.ok(ids[0].endsWith(':' + setup.id));
  pass(
    'Reload replay uses the same server request, creates no duplicate, and immediately removes the confirmed retry text',
  );
  const malformed = await page.evaluate(async () => {
    const { game, persist } = await import('/src/game.ts');
    const roundId = await game.start();
    const key = `drift:request:${game.snapshot().identity}:setup:${roundId}`;
    persist(key, JSON.stringify({ text: 'Their penguin stole my student discount.', id: 42 }));
    const result = await game.paid('setup', roundId, 'Their penguin stole my student discount.');
    return result.ok;
  });
  assert.equal(malformed, true);
  assert.equal(requestIds().length, 2);
  pass('A malformed cached ID cannot become an invalid paid-call argument');
  const expiry = await page.evaluate(async (week) => {
    const { persist, saved } = await import('/src/game.ts');
    const key = 'drift:request:expiry-fixture:reply:held';
    const value = JSON.stringify({ text: 'synthetic held text', id: crypto.randomUUID() });
    persist(key, value);
    const expiresAt = JSON.parse(localStorage.getItem(key)).expiresAt;
    const now = Date.now;
    Date.now = () => expiresAt - 1;
    const before = saved(key);
    Date.now = () => expiresAt;
    const after = saved(key);
    Date.now = now;
    const raw = localStorage.getItem(key);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw Error('Synthetic storage unavailable');
      },
    });
    const memoryKey = 'drift:request:memory-fixture:reply:held';
    persist(memoryKey, value);
    const start = Date.now();
    Date.now = () => start + week + 1;
    const memory = saved(memoryKey);
    Date.now = now;
    return { before, after, raw, memory, value };
  }, week);
  assert.equal(expiry.before, expiry.value);
  assert.equal(expiry.after, '');
  assert.equal(expiry.raw, null);
  assert.equal(expiry.memory, '');
  pass(
    'Exact seven-day expiry removes persistent and memory-only retry text while preserving it before the deadline',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`../docs/evidence/local-retention-${engine.toLowerCase()}.json`, import.meta.url),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        mode: 'Isolated local sandbox, synthetic words, no provider calls. Response-loss, time and storage failures are injected; server commit/replay and SQL readback are real.',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
