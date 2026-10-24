import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PaperSurface, NOTE_OPEN_MS } from './PaperSurface';

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
  const [meshReady, setMeshReady] = useState(false);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'closed' | 'unfolding' | 'open'>(() =>
    closed ? 'closed' : reduced() ? 'open' : 'unfolding',
  );
  useEffect(() => {
    if (phase !== 'unfolding') return;
    const timer = setTimeout(() => setPhase('open'), NOTE_OPEN_MS);
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
      className={`paper-note paper-${phase} ${meshReady ? 'has-paper-mesh' : ''} ${postcard ? 'postcard-paper' : ''}`}
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
          <PaperSurface onReady={() => setMeshReady(true)} />
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
