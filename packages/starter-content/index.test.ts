import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMPTS } from '../game-rules/index';
import { inspectStarterBundle, teamStartersFor, type StarterBundle } from './index';

// Synthetic validator fixtures, never installed as human content.
const fixture = (): StarterBundle => ({
  version: 1,
  provenance: 'human-team',
  prompts: PROMPTS.map(({ id }) => ({
    id,
    starters: Array.from({ length: 20 }, (_, i) => `Test fixture ${id} item ${i} only`),
  })),
});
test('complete, unique exports validate but no starter inventory ships by default', () => {
  assert.equal(inspectStarterBundle(fixture()).ready, true);
  assert.deepEqual(teamStartersFor('aquarium'), []);
});
test('drafts and incomplete human attestations cannot become production inventory', () => {
  const b = fixture();
  b.provenance = 'draft';
  assert.equal(inspectStarterBundle(b).ready, false);
  b.provenance = 'human-team';
  b.prompts[0].starters.pop();
  assert.equal(inspectStarterBundle(b).ready, false);
  assert.equal(inspectStarterBundle(null).ready, false);
});
test('rejects cross-theme case/Unicode-equivalent duplicates, unknown and repeated groups', () => {
  const b = fixture();
  b.prompts[1].starters[0] = b.prompts[0].starters[0].toUpperCase();
  assert.match(inspectStarterBundle(b).errors.join(' '), /duplicates/);
  b.prompts[1].starters[0] = 'Ｔｅｓｔ fixture aquarium item 0 only';
  assert.match(inspectStarterBundle(b).errors.join(' '), /duplicates/);
  b.prompts[1].id = 'aquarium';
  assert.equal(inspectStarterBundle(b).ready, false);
  b.prompts[1].id = 'unknown';
  assert.equal(inspectStarterBundle(b).ready, false);
});
test('rejects wrong counts, oversized text, control characters and obvious contact details', () => {
  for (const line of [
    'Only five words are here',
    'Test fixture aquarium item 0 only\n',
    'Test fixture reach me via a@b.com',
    'Test fixture reach me via @handle',
    'Test fixture call me at 555-555-5555',
    `Test fixture ${'x'.repeat(161)} item 0 only`,
  ]) {
    const b = fixture();
    b.prompts[0].starters[0] = line;
    assert.equal(inspectStarterBundle(b).ready, false, line);
  }
  const b = fixture();
  b.prompts[0].starters[0] = 'Test fixture emoji 😀 item 0 only';
  assert.equal(inspectStarterBundle(b).ready, true);
});
