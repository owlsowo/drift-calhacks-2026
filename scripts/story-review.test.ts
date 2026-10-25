import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sameStoryReview,
  storyReviewReason,
  type StoryReviewTarget,
} from '../apps/web/src/story-review';

test('obvious repeated filler gets an advisory despite case and punctuation', () => {
  for (const text of [
    'hello hello hello hello hello hello',
    'Hi! hi HI hi... there friend',
    'fish moon fish moon fish moon',
  ])
    assert.ok(storyReviewReason(text), text);
});
test('a short list of prompt comments gets an advisory', () => {
  assert.ok(storyReviewReason('What are you saying bruh what?'));
  assert.ok(storyReviewReason('This is just a test message.'));
  assert.ok(storyReviewReason('I do not understand this prompt.'));
});
test('absurdity, repetition for effect and unconventional themes are not graded', () => {
  for (const text of [
    'Our captain replaced gravity with glitter.',
    'Our moon moon moon became cheese.',
    'This test message ate my captain.',
    'Purple clocks politely interrogate invisible walruses.',
  ])
    assert.equal(storyReviewReason(text), null, text);
});
test('word-count and length validation stay separate from advisory review', () => {
  assert.equal(storyReviewReason('hello hello'), null);
  assert.equal(storyReviewReason('a'.repeat(161)), null);
});
test('send-anyway approval never transfers to changed words, identity, round, stage, assignment or version', () => {
  const target: StoryReviewTarget = {
    draftKey: 'guest:round:assignment',
    roundId: 'round',
    version: 2,
    stage: 'reply',
    assignmentId: 'assignment',
    text: 'fish moon fish moon fish moon',
  };
  assert.equal(sameStoryReview(target, { ...target }), true);
  for (const patch of [
    { text: 'moon fish moon fish moon fish' },
    { draftKey: 'other:round:assignment' },
    { roundId: 'other' },
    { version: 3 },
    { stage: 'write' },
    { assignmentId: 'other' },
  ])
    assert.equal(sameStoryReview(target, { ...target, ...patch }), false);
});
