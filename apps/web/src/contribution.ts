import type { Card } from '../../../packages/game-rules/index';

// A bookmark is public; only the private author view can identify this writer's contribution.
export function contribution(card: Card, role = 'public') {
  if (card.seeded) {
    const source = card.starterKind === 'team' ? 'team' : 'sample';
    return role === 'reply'
      ? `You finished a ${source} beginning.`
      : `${source === 'team' ? 'Team' : 'Sample'} beginning. A writer’s ending.`;
  }
  if (role === 'reply') return 'Someone began it. You finished it.';
  if (role === 'setup') return 'You began it. Someone finished it.';
  return 'Two writers. One little story.';
}
