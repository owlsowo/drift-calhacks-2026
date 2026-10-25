import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('../', import.meta.url).pathname);
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');
const candidates = [
  process.env.SPACETIME_BIN,
  'spacetime',
  path.resolve(root, '../work/spacetime-cli/spacetimedb-cli'),
].filter(Boolean);
const executable = candidates.find(
  (p) => spawnSync(p, ['--version'], { stdio: 'ignore' }).status === 0,
);
if (!executable) throw Error('Install SpacetimeDB 2.13 or set SPACETIME_BIN to its executable.');
const [action, ...extra] = process.argv.slice(2);
mkdirSync('.spacetime', { recursive: true });
let args = [];
const env = { ...process.env };
if (['publish-test', 'delete-test', 'pause-test', 'resume-test'].includes(action)) {
  const name = extra[0];
  if (!/^drift-test-[a-z0-9-]+$/.test(name || ''))
    throw Error('Test databases must use the drift-test- namespace.');
  env.ANTHROPIC_API_KEY = '';
  // Only a disposable local layout test may request a synthetic gate. No real key or pass.
  env.DRIFT_TURNSTILE_SECRET = env.DRIFT_TEST_GATE === 'true' ? 'synthetic-layout-test-secret' : '';
  env.DRIFT_TURNSTILE_HOSTNAME = env.DRIFT_TEST_GATE === 'true' ? '127.0.0.1' : '';
  env.DRIFT_DEV_MODE = env.DRIFT_TEST_EMPTY === 'true' ? 'false' : 'true';
  env.DRIFT_DEV_STARTERS = env.DRIFT_TEST_COLDSTART === 'true' ? 'false' : 'true';
  env.DRIFT_STARTERS_HUMAN_WRITTEN = 'false';
  env.DRIFT_HELLO_ENABLED = env.DRIFT_TEST_HELLO === 'true' ? 'true' : 'false';
  env.DRIFT_MEETING_SPOT = 'Synthetic test meeting point — not an event location';
  env.DRIFT_MEETING_SPOT_VERIFIED = env.DRIFT_TEST_HELLO === 'true' ? 'true' : 'false';
  args =
    action === 'pause-test' || action === 'resume-test'
      ? [
          'call',
          name,
          'set_pause',
          action === 'pause-test' ? 'true' : 'false',
          '--server',
          'http://127.0.0.1:3000',
        ]
      : action === 'publish-test'
        ? [
            'publish',
            name,
            '--server',
            'http://127.0.0.1:3000',
            '--module-path',
            'spacetimedb',
            '--yes=skip-login',
          ]
        : ['delete', name, '--server', 'http://127.0.0.1:3000', '--yes'];
} else if (action === 'publish-local') {
  env.DRIFT_DEV_MODE = env.ANTHROPIC_API_KEY ? 'false' : 'true';
  args = [
    'publish',
    'drift-local',
    '--server',
    'http://127.0.0.1:3000',
    '--module-path',
    'spacetimedb',
    '--yes=skip-login',
    ...extra,
  ];
} else if (action === 'generate')
  args = [
    'generate',
    '--lang',
    'typescript',
    '--module-path',
    'spacetimedb',
    '--out-dir',
    'apps/web/src/module_bindings',
    '--yes',
  ];
else if (action === 'publish') {
  env.DRIFT_DEV_MODE = 'false';
  if (!env.ANTHROPIC_API_KEY)
    throw Error('Add ANTHROPIC_API_KEY to the local .env before production publishing.');
  args = ['publish', ...extra, '--module-path', 'spacetimedb'];
} else args = [action, ...extra];
// Keep the account's default CLI login for authenticated hosted publishing.
// Local identity/config stays in the task workspace when using the bundled CLI.
const localConfig = path.resolve(root, '../work/spacetime-cli/cli.toml');
const config = [
  'publish-local',
  'publish-test',
  'delete-test',
  'pause-test',
  'resume-test',
].includes(action)
  ? [
      '--config-path',
      existsSync(localConfig) ? localConfig : path.resolve(root, '.spacetime/cli.toml'),
    ]
  : [];
const child = spawnSync(executable, [...config, ...args], { stdio: 'inherit', env });
process.exit(child.status ?? 1);
