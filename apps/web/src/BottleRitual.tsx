import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { GlassBottle } from './Shore';
import { MotionShakeMeter, ShakeMeter } from './shake';
import './bottle-ritual.css';
import type { ShoreScene } from './shore-scene';
import { AMBIENT_BOTTLE_COUNT } from './ocean-engine/scene-limits.js';

export type BottleRitualKind = 'release' | 'pickup';

type BottleRitualProps = {
  kind: BottleRitualKind;
  phase: 'waiting' | 'moving';
  onComplete: () => void;
  onCancel: () => void;
  worldScene?: ShoreScene;
};

const THROW_MS = 1450;
const ARRIVAL_MS = 750;
const OPEN_MS = 350;
const FADE_MS = 110;
type MotionConstructor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
let phoneShakeOptedIn = false;

/** The sea stays visible underneath this brief, user-triggered interaction. */
export function BottleRitual({ kind, phase, onComplete, onCancel, worldScene }: BottleRitualProps) {
  const labelId = useId();
  const statusId = useId();
  const shadeId = useId();
  const featherId = useId();
  const [choiceCount] = useState(() => 3 + Math.floor(Math.random() * (AMBIENT_BOTTLE_COUNT - 2)));
  const dialog = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const worldButtons = useRef(new Map<number, HTMLButtonElement>());
  const lightOpenings = useRef(new Map<number, SVGEllipseElement>());
  const cancelButton = useRef<HTMLButtonElement>(null);
  const motionButton = useRef<HTMLButtonElement>(null);
  const grip = useRef<HTMLSpanElement>(null);
  const meter = useRef(new ShakeMeter());
  const phoneMeter = useRef(new MotionShakeMeter());
  const pointer = useRef<
    { id: number; x: number; y: number; anchorX: number; anchorY: number } | undefined
  >(undefined);
  const moved = useRef(false);
  const mounted = useRef(true);
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
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phone, setPhone] = useState(false);
  const [motion, setMotion] = useState(phoneShakeOptedIn);
  const [motionPending, setMotionPending] = useState(false);
  const [motionMessage, setMotionMessage] = useState('');

  useEffect(() => {
    if (!worldScene || kind !== 'pickup') return;
    const paint = () => {
      for (let i = 0; i < choiceCount; i++) {
        const target = worldButtons.current.get(i);
        if (!target) continue;
        const point = worldScene.choiceTarget(i);
        const size = Math.max(48, Math.min(90, point.size * 1.4));
        target.style.width = `${size}px`;
        target.style.height = `${size}px`;
        target.style.transform = `translate3d(${point.x}px,${point.y}px,0) translate(-50%,-50%)`;
        const radiusX = Math.max(62, size * 1.3);
        const radiusY = Math.max(44, size * 0.95);
        target.style.setProperty('--spotlight-width', `${radiusX * 2}px`);
        target.style.setProperty('--spotlight-height', `${radiusY * 2}px`);
        target.style.setProperty(
          '--beam-height',
          `${Math.max(140, point.y - innerHeight * 0.12)}px`,
        );
        const opening = lightOpenings.current.get(i);
        if (opening) {
          opening.setAttribute('cx', String(point.x));
          opening.setAttribute('cy', String(point.y));
          opening.setAttribute('rx', String(radiusX));
          opening.setAttribute('ry', String(radiusY));
        }
      }
    };
    const unsubscribe = worldScene.subscribe(paint);
    worldScene.showChoices(true, choiceCount);
    paint();
    return () => {
      unsubscribe();
      worldScene.showChoices(false);
    };
  }, [worldScene, kind, choiceCount]);
  useEffect(() => {
    if (worldScene && kind === 'release' && phase === 'moving') worldScene.throwBottle();
  }, [worldScene, kind, phase]);

  function finish() {
    if (completed.current) return;
    completed.current = true;
    completeRef.current();
  }

  useEffect(() => {
    mounted.current = true;
    setPhone(matchMedia('(pointer: coarse)').matches && 'DeviceMotionEvent' in window);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    const visibility = () => {
      setHidden(document.visibilityState === 'hidden');
      releasePointer();
      phoneMeter.current.reset();
      setProgress(0);
    };
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
      mounted.current = false;
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
    if (
      !arrived ||
      completed.current ||
      openingRef.current ||
      document.visibilityState !== 'visible'
    )
      return;
    openingRef.current = true;
    setOpening(true);
    dialog.current?.focus({ preventScroll: true });
  }

  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (worldScene || !motion || kind !== 'pickup' || !arrived || opening || hidden) return;
    phoneMeter.current.reset();
    const listener = (event: DeviceMotionEvent) => {
      if (openingRef.current || pointer.current || document.visibilityState !== 'visible') return;
      const result = phoneMeter.current.sample(
        event.acceleration,
        event.accelerationIncludingGravity,
        performance.now(),
      );
      if (!result) return;
      setProgress(result.progress);
      if (result.complete) openRef.current();
    };
    window.addEventListener('devicemotion', listener);
    return () => {
      window.removeEventListener('devicemotion', listener);
      phoneMeter.current.reset();
    };
  }, [worldScene, motion, kind, arrived, opening, hidden]);

  async function enableMotion() {
    if (motionPending) return;
    if (!isSecureContext) {
      setMotionMessage('Phone shake needs HTTPS. You can still drag or tap the bottle.');
      return;
    }
    setMotionPending(true);
    try {
      const constructor = DeviceMotionEvent as MotionConstructor;
      const permission = constructor.requestPermission
        ? await constructor.requestPermission()
        : 'granted';
      if (!mounted.current) return;
      if (permission !== 'granted') {
        setMotionMessage('Motion wasn’t enabled. Drag or tap the bottle to open it.');
        return;
      }
      phoneShakeOptedIn = true;
      setMotion(true);
      setMotionMessage('Shake your phone gently, or tap the bottle.');
    } catch {
      if (mounted.current) setMotionMessage('Motion isn’t available here. Drag or tap the bottle.');
    } finally {
      if (mounted.current) {
        setMotionPending(false);
        openButton.current?.focus({ preventScroll: true });
      }
    }
  }

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (!arrived || openingRef.current || !event.isPrimary || event.button !== 0) return;
    moved.current = false;
    meter.current.reset();
    phoneMeter.current.reset();
    setProgress(0);
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      anchorX: event.clientX,
      anchorY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId || openingRef.current) return;
    const x = event.clientX - active.x,
      y = event.clientY - active.y;
    if (Math.hypot(x, y) > 8) moved.current = true;
    if (!reducedMotion) {
      grip.current?.style.setProperty('--grip-x', `${Math.max(-90, Math.min(90, x))}px`);
      grip.current?.style.setProperty('--grip-y', `${Math.max(-45, Math.min(45, y))}px`);
      grip.current?.style.setProperty('--grip-angle', `${Math.max(-24, Math.min(24, x / 3))}deg`);
    }
    const dx = event.clientX - active.anchorX,
      dy = event.clientY - active.anchorY;
    if (Math.hypot(dx, dy) < 18) return;
    const result = meter.current.hit(Math.abs(dx) >= Math.abs(dy) ? dx : dy, performance.now());
    active.anchorX = event.clientX;
    active.anchorY = event.clientY;
    setProgress(result.progress);
    if (result.complete) open();
  }

  function releasePointer() {
    pointer.current = undefined;
    setDragging(false);
    meter.current.reset();
    if (!openingRef.current) setProgress(0);
    for (const property of ['--grip-x', '--grip-y', '--grip-angle'])
      grip.current?.style.removeProperty(property);
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
    const buttons = [
      ...(worldScene ? worldButtons.current.values() : [openButton.current, motionButton.current]),
      cancelButton.current,
    ].filter((button): button is HTMLButtonElement => Boolean(button && !button.disabled));
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
      className={`bottle-ritual${worldScene ? ' bottle-ritual--world' : ''} bottle-ritual--${kind} bottle-ritual--${state}${reducedMotion ? ' bottle-ritual--reduced' : ''}${hidden ? ' bottle-ritual--hidden' : ''}${dragging ? ' bottle-ritual--dragging' : ''}`}
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
            ? worldScene
              ? `${choiceCount} bottles are ready. Choose any bottle to open.`
              : 'A bottle is ready to open.'
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
      {worldScene && kind === 'pickup' ? (
        <>
          <svg className="bottle-ritual__world-shade" aria-hidden="true">
            <defs>
              <filter id={featherId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="12" />
              </filter>
              <mask id={shadeId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                <rect width="100%" height="100%" fill="white" />
                <g fill="black" filter={`url(#${featherId})`}>
                  {Array.from({ length: choiceCount }, (_, index) => (
                    <ellipse
                      key={index}
                      ref={(node) => {
                        if (node) lightOpenings.current.set(index, node);
                        else lightOpenings.current.delete(index);
                      }}
                    />
                  ))}
                </g>
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(3, 13, 29, 0.74)"
              mask={`url(#${shadeId})`}
            />
          </svg>
          <p className="bottle-ritual__world-title">Pick the one that calls to you.</p>
          {Array.from({ length: choiceCount }, (_, index) => (
            <button
              type="button"
              key={index}
              className="bottle-ritual__world-choice"
              ref={(node) => {
                if (node) worldButtons.current.set(index, node);
                else worldButtons.current.delete(index);
                if (index === 0) openButton.current = node;
              }}
              aria-label={index === 0 ? 'Open bottle' : `Open bottle ${index + 1}`}
              disabled={!arrived || opening || hidden}
              onClick={open}
              data-bottle-choice={index + 1}
            >
              <span aria-hidden="true">{index + 1}</span>
            </button>
          ))}
        </>
      ) : kind === 'release' ? (
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
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onLostPointerCapture={releasePointer}
          onClick={(event) => {
            if (event.detail === 0 || !moved.current) open();
          }}
        >
          <span className="bottle-ritual__found" aria-hidden="true">
            <span className="bottle-ritual__grip" ref={grip}>
              <GlassBottle />
            </span>
          </span>
          <span className="bottle-ritual__open-label" aria-hidden="true">
            Open bottle
          </span>
        </button>
      )}
      {kind === 'pickup' && !worldScene && arrived && !opening && (
        <div className="bottle-ritual__gesture">
          <p>Drag to shake, or tap to open.</p>
          <span className="bottle-ritual__beats" aria-hidden="true">
            {[1, 2, 3, 4].map((beat) => (
              <i key={beat} className={progress * 4 >= beat ? 'is-filled' : ''} />
            ))}
          </span>
          {phone && (
            <button
              type="button"
              ref={motionButton}
              onClick={() => {
                if (!motion) {
                  void enableMotion();
                  return;
                }
                phoneShakeOptedIn = false;
                setMotion(false);
                phoneMeter.current.reset();
                setProgress(0);
                setMotionMessage('Phone shake is off. Drag or tap the bottle.');
              }}
              disabled={motionPending}
            >
              {motionPending ? 'Enabling…' : motion ? 'Turn off phone shake' : 'Enable phone shake'}
            </button>
          )}
          {(motionMessage || motion) && (
            <p className="bottle-ritual__motion-message" role="status">
              {motionMessage || 'Phone shake is on. You can also tap the bottle.'}
            </p>
          )}
        </div>
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
