import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
const root = path.resolve(new URL('../', import.meta.url).pathname);
process.chdir(root);
const mode = process.argv[2] || 'ui';
if (!['ui', 'a11y', 'live', 'states', 'demo'].includes(mode)) throw Error('Unknown test mode.');
const room = `drift-test-${mode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const env = {
  ...process.env,
  ANTHROPIC_API_KEY: '',
  DRIFT_TEST_HELLO: mode === 'ui' ? 'true' : 'false',
  VITE_SPACETIMEDB_DATABASE: room,
  VITE_SPACETIMEDB_HOST: 'http://127.0.0.1:3000',
  DRIFT_TEST_DATABASE: room,
  DRIFT_TEST_HOST: 'http://127.0.0.1:3000',
};
function cli(action) {
  return spawnSync(process.execPath, ['scripts/spacetime.mjs', action, room], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}
const publication = cli('publish-test');
if (publication.status !== 0) {
  console.error(publication.stdout, publication.stderr);
  throw Error('Could not create the isolated local test database.');
}
let frontend;
try {
  if (mode !== 'live') {
    const port = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const p = probe.address().port;
        probe.close(() => resolve(p));
      });
    });
    env.DRIFT_WEB_URL = `http://127.0.0.1:${port}`;
    frontend = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        '--config',
        'apps/web/vite.config.ts',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ],
      { cwd: root, env, stdio: 'ignore' },
    );
    const deadline = Date.now() + 15000;
    while (true) {
      try {
        const response = await fetch(env.DRIFT_WEB_URL);
        if (response.ok) break;
      } catch {}
      if (Date.now() > deadline) throw Error('Test frontend did not start.');
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  const file =
    mode === 'ui'
      ? 'ui-smoke.mjs'
      : mode === 'a11y'
        ? 'accessibility.mjs'
        : mode === 'states'
          ? 'content-states.mjs'
          : mode === 'demo'
            ? 'demo-flow.mjs'
            : 'live-invariants.ts';
  const runner = mode === 'live' ? ['--import', 'tsx', `scripts/${file}`] : [`scripts/${file}`];
  const child = spawn(process.execPath, [...runner, ...process.argv.slice(3)], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  if (code !== 0) process.exitCode = Number(code) || 1;
} finally {
  frontend?.kill('SIGTERM');
  const deletion = cli('delete-test');
  if (deletion.status !== 0) {
    console.error('Isolated test database cleanup failed:', room);
    process.exitCode = 1;
  }
}
