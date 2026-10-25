import { useEffect, useState } from 'react';
import type { invitationCode } from './invitation-code';

export function QrInvitation({ url }: { url: string }) {
  const [code, setCode] = useState<ReturnType<typeof invitationCode>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setCode(undefined);
    setFailed(false);
    const timer = setTimeout(() => {
      if (active) setFailed(true);
    }, 6000);
    // Load the encoder only when someone deliberately opens this invitation.
    import('./invitation-code')
      .then(({ invitationCode }) => {
        if (active) setCode(invitationCode(url));
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [url]);
  return (
    <div className="qr-invitation">
      {code ? (
        <svg
          className="bottle-qr"
          role="img"
          aria-label="Scan to open this public bottle"
          viewBox={`0 0 ${code.size} ${code.size}`}
          xmlns="http://www.w3.org/2000/svg"
          width="256"
          height="256"
          shapeRendering="crispEdges"
        >
          <rect width={code.size} height={code.size} fill="#fff" />
          <path d={code.path} fill="#11272c" />
        </svg>
      ) : (
        <p className="qr-preparing" role="status">
          {failed
            ? 'The code couldn’t load. You can still copy the bottle link below.'
            : 'Preparing your bottle code…'}
        </p>
      )}
      <p>Scan with your phone’s camera to open this beginning. Reading uses no turn.</p>
      <a className="qr-bottle-link" href={url}>
        {url}
      </a>
    </div>
  );
}
