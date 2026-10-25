import { useEffect, useRef, useState } from 'react';
import type { CoastPeriod } from './coast-time';
import type { ShoreScene } from './shore-scene';
import './ocean.css';

type OceanController = {
  setPaused: (paused: boolean) => void;
  setTimeOfDay: (period: CoastPeriod) => void;
  destroy: () => void;
};
type OceanModule = {
  createOcean: (
    canvas: HTMLCanvasElement,
    options: {
      paused: boolean;
      scene?: ShoreScene;
      timeOfDay: CoastPeriod;
      signal: AbortSignal;
      onReady: () => void;
      onError: (error: unknown) => void;
    },
  ) => Promise<OceanController>;
};

export function Ocean({
  paused = false,
  timeOfDay,
  scene,
}: {
  paused?: boolean;
  timeOfDay: CoastPeriod;
  scene?: ShoreScene;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<OceanController | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const periodRef = useRef(timeOfDay);
  periodRef.current = timeOfDay;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = canvas.current!;
    const abort = new AbortController();
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => controller.current?.setPaused(pausedRef.current || media.matches);
    const fallback = () => {
      if (abort.signal.aborted) return;
      target.dataset.renderer = 'coast-art';
      target.dataset.motion = 'paused';
      scene?.setRenderer('fallback');
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
          scene,
          timeOfDay: periodRef.current,
          signal: abort.signal,
          onReady: () => {
            if (abort.signal.aborted) return;
            target.dataset.renderer = 'webgpu-fft';
            setReady(true);
            scene?.setRenderer('webgpu');
          },
          onError: fallback,
        });
        if (abort.signal.aborted) active.destroy();
        else {
          controller.current = active;
          active.setTimeOfDay(periodRef.current);
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
  }, [scene]);

  useEffect(() => {
    controller.current?.setPaused(paused || matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [paused]);

  useEffect(() => {
    controller.current?.setTimeOfDay(timeOfDay);
  }, [timeOfDay]);

  return (
    <div
      className={`ocean-world fft-ocean${ready ? ' ocean-ready' : ''}`}
      data-time-of-day={timeOfDay}
      aria-hidden="true"
    >
      <div className="ocean-photograph">
        <canvas ref={canvas} className="sea-surface fft-surface" aria-hidden="true" />
      </div>
      {ready && (
        <div className="coast-headland fft-headland">
          <img
            src={
              timeOfDay === 'day'
                ? '/assets/coast-headland-day.webp'
                : '/assets/coast-headland.webp'
            }
            alt=""
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
