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
    <aside className="hello-panel" aria-label="Meet your co-writer">
      {expired ? (
        <>
          <h2>Invitation expired</h2>
          <p>Invitations close ten minutes after a postcard is completed.</p>
        </>
      ) : mutual ? (
        <>
          <h2>You both want to meet</h2>
          <p className="meeting-spot">
            <MapPin size={16} />
            {details.spot}
          </p>
          <p>Use these words to recognize each other:</p>
          <div className="recognition-phrase">{details.phrase}</div>
          <small>
            Only you two can see this. {minutes} minute{minutes === 1 ? '' : 's'} left. You can
            cancel below.
          </small>
        </>
      ) : (
        <>
          <h2>{invitation?.optedIn ? 'Waiting for your co-writer' : 'Meet your co-writer?'}</h2>
          <p>
            {invitation?.optedIn
              ? 'If they also agree, you’ll both see a public meeting spot and words to recognize each other. Your invitation stays private until then.'
              : 'If you both agree, you’ll see a public meeting spot and words to recognize each other. No names or contact details are shared.'}
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
          {invitation?.optedIn ? 'Cancel invitation' : 'I’d like to meet'}
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
