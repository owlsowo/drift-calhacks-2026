import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeDraft, decodeDraft } from '../apps/web/src/drafts';
test('a saved draft expires exactly seven days after the latest edit', () => {
  const raw = encodeDraft('a small saved line', 100);
  assert.equal(decodeDraft(raw, 100 + 7 * 86400000 - 1).text, 'a small saved line');
  assert.equal(decodeDraft(raw, 100 + 7 * 86400000).expired, true);
});
test('old drafts can migrate without losing their text; malformed envelopes expire', () => {
  assert.deepEqual(decodeDraft('a previous plain draft'), {
    text: 'a previous plain draft',
    expired: false,
    legacy: true,
  });
  assert.equal(decodeDraft('{"driftDraft":1,"text":"x","expiresAt":null}').expired, true);
});
