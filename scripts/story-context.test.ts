import test from 'node:test';
import assert from 'node:assert/strict';
import { storyPrompt } from '../apps/web/src/story-context';
import { cardText } from '../apps/web/src/export';

test('shared text carries the story prompt, both answers, and starter provenance', () => {
  const text = cardText({
    id: 'old-story',
    promptId: 'spaceship',
    setup: 'Our captain replaced gravity with glitter.',
    reply: 'The glitter was an emergency feature.',
    seeded: true,
    starterKind: 'team',
    createdMs: 0,
  });
  assert.match(text, /Original prompt: Why did your spaceship fail inspection\?/);
  assert.match(text, /Beginning: Our captain replaced gravity with glitter\./);
  assert.match(text, /How to respond: Write the captain’s six-word defense\./);
  assert.match(text, /Ending: The glitter was an emergency feature\./);
  assert.match(text, /Beginning by the Drift team\./);
  assert.doesNotMatch(text, /aquarium/);
});
test('unknown historical prompts are explicit rather than replaced with today’s prompt', () => {
  assert.equal(storyPrompt('retired-unknown'), undefined);
  assert.match(
    cardText({
      id: 'old',
      promptId: 'retired-unknown',
      setup: 'beginning',
      reply: 'ending',
      seeded: false,
      createdMs: 0,
    }),
    /Original prompt: Unavailable/,
  );
});
