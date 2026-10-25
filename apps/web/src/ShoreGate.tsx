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
const SCRIPT_WAIT_MS = 12000;
const SCRIPT_SELECTOR = 'script[data-drift-turnstile]';
export function ShoreGate({
  onVerified,
  placement = 'inline',
}: {
  onVerified: () => void;
  placement?: 'shore' | 'inline';
}) {
  const node = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('Keeping the bottles human…');
  const [retry, setRetry] = useState(0);
  const verified = useRef(onVerified);
  verified.current = onVerified;
  useEffect(() => {
    let cancelled = false,
      id: string | undefined,
      widgetApi: Turnstile | undefined,
      script: HTMLScriptElement | undefined,
      loadTimer: ReturnType<typeof setTimeout> | undefined;
    setMessage('Keeping the bottles human…');
    const clearLoadTimer = () => clearTimeout(loadTimer);
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    function failed() {
      if (cancelled) return;
      clearLoadTimer();
      if (script) script.dataset.driftTurnstileState = 'failed';
      if (!cancelled) setMessage('The shore check couldn’t load. Try again.');
    }
    const mount = () => {
      if (cancelled || id !== undefined || !node.current || !window.turnstile) return;
      clearLoadTimer();
      widgetApi = window.turnstile;
      try {
        id = widgetApi.render(node.current, {
          sitekey,
          action: 'drift',
          theme: 'light',
          callback: async (token: string) => {
            if (cancelled) return;
            setMessage('Checking your bottle pass…');
            try {
              await game.verifyGate(token);
              if (!cancelled) verified.current();
            } catch {
              if (!cancelled) {
                setMessage('The shore check didn’t finish. Try again.');
                if (id) widgetApi?.reset(id);
              }
            }
          },
          'error-callback': () => {
            if (!cancelled) setMessage('The shore check couldn’t load. Try again.');
          },
          'expired-callback': () => {
            if (!cancelled && id) widgetApi?.reset(id);
          },
        });
      } catch {
        if (!cancelled) setMessage('The shore check couldn’t load. Try again.');
      }
    };
    function loaded() {
      if (cancelled) return;
      if (!window.turnstile) {
        failed();
        return;
      }
      if (script) script.dataset.driftTurnstileState = 'loaded';
      mount();
    }
    function stalled() {
      if (cancelled) return;
      if (window.turnstile) {
        mount();
        return;
      }
      // A pending script can still finish. Keep sharing that request rather than
      // treating a slow connection as a definitive network error.
      if (script) script.dataset.driftTurnstileState = 'stalled';
      setMessage('The shore check is taking longer. Check your connection and try again.');
    }
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
        script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR) ?? undefined;
        // Reusing a failed tag cannot refetch it. Only an explicit new effect/retry
        // replaces it; an API that is loading normally remains shared.
        if (script?.dataset.driftTurnstileState === 'failed') {
          script.remove();
          script = undefined;
        }
        if (script?.dataset.driftTurnstileState === 'stalled')
          script.dataset.driftTurnstileState = 'loading';
        let fresh = false;
        if (!script) {
          fresh = true;
          script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.dataset.driftTurnstile = 'true';
          script.dataset.driftTurnstileState = 'loading';
          // These one-shot state markers survive a component unmount, so a later
          // visit can recover even if loading failed while this gate was absent.
          const sharedScript = script;
          sharedScript.addEventListener(
            'load',
            () => {
              sharedScript.dataset.driftTurnstileState = window.turnstile ? 'loaded' : 'failed';
            },
            { once: true },
          );
          sharedScript.addEventListener(
            'error',
            () => {
              sharedScript.dataset.driftTurnstileState = 'failed';
            },
            { once: true },
          );
        }
        script.addEventListener('load', loaded);
        script.addEventListener('error', failed);
        loadTimer = setTimeout(stalled, SCRIPT_WAIT_MS);
        if (fresh) document.head.append(script);
      });
    return () => {
      cancelled = true;
      clearLoadTimer();
      script?.removeEventListener('load', loaded);
      script?.removeEventListener('error', failed);
      if (id !== undefined) {
        try {
          widgetApi?.remove(id);
        } catch {
          /* The old widget may already be gone. */
        }
      }
    };
  }, [retry]);
  return (
    <section className={`shore-gate shore-gate--${placement}`} aria-label="Quick shore check">
      <p role="status">{message}</p>
      <div ref={node} />
      <button onClick={() => setRetry((value) => value + 1)}>Retry shore check</button>
    </section>
  );
}
