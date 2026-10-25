import { useEffect, useRef, useState } from 'react';
import './ocean.css';

type OceanController = { setPaused: (paused: boolean) => void; destroy: () => void };
type OceanModule = {
  createOcean: (
    canvas: HTMLCanvasElement,
    options: {
      paused: boolean;
      signal: AbortSignal;
      onReady: () => void;
      onError: (error: unknown) => void;
    },
  ) => Promise<OceanController>;
};

export function Ocean({ paused = false }: { paused?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<OceanController | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = canvas.current!;
    const abort = new AbortController();
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => controller.current?.setPaused(pausedRef.current || media.matches);
    const fallback = () => {
      if (abort.signal.aborted) return;
      target.dataset.renderer = 'photograph';
      setReady(false);
    };
    media.addEventListener('change', update);
    const start = async () => {
      try {
        // Locally vendored MIT engine; no CDN, iframe, free camera, or settings UI.
        const engine: OceanModule = await import('./ocean-engine/main.js');
        if (abort.signal.aborted) return;
        const active = await engine.createOcean(target, {
          paused: pausedRef.current || media.matches,
          signal: abort.signal,
          onReady: () => {
            if (abort.signal.aborted) return;
            target.dataset.renderer = 'webgpu-fft';
            setReady(true);
          },
          onError: fallback,
        });
        if (abort.signal.aborted) active.destroy();
        else {
          controller.current = active;
          update();
        }
      } catch {
        fallback();
      }
    };
    void start();
    return () => {
      abort.abort();
      media.removeEventListener('change', update);
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.setPaused(paused || matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [paused]);

  return (
    <div className={`ocean-world fft-ocean${ready ? ' ocean-ready' : ''}`} aria-hidden="true">
      <div className="ocean-photograph">
        <canvas ref={canvas} className="sea-surface fft-surface" aria-hidden="true" />
      </div>
      {ready && (
        <svg
          className="coast-headland fft-headland"
          viewBox="0 0 100 120"
          fill="none"
          aria-hidden="true"
        >
          <path d="m0 114 19-9 14 2 16-6 21 7 12-2 18 8v6H0Z" fill="#142532" />
          <path d="m39 106 4-76h15l5 76Z" fill="#c5c9ba" />
          <path d="M42 48h17l1 16H41Zm-2 33h21l1 15H39Z" fill="#9f6d5d" />
          <path d="M40 26h21v7H40Z" fill="#162c3d" />
          <path d="M43 12h15v14H43Z" fill="#eadba9" />
          <path d="m39 12 11-9 12 9Z" fill="#142d3b" />
          <circle cx="50" cy="20" r="4" fill="#fff1be" />
        </svg>
      )}
    </div>
  );
}
