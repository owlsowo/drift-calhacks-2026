import { test } from 'node:test';
import assert from 'node:assert/strict';
import { words, validateLine, PROMPTS, dayOf } from './index.ts';
test('configured examples and development starters meet the same six-word rule', () => {
  for (const p of PROMPTS)
    for (const s of [p.exampleSetup, p.exampleReply, ...p.starters])
      assert.equal(validateLine(s), null, s);
});
test('punctuation, apostrophes, hyphens, Unicode, and emoji follow the defined rule', () => {
  assert.equal(words('“Our” deep-sea lawyers don’t like 🐙 surprises.').length, 6);
  assert.equal(words('🐠 🦀 🐙').length, 0);
  assert.equal(words('1 2 3 4 5 6').length, 6);
  assert.equal(words('éé one two three four five').length, 6);
  assert.ok(validateLine('a '.repeat(5)));
  assert.ok(validateLine('a'.repeat(161) + ' b c d e f'));
});
test('UTC day changes once at the boundary', () => {
  assert.equal(
    dayOf(Date.parse('2026-10-25T00:00:00Z')),
    dayOf(Date.parse('2026-10-24T23:59:59Z')) + 1,
  );
});
