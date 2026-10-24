import test from 'node:test';
import assert from 'node:assert/strict';
import { ShakeMeter } from '../apps/web/src/shake';

test('requires four deliberate reversals, ignoring steady travel and tiny timing jitter', () => {
  const meter = new ShakeMeter();
  for (let t = 0; t <= 400; t += 100) assert.equal(meter.hit(1, t).complete, false);
  assert.equal(meter.hit(-1, 410).progress, 0.25);
  assert.equal(meter.hit(1, 420).progress, 0.25);
  assert.equal(meter.hit(1, 510).progress, 0.5);
  assert.equal(meter.hit(-1, 610).progress, 0.75);
  assert.equal(meter.hit(1, 710).complete, true);
});
test('a long pause resets the gesture instead of accumulating incidental bumps', () => {
  const meter = new ShakeMeter();
  meter.hit(1, 0);
  meter.hit(-1, 100);
  assert.equal(meter.hit(1, 1200).progress, 0);
  assert.equal(meter.hit(-1, 1300).complete, false);
});
test('slow alternating bumps expire after three seconds', () => {
  const meter = new ShakeMeter();
  for (const [time, direction] of [
    [0, 1],
    [900, -1],
    [1800, 1],
    [2700, -1],
    [3600, 1],
  ])
    assert.equal(meter.hit(direction, time).complete, false);
});
test('an explicit reset starts a fresh gesture and zero has no direction', () => {
  const meter = new ShakeMeter();
  meter.hit(1, 0);
  meter.hit(-1, 100);
  meter.reset();
  assert.deepEqual(meter.hit(0, 200), { progress: 0, complete: false });
  assert.deepEqual(meter.hit(1, 300), { progress: 0, complete: false });
});
