import { useEffect, useId, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { LoaderCircle, Smartphone } from 'lucide-react';
import { ShakeMeter } from './shake';
import { FIRST_TIDE_DAY, type Prompt } from '../../../packages/game-rules/index';
import './shore.css';

type MotionConstructor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
let motionOptedIn = false;

export function GlassBottle({ small = false }: { small?: boolean }) {
  const glassId = useId();
  return (
    <svg
      viewBox="0 0 180 290"
      className={small ? 'glass-bottle small-glass' : 'glass-bottle'}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={glassId}
          x1="40"
          y1="140"
          x2="140"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#c8e9dc" stopOpacity=".66" />
          <stop offset=".25" stopColor="#c7e4db" stopOpacity=".17" />
          <stop offset=".75" stopColor="#416e72" stopOpacity=".28" />
          <stop offset="1" stopColor="#bfe0c9" stopOpacity=".64" />
        </linearGradient>
      </defs>
      <g className="floating-bottle">
        <path
          d="M69 45h43v58c0 14 9 24 21 36 11 11 15 23 15 38v73c0 17-12 28-29 28H62c-17 0-29-11-29-28v-73c0-15 4-27 15-38 12-12 21-22 21-36V45Z"
          fill={`url(#${glassId})`}
          stroke="#c3e5d6"
          strokeWidth="2"
        />
        <path
          d="M71 48h39M70 65h42M78 78v30c0 19-17 32-27 45-5 8-7 19-7 28v63"
          stroke="#e8f8e8"
          strokeOpacity=".66"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M126 166c5 6 7 13 7 24v59c0 9-3 13-10 16"
          stroke="#daedc4"
          strokeOpacity=".5"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="m68 35 2-16 42 3-1 16" fill="#b58a51" stroke="#e3bf81" strokeWidth="1.5" />
        <path d="m78 23-1 10m12-9-1 9m12-8-1 9" stroke="#6f5235" strokeWidth="1.5" />
        <path
          d="M65 38h51v14H65z"
          fill="#8fb2a4"
          fillOpacity=".7"
          stroke="#d4e9cf"
          strokeWidth="2"
        />
        <g transform="rotate(-9 90 203)">
          <rect x="58" y="159" width="66" height="91" rx="3" fill="#e8d8b4" />
          <path d="M65 167h52m-52 7h52m-52 8h46" stroke="#d0bc96" strokeWidth="1" />
          <path
            d="M71 200h39m-39 8h35m-35 8h40m-40 8h27"
            stroke="#8c8b74"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M66 241h49" stroke="#bfab88" />
        </g>
        <path
          d="M35 237c24 5 70-5 111 0v15c0 15-11 24-26 24H62c-16 0-27-10-27-25v-14Z"
          fill="#6fa39a"
          fillOpacity=".28"
        />
      </g>
    </svg>
  );
}

export function Shore({
  mode,
  prompt,
  disabled,
  writeDisabled = disabled,
  pickDisabled = disabled,
  busy,
  actionLabel,
  onAction,
  onWrite,
  onCollection,
  count,
  returnedCount = 0,
  empty = false,
  headingRef,
  restingMessage,
}: {
  mode: 'home' | 'catch';
  prompt?: Prompt;
  disabled: boolean;
  writeDisabled?: boolean;
  pickDisabled?: boolean;
  busy: string;
  actionLabel: string;
  onAction: () => Promise<unknown>;
  onWrite: () => Promise<unknown>;
  onCollection: () => void;
  count: number;
  returnedCount?: number;
  empty?: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  restingMessage?: string;
}) {
  const grip = useRef<HTMLButtonElement>(null);
  const emptyHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (empty) emptyHeading.current?.focus();
  }, [empty]);
  const meter = useRef(new ShakeMeter());
  const pointer = useRef<
    { id: number; x: number; y: number; anchorX: number; anchorY: number } | undefined
  >(undefined);
  const fired = useRef(false);
  const moved = useRef(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [motion, setMotion] = useState(motionOptedIn);
  const [motionMessage, setMotionMessage] = useState('');
  const [phone, setPhone] = useState(false);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  const disabledRef = useRef(pickDisabled);
  disabledRef.current = pickDisabled;
  useEffect(() => {
    setPhone(matchMedia('(pointer: coarse)').matches && 'DeviceMotionEvent' in window);
  }, []);
  async function activate() {
    if (disabledRef.current || fired.current) return;
    fired.current = true;
    try {
      await actionRef.current();
    } finally {
      fired.current = false;
      meter.current.reset();
      setProgress(0);
    }
  }
  const activateRef = useRef(activate);
  activateRef.current = activate;
  function beat(direction: number, time: number) {
    const result = meter.current.hit(direction, time);
    setProgress(result.progress);
    if (result.complete) void activateRef.current();
  }
  useEffect(() => {
    if (!motion || mode !== 'catch') return;
    let gravity = [0, 0, 0];
    const listener = (e: DeviceMotionEvent) => {
      if (disabledRef.current || document.visibilityState !== 'visible' || fired.current) return;
      let values = [e.acceleration?.x, e.acceleration?.y, e.acceleration?.z];
      if (!values.some((v) => v != null)) {
        const g = e.accelerationIncludingGravity;
        values = [g?.x, g?.y, g?.z].map((v, i) => {
          const n = v ?? 0;
          gravity[i] = gravity[i] * 0.85 + n * 0.15;
          return n - gravity[i];
        });
      }
      const strongest = values.reduce<number>(
        (a, b) => (Math.abs(b ?? 0) > Math.abs(a) ? (b ?? 0) : a),
        0,
      );
      if (Math.abs(strongest) > 8) beat(strongest, performance.now());
    };
    window.addEventListener('devicemotion', listener);
    return () => window.removeEventListener('devicemotion', listener);
  }, [motion, mode]);
  async function enableMotion() {
    if (!isSecureContext) {
      setMotionMessage('Phone shake needs HTTPS. You can drag the bottle or use the buttons.');
      return;
    }
    try {
      const constructor = DeviceMotionEvent as MotionConstructor;
      const permission = constructor.requestPermission
        ? await constructor.requestPermission()
        : 'granted';
      if (permission !== 'granted') {
        setMotionMessage('Motion wasn’t enabled. Drag the bottle or use the buttons.');
        return;
      }
      meter.current.reset();
      motionOptedIn = true;
      setMotion(true);
      setMotionMessage('Phone shake is on for this shore.');
    } catch {
      setMotionMessage('Motion isn’t available here. Drag the bottle or use the buttons.');
    }
  }
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (pickDisabled || fired.current) return;
    e.preventDefault();
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      anchorX: e.clientX,
      anchorY: e.clientY,
    };
    meter.current.reset();
    setProgress(0);
    setDragging(true);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId || pickDisabled || fired.current) return;
    const x = e.clientX - p.x,
      y = e.clientY - p.y;
    if (Math.hypot(x, y) > 8) moved.current = true;
    grip.current?.style.setProperty('--drag-x', `${Math.max(-110, Math.min(110, x))}px`);
    grip.current?.style.setProperty('--drag-y', `${Math.max(-55, Math.min(55, y))}px`);
    grip.current?.style.setProperty('--drag-angle', `${Math.max(-24, Math.min(24, x / 4))}deg`);
    const dx = e.clientX - p.anchorX,
      dy = e.clientY - p.anchorY;
    if (Math.hypot(dx, dy) >= 18) {
      beat(Math.abs(dx) >= Math.abs(dy) ? dx : dy, performance.now());
      p.anchorX = e.clientX;
      p.anchorY = e.clientY;
    }
  }
  function release() {
    pointer.current = undefined;
    setDragging(false);
    for (const key of ['--drag-x', '--drag-y', '--drag-angle'])
      grip.current?.style.removeProperty(key);
    if (!fired.current) {
      meter.current.reset();
      setProgress(0);
    }
  }
  return (
    <section
      className={`shore shore-${mode} ${empty ? 'shore-empty' : ''} ${dragging ? 'is-grabbed' : ''} ${busy ? 'is-searching' : ''}`}
      aria-label={mode === 'catch' ? 'Catch a bottle on the moonlit shore' : 'Drift bottle shore'}
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {mode === 'catch' ? 'Find a bottle on the shore' : 'Drift, a few words between strangers'}
      </h1>
      {mode === 'home' && !empty && restingMessage && (
        <div className="shore-whisper">
          <p>{restingMessage}</p>
        </div>
      )}
      {empty && (
        <div className="quiet-tide-note">
          <div role="status">
            <h2 ref={emptyHeading} tabIndex={-1}>
              No bottles available.
            </h2>
            <p>Release a beginning, or try picking up again later.</p>
          </div>
          <div className="quiet-tide-actions">
            {
              <button disabled={writeDisabled} onClick={() => void onWrite()}>
                Release a beginning
              </button>
            }
            <button disabled={pickDisabled} onClick={() => void activate()}>
              Try again
            </button>
          </div>
        </div>
      )}
      {mode === 'catch' && (
        <>
          <div className="bottle-spotlight" />
          <div className="bottle-ripple" />
          <button
            ref={grip}
            className="bottle-grip"
            aria-label="Pick up the drifting bottle"
            disabled={pickDisabled}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onClick={(e) => {
              if (e.detail === 0 || !moved.current) void activate();
            }}
          >
            <GlassBottle />
          </button>
          <div className="shake-instruction" aria-live="polite">
            {busy ? (
              <>
                <LoaderCircle className="spin" size={16} />
                {busy}
              </>
            ) : (
              <>
                {dragging ? 'Keep shaking to pick it up.' : 'Tap or shake the bottle to open it.'}
              </>
            )}
            {progress > 0 && (
              <div className="shake-meter" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className={progress > i / 4 ? 'full' : ''} />
                ))}
              </div>
            )}
          </div>
          {phone && (
            <div className="phone-shake">
              <button
                onClick={() => {
                  if (motion) {
                    motionOptedIn = false;
                    setMotion(false);
                    setMotionMessage('');
                  } else void enableMotion();
                }}
                disabled={pickDisabled}
              >
                <Smartphone size={15} />
                {motion ? 'Turn phone shake off' : 'Enable phone shake'}
              </button>
              <span role="status">{motionMessage}</span>
            </div>
          )}
        </>
      )}
      <div className="shore-dock" role="group" aria-label="Bottles on the shore">
        <button
          className={`dock-action ${mode === 'home' ? 'dock-primary' : ''}`}
          aria-label={mode === 'home' ? `Release a bottle. ${actionLabel}` : 'Release a bottle'}
          onClick={() => void onWrite()}
          disabled={writeDisabled}
        >
          <span className="dock-object">
            <GlassBottle small />
          </span>
          <span>Release</span>
        </button>
        <button
          className={`dock-action ${mode === 'catch' ? 'dock-primary' : ''}`}
          aria-label="Pick up a bottle. Write an ending"
          onClick={() => void activate()}
          disabled={pickDisabled}
        >
          <span className="dock-object dock-net">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <defs>
                <linearGradient id="pick-beam" x2="0" y2="1">
                  <stop stopColor="#f4e9a0" stopOpacity=".9" />
                  <stop offset="1" stopColor="#d3edbb" stopOpacity=".18" />
                </linearGradient>
              </defs>
              <path d="m30 7-22 45h48L34 7Z" fill="url(#pick-beam)" />
              <ellipse
                cx="32"
                cy="52"
                rx="24"
                ry="6"
                fill="#c7e6ca"
                fillOpacity=".6"
                stroke="#d0ead6"
              />
              <ellipse cx="32" cy="7" rx="4" ry="3" fill="#f9edac" />
            </svg>
          </span>
          <span>Pick up</span>
        </button>
        <button
          className={`dock-action ${returnedCount ? 'dock-returned' : ''}`}
          onClick={onCollection}
          aria-label={returnedCount ? `My bottles. ${returnedCount} replies today` : 'My bottles'}
        >
          <span className="dock-object">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <g fill="#b5d9ca" stroke="#e0e9cd">
                <path d="M12 29V9h7v18l5 9v18H8V36Z" />
                <path d="M32 24V4h7v18l5 9v23H28V31Z" />
                <path d="M47 29V9h7v18l5 9v18H43V36Z" />
              </g>
              <path d="m5 36 7 25h42l6-25Z" fill="#8b9e9d" stroke="#d0dbd1" />
              <ellipse
                cx="32"
                cy="36"
                rx="27"
                ry="6"
                fill="#becdc4"
                fillOpacity=".55"
                stroke="#e1e7d8"
              />
              <path d="M16 42v15m16-14v16m16-17v15" stroke="#5f7b7d" />
              {returnedCount > 0 && (
                <g className="returned-seal">
                  <path d="m35 14-3 15 6-3 4 5 1-17" fill="#ae4e3f" />
                  <circle cx="38" cy="13" r="7" fill="#a9473a" stroke="#eac1a2" />
                  <path
                    d="M36 10h2a3 3 0 0 1 0 6h-2z"
                    stroke="#fff0cb"
                    strokeWidth="1.3"
                    fill="none"
                  />
                </g>
              )}
            </svg>
            {count > 0 && <b>{count}</b>}
          </span>
          <span>My bottles</span>
        </button>
      </div>
      {returnedCount > 0 && (
        <p className="shore-fine-print" role="status">
          {returnedCount} {returnedCount === 1 ? 'reply' : 'replies'} today
        </p>
      )}
    </section>
  );
}
