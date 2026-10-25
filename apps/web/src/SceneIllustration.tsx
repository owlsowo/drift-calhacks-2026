import { useEffect, useRef, useState } from 'react';
import type { SceneSpec } from '../../../packages/scene-contracts/index';
import { drawScene, prepareScene, SCENE_HEIGHT, SCENE_WIDTH } from './scene-renderer';
import './scene.css';

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
    void prepareScene(scene)
      .then((prepared) => {
        if (!active || !canvas.current) return;
        const target = canvas.current;
        let painted = false;
        const paint = () => {
          if (!active) return;
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
        };
        paint();
        if (typeof ResizeObserver !== 'undefined') {
          resize = new ResizeObserver(paint);
          resize.observe(target);
        }
        setState('ready');
      })
      .catch(() => {
        if (active) setState('failed');
      });
    return () => {
      active = false;
      resize?.disconnect();
    };
  }, [scene]);

  return (
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
  );
}
