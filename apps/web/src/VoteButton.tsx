import { ThumbsUp } from 'lucide-react';
export function VoteButton({
  reply,
  count,
  voted,
  disabled,
  requiresCheck = false,
  onVote,
}: {
  reply: string;
  count: number;
  voted: boolean;
  disabled: boolean;
  requiresCheck?: boolean;
  onVote: () => void;
}) {
  return (
    <button
      className="ending-upvote"
      aria-label={`${voted ? 'Remove upvote from' : requiresCheck ? 'Verify to upvote' : 'Upvote'} ending: ${reply}`}
      aria-pressed={voted}
      disabled={disabled}
      onClick={onVote}
    >
      <ThumbsUp size={16} aria-hidden="true" />
      <span>{voted ? 'Upvoted' : requiresCheck ? 'Verify to upvote' : 'Upvote'}</span>
      <strong>{count}</strong>
    </button>
  );
}
