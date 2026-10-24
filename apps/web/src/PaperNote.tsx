import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

export function PaperNote({
  children,
  closed = false,
  postcard = false,
}: {
  children: ReactNode;
  closed?: boolean;
  postcard?: boolean;
}) {
  const note = useRef<HTMLDivElement>(null);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'closed' | 'unfolding' | 'open'>(() =>
    closed ? 'closed' : reduced() ? 'open' : 'unfolding',
  );
  useEffect(() => {
    if (phase !== 'unfolding') return;
    const timer = setTimeout(() => setPhase('open'), 1250);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (!closed && phase === 'closed') setPhase('open');
  }, [closed, phase]);
  useEffect(() => {
    if (phase === 'unfolding') return;
    const target = note.current?.querySelector<HTMLElement>(
      phase === 'closed' ? '.open-bottle' : '[tabindex="-1"]',
    );
    target?.focus({ preventScroll: true });
  }, [phase]);
  return (
    <div
      ref={note}
      className={`paper-note paper-${phase} ${postcard ? 'postcard-paper' : ''}`}
      data-paper-phase={phase}
    >
      {phase === 'closed' && (
        <button className="open-bottle" onClick={() => setPhase(reduced() ? 'open' : 'unfolding')}>
          <img src="/assets/paper-ball.png" alt="" draggable={false} />
          <span>Open bottle</span>
          <small>Someone’s words are inside.</small>
        </button>
      )}
      {phase === 'unfolding' && (
        <>
          <img className="unfolding-ball" src="/assets/paper-ball.png" alt="" draggable={false} />
          <div className="paper-facets" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                style={
                  {
                    '--col': i % 3,
                    '--row': Math.floor(i / 3),
                    '--fold-x': `${(1 - (i % 3)) * 52}px`,
                    '--fold-y': `${(1 - Math.floor(i / 3)) * 47}px`,
                    '--fold-turn': `${i % 2 ? 57 : -62}deg`,
                    '--delay': `${i * 22}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <span className="sr-only" role="status">
            Unfolding the note.
          </span>
        </>
      )}
      <div className="paper-content" inert={phase !== 'open'} aria-hidden={phase !== 'open'}>
        {children}
      </div>
    </div>
  );
}
