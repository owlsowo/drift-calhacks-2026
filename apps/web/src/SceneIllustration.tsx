import { useEffect, useRef, useState } from 'react';
import type { SceneSpec } from '../../../packages/scene-contracts/index';
import { drawScene, prepareScene, SCENE_HEIGHT, SCENE_WIDTH } from './scene-renderer';
import './scene.css';
import { SceneLoading } from './SceneLoading';

export function SceneIllustration({
  scene,
  className = '',
}: {
  scene: SceneSpec;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let active = true;
    let resize: ResizeObserver | undefined;
    setState('loading');
    const fail = () => {
      resize?.disconnect();
      if (active) setState('failed');
    };
    void prepareScene(scene)
      .then((prepared) => {
        if (!active || !canvas.current) return;
        const target = canvas.current;
        let painted = false;
        const paint = () => {
          if (!active) return;
          try {
            const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
            const width = Math.round(
              (target.getBoundingClientRect().width || SCENE_WIDTH) * pixelRatio,
            );
            const height = Math.round((width * SCENE_HEIGHT) / SCENE_WIDTH);
            if (painted && target.width === width && target.height === height) return;
            target.width = width;
            target.height = height;
            const ctx = target.getContext('2d');
            if (!ctx) throw new Error('Canvas is unavailable.');
            drawScene(ctx, prepared, 0, 0, width, height);
            painted = true;
            return true;
          } catch {
            fail();
            return false;
          }
        };
        if (!paint()) return;
        if (typeof ResizeObserver !== 'undefined') {
          resize = new ResizeObserver(paint);
          resize.observe(target);
        }
        setState('ready');
      })
      .catch(fail);
    return () => {
      active = false;
      resize?.disconnect();
    };
  }, [scene]);

  return (
    <>
      <div className={`scene-illustration ${className}`} data-state={state}>
        <canvas
          ref={canvas}
          width={SCENE_WIDTH}
          height={SCENE_HEIGHT}
          role="img"
          aria-label={scene.alt}
          aria-hidden={state !== 'ready'}
        />
      </div>
      {state === 'failed' && <SceneLoading failed />}
    </>
  );
}
