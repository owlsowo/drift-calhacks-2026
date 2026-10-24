import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { Hand, LoaderCircle, Smartphone } from 'lucide-react';
import { ShakeMeter } from './shake';
import type { Prompt } from '../../../packages/game-rules/index';
import './shore.css';

type MotionConstructor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
let motionOptedIn = false;

export function GlassBottle({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 180 290"
      className={small ? 'glass-bottle small-glass' : 'glass-bottle'}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={small ? 'glass-small' : 'glass-large'}
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
          fill={`url(#${small ? 'glass-small' : 'glass-large'})`}
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
  busy,
  actionLabel,
  onAction,
  onWrite,
  onCollection,
  count,
  headingRef,
}: {
  mode: 'home' | 'catch';
  prompt?: Prompt;
  disabled: boolean;
  busy: string;
  actionLabel: string;
  onAction: () => Promise<unknown>;
  onWrite: () => Promise<unknown>;
  onCollection: () => void;
  count: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const grip = useRef<HTMLButtonElement>(null);
  const meter = useRef(new ShakeMeter());
  const pointer = useRef<
    { id: number; x: number; y: number; anchorX: number; anchorY: number } | undefined
  >(undefined);
  const fired = useRef(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [motion, setMotion] = useState(motionOptedIn);
  const [motionMessage, setMotionMessage] = useState('');
  const [phone, setPhone] = useState(false);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
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
    if (!motion) return;
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
  }, [motion]);
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
    if (disabled || fired.current) return;
    e.preventDefault();
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
    if (!p || p.id !== e.pointerId || disabled || fired.current) return;
    const x = e.clientX - p.x,
      y = e.clientY - p.y;
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
      className={`shore shore-${mode} ${dragging ? 'is-grabbed' : ''} ${busy ? 'is-searching' : ''}`}
      aria-label={mode === 'catch' ? 'Catch a bottle on the moonlit shore' : 'Drift bottle shore'}
    >
      <div className="shore-heading">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">
          {mode === 'catch' ? 'Something’s washing ashore.' : 'There’s a story out there.'}
        </h1>
        <p>
          {mode === 'catch'
            ? 'Your beginning is on its way. Catch someone else’s.'
            : 'Six words from you. Six from a stranger.'}
        </p>
      </div>
      {mode === 'home' && (
        <div className="shore-prompt">
          <span>Today’s beginning</span>
          <p>{prompt?.setup || 'A little story is washing ashore…'}</p>
          <small>
            {prompt
              ? `Then: ${prompt.reply}`
              : 'Write a beginning, then finish another bottle’s story.'}
          </small>
        </div>
      )}
      <div className="bottle-spotlight" />
      <div className="bottle-ripple" />
      <button
        ref={grip}
        className="bottle-grip"
        aria-label={
          mode === 'catch'
            ? 'Shake the bottle to catch a story'
            : 'Shake the bottle to start writing'
        }
        disabled={disabled}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onClick={(e) => {
          if (e.detail === 0) void activate();
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
            <Hand size={16} />
            {dragging ? 'A little left. A little right.' : 'Grab the bottle. Give it a shake.'}
          </>
        )}
        <div className="shake-meter" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={progress > i / 4 ? 'full' : ''} />
          ))}
        </div>
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
            disabled={disabled}
          >
            <Smartphone size={15} />
            {motion ? 'Turn phone shake off' : 'Enable phone shake'}
          </button>
          <span role="status">{motionMessage}</span>
        </div>
      )}
      <div className="shore-dock">
        <button
          className={`dock-action ${mode === 'home' ? 'dock-primary' : ''}`}
          onClick={() => void onWrite()}
          disabled={disabled || mode === 'catch'}
        >
          <span className="dock-object">
            <GlassBottle small />
          </span>
          <span>{mode === 'home' ? actionLabel : 'Your beginning is sent'}</span>
        </button>
        <button
          className={`dock-action ${mode === 'catch' ? 'dock-primary' : ''}`}
          onClick={() => void activate()}
          disabled={disabled}
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
          <span>{mode === 'catch' ? 'Catch a bottle' : 'Shake to begin'}</span>
        </button>
        <button className="dock-action" onClick={onCollection}>
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
            </svg>
            {count > 0 && <b>{count}</b>}
          </span>
          <span>View my postcards</span>
        </button>
      </div>
      <p className="shore-fine-print">
        {mode === 'catch'
          ? 'A labeled starter may help on a quiet tide. Your own setup stays safe.'
          : 'Write a beginning, catch another, then keep your postcard.'}{' '}
        Buttons and keyboard work too.
      </p>
    </section>
  );
}
