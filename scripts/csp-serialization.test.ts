import test from 'node:test';
import assert from 'node:assert/strict';
import {
  t,
  AlgebraicType,
  BinaryReader,
  BinaryWriter,
  Identity,
  Timestamp,
  TimeDuration,
} from 'spacetimedb';
const type = t.object('ProtocolFixture', {
  name: t.string(),
  count: t.u32(),
  owner: t.identity(),
  stamp: t.timestamp(),
  wait: t.timeDuration(),
  maybe: t.option(t.string()),
  rows: t.array(t.u64()),
  state: t.enum('FixtureState', { Ready: t.unit(), Busy: t.string() }),
}).algebraicType;
const value = {
  name: 'one human note',
  count: 7,
  owner: new Identity(123n),
  stamp: new Timestamp(456n),
  wait: new TimeDuration(789n),
  maybe: 'yes',
  rows: [1n, 2n],
  state: { tag: 'Busy', value: 'waiting' },
};
const writer = new BinaryWriter(128);
AlgebraicType.makeSerializer(type)(writer, value);
const expected = writer.getBuffer().slice();
await import('../apps/web/src/csp-serialization');
test('CSP interpreter preserves SDK wire bytes and special object types without Function()', () => {
  const native = globalThis.Function;
  globalThis.Function = new Proxy(native, {
    apply() {
      throw Error('CSP blocks eval');
    },
    construct() {
      throw Error('CSP blocks eval');
    },
  });
  try {
    const out = new BinaryWriter(128);
    AlgebraicType.makeSerializer(type)(out, value);
    assert.deepEqual(out.getBuffer(), expected);
    const decoded = AlgebraicType.makeDeserializer(type)(new BinaryReader(expected));
    assert.deepEqual(decoded, value);
    assert.ok(decoded.owner instanceof Identity);
    assert.ok(decoded.stamp instanceof Timestamp);
  } finally {
    globalThis.Function = native;
  }
});
