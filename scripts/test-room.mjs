import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
const root = path.resolve(new URL('../', import.meta.url).pathname);
process.chdir(root);
const mode = process.argv[2] || 'ui';
if (
  ![
    'gate-layout',
    'daily-clarity',
    'shelf-render',
    'shore-motion',
    'qr-invitation',
    'shared-landing',
    'scenes',
    'scene-flow',
    'scene-results',
    'scene-asset-failures',
    'shore-script-retry',
    'invite',
    'withdrawal',
    'thanks',
    'navigation',
    'coast',
    'retention',
    'hint-retries',
    'keepsake',
    'ritual',
    'letters',
    'returns',
    'ui',
    'a11y',
    'live',
    'states',
    'demo',
    'shore',
    'catch-first',
    'empty',
    'webkit',
    'recovery',
    'coldstart',
    'paper-benchmark',
    'paper-fallbacks',
    'paper-continuity',
  ].includes(mode)
)
  throw Error('Unknown test mode.');
const room = `drift-test-${mode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const env = {
  ...process.env,
  ANTHROPIC_API_KEY: '',
  DRIFT_TEST_GATE: mode === 'shore-script-retry' ? 'true' : process.env.DRIFT_TEST_GATE || 'false',
  DRIFT_TEST_HELLO: mode === 'ui' ? 'true' : 'false',
  DRIFT_TEST_EMPTY: mode === 'empty' ? 'true' : 'false',
  VITE_SPACETIMEDB_DATABASE: room,
  VITE_SPACETIMEDB_HOST: 'http://127.0.0.1:3000',
  DRIFT_TEST_DATABASE: room,
  DRIFT_TEST_COLDSTART: mode === 'coldstart' ? 'true' : 'false',
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
  const sceneFiles = {
    'shelf-render': 'shelf-render-check.mjs',
    'shore-motion': 'shore-motion-ui.mjs',
    'qr-invitation': 'qr-invitation-ui.mjs',
    'daily-clarity': 'daily-clarity-ui.mjs',
    'shared-landing': 'shared-landing-ui.mjs',
    scenes: 'scenes-ui.mjs',
    'scene-flow': 'scene-flow-ui.mjs',
    'scene-results': 'scene-results-ui.mjs',
    'scene-asset-failures': 'scene-asset-failures.mjs',
  };
  const file =
    sceneFiles[mode] ??
    (mode === 'shore-script-retry'
      ? 'shore-script-retry.mjs'
      : mode === 'navigation'
        ? 'navigation-ui.mjs'
        : mode === 'thanks'
          ? 'appreciation-ui.mjs'
          : mode === 'withdrawal'
            ? 'withdrawal-ui.mjs'
            : mode === 'gate-layout'
              ? 'shore-gate-layout.mjs'
              : mode === 'invite'
                ? 'invitations-ui.mjs'
                : mode === 'coast'
                  ? 'approved-coast-ui.mjs'
                  : mode === 'keepsake'
                    ? 'keepsake-ui.mjs'
                    : mode === 'hint-retries'
                      ? 'hint-retries-ui.mjs'
                      : mode === 'retention'
                        ? 'local-retention-ui.mjs'
                        : mode === 'ritual'
                          ? 'bottle-ritual-ui.mjs'
                          : mode === 'returns'
                            ? 'unopened-returns-ui.mjs'
                            : mode === 'letters'
                              ? 'letter-pools-ui.mjs'
                              : mode === 'paper-continuity'
                                ? 'paper-continuity.mjs'
                                : mode === 'paper-fallbacks'
                                  ? 'paper-fallbacks.mjs'
                                  : mode === 'paper-benchmark'
                                    ? 'paper-benchmark.mjs'
                                    : mode === 'coldstart'
                                      ? 'coldstart.mjs'
                                      : mode === 'recovery'
                                        ? 'draft-recovery.mjs'
                                        : mode === 'webkit'
                                          ? 'webkit-smoke.mjs'
                                          : mode === 'empty'
                                            ? 'empty-tide.mjs'
                                            : mode === 'catch-first'
                                              ? 'catch-first.mjs'
                                              : mode === 'shore'
                                                ? 'shore-interactions.mjs'
                                                : mode === 'ui'
                                                  ? 'ui-smoke.mjs'
                                                  : mode === 'a11y'
                                                    ? 'accessibility.mjs'
                                                    : mode === 'states'
                                                      ? 'content-states.mjs'
                                                      : mode === 'demo'
                                                        ? 'demo-flow.mjs'
                                                        : 'live-invariants.ts');
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
