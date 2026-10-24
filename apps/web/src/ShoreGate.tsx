import { useEffect, useRef, useState } from 'react';
import { game } from './game';
type Turnstile = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export function ShoreGate({ onVerified }: { onVerified: () => void }) {
  const node = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('Keeping the bottles human…');
  const [retry, setRetry] = useState(0);
  const verified = useRef(onVerified);
  verified.current = onVerified;
  useEffect(() => {
    let cancelled = false,
      id: string | undefined;
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const mount = () => {
      if (cancelled || !node.current || !window.turnstile) return;
      id = window.turnstile.render(node.current, {
        sitekey,
        action: 'drift',
        theme: 'light',
        callback: async (token: string) => {
          setMessage('Checking your bottle pass…');
          try {
            await game.verifyGate(token);
            if (!cancelled) verified.current();
          } catch {
            if (!cancelled) {
              setMessage('The shore check didn’t finish. Try again.');
              if (id) window.turnstile?.reset(id);
            }
          }
        },
        'error-callback': () => {
          if (!cancelled) setMessage('The shore check couldn’t load. Try again.');
        },
        'expired-callback': () => {
          if (!cancelled && id) window.turnstile?.reset(id);
        },
      });
    };
    let script: HTMLScriptElement | undefined;
    void game
      .verifyGate('')
      .then(() => {
        if (!cancelled) verified.current();
      })
      .catch(() => {
        if (cancelled) return;
        if (!sitekey) {
          setMessage('The shore check isn’t configured yet. Please try later.');
          return;
        }
        if (window.turnstile) {
          mount();
          return;
        }
        script =
          document.querySelector<HTMLScriptElement>('script[data-drift-turnstile]') ?? undefined;
        if (!script) {
          script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.dataset.driftTurnstile = 'true';
          document.head.append(script);
        }
        script.addEventListener('load', mount);
        script.addEventListener('error', failed);
      });
    function failed() {
      if (!cancelled) setMessage('The shore check couldn’t load. Try again.');
    }
    return () => {
      cancelled = true;
      script?.removeEventListener('load', mount);
      script?.removeEventListener('error', failed);
      if (id) window.turnstile?.remove(id);
    };
  }, [retry]);
  return (
    <section className="shore-gate" aria-label="Quick shore check">
      <p role="status">{message}</p>
      <div ref={node} />
      <button onClick={() => setRetry(retry + 1)}>Retry shore check</button>
    </section>
  );
}
