import { PROMPTS } from '../../../packages/game-rules/index';

// Resolve the story's own prompt, never the current daily prompt.
export function storyPrompt(promptId: string) {
  return PROMPTS.find((prompt) => prompt.id === promptId);
}
export type DraftContext = {
  day: number;
  setupPrompt: string;
  replyPrompt: string;
  kind: 'setup' | 'reply';
  beginning?: string;
};
