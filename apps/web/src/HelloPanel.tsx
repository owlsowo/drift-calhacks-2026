import { useEffect, useState } from 'react';
import { Check, Hand, LoaderCircle, MapPin } from 'lucide-react';
import { game } from './game';
import { friendlyError } from './errors';
import type { HelloAvailability, HelloDetails } from './module_bindings/types';

export function HelloPanel({
  cardId,
  invitation,
  connected,
  time,
}: {
  cardId: string;
  invitation?: HelloAvailability;
  connected: boolean;
  time: number;
}) {
  const [details, setDetails] = useState<HelloDetails>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const expired = !invitation || time >= invitation.expiresMs;
  useEffect(() => {
    let current = true;
    setDetails(undefined);
    setError('');
    if (connected && invitation?.mutual && !expired) {
      game
        .helloInfo(cardId)
        .then((value) => {
          if (current) setDetails(value);
        })
        .catch(() => {
          if (current) setError('Your invitation couldn’t open. Try checking it again.');
        });
    }
    return () => {
      current = false;
    };
  }, [cardId, invitation?.mutual, expired, connected, retry]);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await game.setHello(cardId, !invitation?.optedIn);
    } catch (e) {
      setError(friendlyError(e, 'Try your invitation again.'));
    } finally {
      setBusy(false);
    }
  }
  const mutual = !expired && invitation?.mutual && details?.mutual;
  const minutes = invitation
    ? Math.max(0, Math.min(10, Math.ceil((invitation.expiresMs - time) / 60000)))
    : 0;
  return (
    <aside className="hello-panel" aria-label="Optional mutual hello">
      <span className="eyebrow">
        <Hand size={13} /> A FIRST LITTLE HELLO
      </span>
      {expired ? (
        <>
          <h2>The moment’s drifted on.</h2>
          <p>
            This invitation lasted ten minutes after the postcard was made. You still have your
            story.
          </p>
        </>
      ) : mutual ? (
        <>
          <h2>You’re both up for a hello.</h2>
          <p className="meeting-spot">
            <MapPin size={16} />
            {details.spot}
          </p>
          <p>Recognize each other with these two words:</p>
          <div className="recognition-phrase">{details.phrase}</div>
          <small>
            Private to you two. {minutes} minute{minutes === 1 ? '' : 's'} left. Meeting is always
            optional.
          </small>
        </>
      ) : (
        <>
          <h2>
            {invitation?.optedIn
              ? 'Your little invitation is waiting.'
              : 'Maybe this is your first hello.'}
          </h2>
          <p>
            {invitation?.optedIn
              ? 'Your choice stays private unless you both opt in. If you do, a public meeting spot and two recognition words appear here.'
              : 'Open to saying hi to your co-writer? A public meeting spot appears only if you both choose to. No names or contact details are shared.'}
          </p>
          <small>
            {minutes} minute{minutes === 1 ? '' : 's'} left to choose.
          </small>
        </>
      )}
      {!expired && (
        <button
          className={invitation?.optedIn ? 'text-button' : 'button secondary'}
          onClick={toggle}
          disabled={busy || !connected}
        >
          {busy ? (
            <LoaderCircle className="spin" size={15} />
          ) : invitation?.optedIn ? (
            <Check size={15} />
          ) : (
            <Hand size={15} />
          )}
          {invitation?.optedIn ? 'Withdraw my invitation' : 'I’m open to saying hi'}
        </button>
      )}
      {error && (
        <>
          <p role="alert" className="hello-error">
            {error}
          </p>
          {connected && invitation?.mutual && !expired && (
            <button className="text-button" onClick={() => setRetry((value) => value + 1)}>
              Check invitation again
            </button>
          )}
        </>
      )}
    </aside>
  );
}
