import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectStarterBundle } from '../packages/starter-content/index';

const args = process.argv.slice(2);
const path = args.find((arg) => !arg.startsWith('--'));
if (!path || args.some((arg) => arg.startsWith('--') && arg !== '--install')) {
  console.error('Usage: npm run starters:check -- /path/to/export.json [--install]');
  process.exit(1);
}
try {
  if (statSync(path).size > 128 * 1024) throw Error('Starter export exceeds 128 KiB.');
  const result = inspectStarterBundle(JSON.parse(readFileSync(path, 'utf8')));
  console.log(
    JSON.stringify({ counts: result.counts, ready: result.ready, errors: result.errors }, null, 2),
  );
  if (result.errors.length) process.exit(1);
  if (args.includes('--install')) {
    if (!result.ready) throw Error('Only a complete human-team export can be installed.');
    const destination = fileURLToPath(
      new URL('../packages/starter-content/approved.ts', import.meta.url),
    );
    writeFileSync(
      destination,
      `// Human-team export. Review content and moderation before deploying.\nexport const approvedStarterBundle: unknown = ${JSON.stringify(result.bundle, null, 2)};\n`,
    );
    console.log(
      'Installed in source only. Review the diff, moderate the content, then deploy and enable the server opt-in.',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not validate starter export.');
  process.exit(1);
}
