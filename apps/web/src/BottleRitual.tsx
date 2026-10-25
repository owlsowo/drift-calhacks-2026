import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { GlassBottle } from './Shore';
import './bottle-ritual.css';

export type BottleRitualKind = 'release' | 'pickup';

type BottleRitualProps = {
  kind: BottleRitualKind;
  phase: 'waiting' | 'moving';
  onComplete: () => void;
  onCancel: () => void;
};

const THROW_MS = 1450;
const ARRIVAL_MS = 750;
const OPEN_MS = 350;
const FADE_MS = 110;

/** The sea stays visible underneath this brief, user-triggered interaction. */
export function BottleRitual({ kind, phase, onComplete, onCancel }: BottleRitualProps) {
  const labelId = useId();
  const statusId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const completed = useRef(false);
  const openingRef = useRef(false);
  const completeRef = useRef(onComplete);
  const cancelRef = useRef(onCancel);
  completeRef.current = onComplete;
  cancelRef.current = onCancel;
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  const [arrived, setArrived] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showWaiting, setShowWaiting] = useState(false);
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden');

  function finish() {
    if (completed.current) return;
    completed.current = true;
    completeRef.current();
  }

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    const visibility = () => setHidden(document.visibilityState === 'hidden');
    const scrollStyles = [document.documentElement.style, document.body.style].map((style) => ({
      style,
      value: style.getPropertyValue('overflow'),
      priority: style.getPropertyPriority('overflow'),
    }));
    scrollStyles.forEach(({ style }) => style.setProperty('overflow', 'hidden'));
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    dialog.current?.focus({ preventScroll: true });
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', visibility);
      scrollStyles.forEach(({ style, value, priority }) => {
        if (value) style.setProperty('overflow', value, priority);
        else style.removeProperty('overflow');
      });
    };
  }, []);

  useEffect(() => {
    if (phase !== 'waiting') {
      setShowWaiting(false);
      return;
    }
    const timer = window.setTimeout(() => setShowWaiting(true), 1000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'moving') return;
    // A timer also completes the ritual when animation events are interrupted or unavailable.
    const duration = reducedMotion ? FADE_MS : kind === 'release' ? THROW_MS : ARRIVAL_MS;
    const timer = window.setTimeout(() => {
      if (kind === 'release') finish();
      else setArrived(true);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [kind, phase, reducedMotion]);

  useEffect(() => {
    if (!arrived || opening) return;
    openButton.current?.focus({ preventScroll: true });
  }, [arrived, opening]);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(finish, reducedMotion ? FADE_MS : OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [opening, reducedMotion]);

  function open() {
    if (!arrived || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    dialog.current?.focus({ preventScroll: true });
  }

  function cancel() {
    if (kind !== 'pickup' || phase !== 'moving' || openingRef.current || completed.current) return;
    completed.current = true;
    cancelRef.current();
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [openButton.current, cancelButton.current].filter(
      (button): button is HTMLButtonElement => Boolean(button && !button.disabled),
    );
    if (!buttons.length) {
      event.preventDefault();
      dialog.current?.focus({ preventScroll: true });
      return;
    }
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey
      ? index <= 0
        ? buttons.length - 1
        : index - 1
      : index < 0 || index === buttons.length - 1
        ? 0
        : index + 1;
    event.preventDefault();
    buttons[next].focus({ preventScroll: true });
  }

  const state = opening ? 'opening' : arrived ? 'arrived' : phase;
  return (
    <div
      className={`bottle-ritual bottle-ritual--${kind} bottle-ritual--${state}${reducedMotion ? ' bottle-ritual--reduced' : ''}${hidden ? ' bottle-ritual--hidden' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-describedby={statusId}
      tabIndex={-1}
      ref={dialog}
      onKeyDown={keyDown}
      data-kind={kind}
      data-phase={state}
    >
      <h2 id={labelId} className="bottle-ritual__sr-only">
        {kind === 'release' ? 'Release bottle' : 'Pick up bottle'}
      </h2>
      <p id={statusId} className="bottle-ritual__sr-only" role="status">
        {kind === 'release'
          ? 'Releasing your bottle.'
          : arrived
            ? 'A bottle is ready to open.'
            : 'Finding a bottle.'}
      </p>
      <div className="bottle-ritual__shade" aria-hidden="true" />
      <div className="bottle-ritual__beam" aria-hidden="true" />
      <div className="bottle-ritual__pool" aria-hidden="true" />
      <div className="bottle-ritual__rings" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      {kind === 'release' ? (
        <div className="bottle-ritual__thrown" aria-hidden="true">
          <GlassBottle />
        </div>
      ) : (
        <button
          type="button"
          className="bottle-ritual__open"
          ref={openButton}
          aria-label="Open bottle"
          disabled={!arrived || opening}
          onClick={open}
        >
          <span className="bottle-ritual__found" aria-hidden="true">
            <GlassBottle />
          </span>
          <span className="bottle-ritual__open-label" aria-hidden="true">
            Open bottle
          </span>
        </button>
      )}
      {showWaiting && (
        <p className="bottle-ritual__waiting" aria-hidden="true">
          {kind === 'release' ? 'Releasing…' : 'Finding a bottle…'}
        </p>
      )}
      {kind === 'pickup' && phase === 'moving' && !opening && (
        <button type="button" className="bottle-ritual__cancel" ref={cancelButton} onClick={cancel}>
          Back to sea
        </button>
      )}
    </div>
  );
}
