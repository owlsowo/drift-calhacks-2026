import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bottleLink } from '../apps/web/src/bottle-link';

test('a bottle invitation strips all unrelated query and fragment data while preserving its app path', () => {
  assert.equal(
    bottleLink(
      'a-safe_bottle-9',
      'https://drift.example/game?card=old&draft=private&token=private#private-history',
    ),
    'https://drift.example/game?bottle=a-safe_bottle-9',
  );
});

test('an invitation cannot carry credentials, non-web schemes or a query-injecting bottle identifier', () => {
  assert.throws(() => bottleLink('abc&token=private', 'https://drift.example/'));
  assert.throws(() => bottleLink('abc', 'https://name:private@drift.example/'));
  assert.throws(() => bottleLink('abc', 'javascript:alert(1)'));
});
