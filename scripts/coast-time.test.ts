import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { coastPeriodAt } from '../apps/web/src/coast-time.ts';

test('the coast is daytime from local 06:00 inclusive until 18:00 exclusive', () => {
  const at = (hour: number, minute = 0, second = 0, millisecond = 0) =>
    new Date(2026, 9, 24, hour, minute, second, millisecond);
  assert.equal(coastPeriodAt(at(0)), 'night');
  assert.equal(coastPeriodAt(at(5, 59, 59, 999)), 'night');
  assert.equal(coastPeriodAt(at(6)), 'day');
  assert.equal(coastPeriodAt(at(12)), 'day');
  assert.equal(coastPeriodAt(at(17, 59, 59, 999)), 'day');
  assert.equal(coastPeriodAt(at(18)), 'night');
  assert.equal(coastPeriodAt(at(23, 59, 59, 999)), 'night');
});

test('the same instant follows the viewer’s local time rather than UTC or the event timezone', () => {
  const helper = new URL('../apps/web/src/coast-time.ts', import.meta.url).href;
  const source = `
    import { coastPeriodAt } from ${JSON.stringify(helper)};
    process.stdout.write(coastPeriodAt(new Date('2026-10-24T19:00:00Z')));
  `;
  for (const [timeZone, expected] of [
    ['America/Los_Angeles', 'day'],
    ['Asia/Tokyo', 'night'],
    ['UTC', 'night'],
  ]) {
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', source],
      {
        env: { ...process.env, TZ: timeZone },
        encoding: 'utf8',
      },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, expected, timeZone);
  }
});
