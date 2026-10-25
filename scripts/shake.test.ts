import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionShakeMeter, ShakeMeter } from '../apps/web/src/shake';

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

test('phone shakes require four reversals on one axis, and ignore subthreshold movement', () => {
  const meter = new MotionShakeMeter();
  const sample = (x: number, time: number) => meter.sample({ x, y: 0, z: 0 }, null, time);
  assert.equal(sample(3, 0), undefined);
  assert.equal(sample(12, 100)?.progress, 0);
  assert.equal(meter.sample({ x: 0, y: -15, z: 0 }, null, 200), undefined);
  assert.equal(sample(-12, 300)?.progress, 0.25);
  assert.equal(sample(12, 400)?.progress, 0.5);
  assert.equal(sample(-12, 500)?.progress, 0.75);
  assert.equal(sample(12, 600)?.complete, true);
});

test('phone gravity fallback primes at rest; resets and pauses discard partial gestures', () => {
  const meter = new MotionShakeMeter();
  for (let time = 0; time <= 500; time += 100)
    assert.equal(meter.sample(null, { x: 0, y: 0, z: 9.81 }, time)?.complete ?? false, false);
  assert.equal(meter.sample(null, { x: 18, y: 0, z: 9.81 }, 600)?.progress, 0);
  assert.equal(meter.sample(null, { x: -18, y: 0, z: 9.81 }, 700)?.progress, 0.25);
  meter.reset();
  assert.equal(meter.sample({ x: 12, y: 0, z: 0 }, null, 800)?.progress, 0);
  assert.equal(meter.sample({ x: -12, y: 0, z: 0 }, null, 1900)?.progress, 0);
  assert.equal(
    meter.sample({ x: NaN, y: Infinity, z: null }, null, 2000)?.complete ?? false,
    false,
  );
});

test('unavailable sensor startup readings do not invent a zero-gravity baseline', () => {
  const meter = new MotionShakeMeter();
  assert.equal(meter.sample(null, null, 0), undefined);
  assert.equal(
    meter.sample({ x: null, y: null, z: null }, { x: null, y: null, z: null }, 80),
    undefined,
  );
  assert.equal(meter.sample(null, { x: 0, y: 0, z: 9.81 }, 160)?.progress, 0);
  for (const [index, x] of [18, -18, 18, -18, 18].entries())
    assert.equal(meter.sample(null, { x, y: 0, z: 9.81 }, 240 + index * 80)?.complete, index === 4);
});
