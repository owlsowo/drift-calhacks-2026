import { validateLine, words } from '../../../packages/game-rules/index';

// A small, local invitation to reconsider obvious filler. This does not assess
// theme fit, humor, intent or safety, and never changes the server request.
export function storyReviewReason(text: string): string | null {
  if (validateLine(text)) return null;
  const tokens = words(text).map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  if (counts.size <= 2 || [...counts.values()].some((count) => count >= 4))
    return 'Several words repeat. Want to give the next writer a little more to work with?';
  if (
    [
      'what are you saying bruh what',
      'this is just a test message',
      'i do not understand this prompt',
    ].includes(tokens.join(' '))
  )
    return 'This may read as a comment about the prompt. Want to make it part of the story?';
  return null;
}

export type StoryReviewTarget = {
  draftKey: string;
  roundId: string;
  version: number;
  stage: string;
  assignmentId: string;
  text: string;
};

// Consent to send these exact words belongs only to this version of this draft.
export function sameStoryReview(a: StoryReviewTarget, b: StoryReviewTarget) {
  return (
    a.draftKey === b.draftKey &&
    a.roundId === b.roundId &&
    a.version === b.version &&
    a.stage === b.stage &&
    a.assignmentId === b.assignmentId &&
    a.text === b.text
  );
}
