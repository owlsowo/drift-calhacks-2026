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
      target.dataset.renderer = 'coast-art';
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
        <div className="coast-headland fft-headland">
          <img src="/assets/coast-headland.webp" alt="" draggable={false} />
        </div>
      )}
    </div>
  );
}
