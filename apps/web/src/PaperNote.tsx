import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GlassBottle } from './Shore';

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
  const [open, setOpen] = useState(!closed);
  useEffect(() => {
    if (!closed) setOpen(true);
  }, [closed]);
  useEffect(() => {
    const target = note.current?.querySelector<HTMLElement>(
      open ? '[tabindex="-1"]' : '.open-bottle',
    );
    target?.focus({ preventScroll: true });
  }, [open]);
  return (
    <div
      ref={note}
      className={`paper-note paper-${open ? 'open' : 'closed'} ${postcard ? 'postcard-paper' : ''}`}
      data-paper-phase={open ? 'open' : 'closed'}
    >
      {!open && (
        <button className="open-bottle" onClick={() => setOpen(true)}>
          <GlassBottle />
          <span>Open bottle</span>
        </button>
      )}
      {open && <div className="paper-content">{children}</div>}
    </div>
  );
}
