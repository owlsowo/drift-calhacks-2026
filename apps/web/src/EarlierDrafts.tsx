import { Copy } from 'lucide-react';
import { localDrafts, type Snapshot } from './game';
import type { Prompt } from '../../../packages/game-rules/index';

export function EarlierDrafts({
  identity,
  rounds,
  beginnings,
  assignments,
  day,
  busy,
  currentKey,
  onCopy,
}: {
  identity: string;
  rounds: Snapshot['rounds'];
  beginnings: Snapshot['beginnings'];
  assignments: Snapshot['assignments'];
  day: number;
  busy: boolean;
  currentKey: string;
  onCopy: (text: string) => void;
}) {
  const drafts = localDrafts(identity)
    .filter((draft) => draft.key !== currentKey)
    .map((draft) => {
      const suffix = draft.key.slice(`drift:draft:${identity}:`.length);
      const [roundId, assignmentId] = suffix.split(':');
      const round = rounds.find((item) => item.id === roundId);
      const prompt = round ? (JSON.parse(round.promptJson) as Prompt) : undefined;
      const kind = draft.context?.kind ?? (assignmentId === 'setup' ? 'setup' : 'reply');
      const beginning =
        draft.context?.beginning ??
        assignments.find((item) => item.roundId === roundId && item.id === assignmentId)?.text ??
        beginnings.find((item) => item.id === assignmentId)?.text;
      return {
        ...draft,
        kind,
        beginning,
        day: draft.context?.day ?? round?.day,
        setupPrompt: draft.context?.setupPrompt ?? prompt?.setup,
        replyPrompt: draft.context?.replyPrompt ?? prompt?.reply,
      };
    })
    .filter((draft) => draft.day === undefined || draft.day <= day)
    .sort((a, b) => (b.day ?? 0) - (a.day ?? 0));
  if (!drafts.length) return null;
  return (
    <details className="earlier-drafts">
      <summary>Your earlier words</summary>
      <p>
        Local copies of words you typed, including finished stories. Nothing is submitted again.
      </p>
      {drafts.map((draft) => (
        <div className="earlier-draft" key={draft.key}>
          {draft.day !== undefined && (
            <time dateTime={new Date(draft.day * 86400000).toISOString().slice(0, 10)}>
              {new Date(draft.day * 86400000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </time>
          )}
          <strong className="story-context">
            {draft.kind === 'setup' ? 'Your beginning' : 'Your ending'}
          </strong>
          <div className="writing-context">
            <strong>Original prompt</strong>
            <p>{draft.setupPrompt ?? 'Original prompt unavailable for this older draft.'}</p>
          </div>
          {draft.kind === 'setup' && <blockquote>{draft.text}</blockquote>}
          {draft.kind === 'reply' && (
            <div className="writing-context">
              <strong>Their beginning</strong>
              <p>{draft.beginning ?? 'The original beginning is no longer available.'}</p>
            </div>
          )}
          <div className="writing-context">
            <strong>How to respond</strong>
            <p>{draft.replyPrompt ?? 'Response prompt unavailable for this older draft.'}</p>
          </div>
          {draft.kind === 'reply' && <blockquote>{draft.text}</blockquote>}
          <button className="text-button" disabled={busy} onClick={() => onCopy(draft.text)}>
            <Copy size={14} aria-hidden="true" /> Copy this draft
          </button>
        </div>
      ))}
      <small>Drafts expire seven days after their last edit. They stay in this browser.</small>
    </details>
  );
}
