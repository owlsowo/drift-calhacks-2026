import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { localDrafts, type Snapshot } from './game';

export function EarlierDrafts({
  identity,
  rounds,
  day,
  busy,
  currentKey,
  onCopy,
}: {
  identity: string;
  rounds: Snapshot['rounds'];
  day: number;
  busy: boolean;
  currentKey: string;
  onCopy: (text: string) => void;
}) {
  const [drafts, setDrafts] = useState<{ id: string; day: number; text: string }[]>([]);
  useEffect(() => {
    const local = localDrafts(identity);
    const prior = identity
      ? rounds
          .filter((round) => round.day <= day)
          .sort((a, b) => b.day - a.day)
          .flatMap((round) =>
            local
              .filter(
                (draft) =>
                  draft.key !== currentKey &&
                  draft.key.startsWith(`drift:draft:${identity}:${round.id}:`),
              )
              .map((draft) => ({ id: draft.key, day: round.day, text: draft.text })),
          )
      : [];
    setDrafts(prior);
  }, [identity, rounds, day, currentKey]);
  if (!drafts.length) return null;
  return (
    <details className="earlier-drafts">
      <summary>Your earlier words</summary>
      <p>
        Local copies of words you typed, including finished stories. Nothing is submitted again.
      </p>
      {drafts.map((draft) => (
        <div className="earlier-draft" key={draft.id}>
          <time dateTime={new Date(draft.day * 86400000).toISOString().slice(0, 10)}>
            {new Date(draft.day * 86400000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          </time>
          <blockquote>{draft.text}</blockquote>
          <button className="text-button" disabled={busy} onClick={() => onCopy(draft.text)}>
            <Copy size={14} aria-hidden="true" /> Copy this draft
          </button>
        </div>
      ))}
      <small>Drafts expire seven days after their last edit. They stay in this browser.</small>
    </details>
  );
}
