import { useEffect, useRef } from 'react';
import { GlassBottle } from './Shore';
import type { ShoreScene } from './shore-scene';
import './world-bottles.css';

/** Only the glass fallback uses DOM; the full-quality ocean draws the GPU mesh. */
export function WorldBottles({ scene }: { scene: ShoreScene }) {
  const nodes = useRef(new Map<number, HTMLDivElement>());
  useEffect(() => {
    const paint = () => {
      for (const bottle of scene.bottles) {
        const node = nodes.current.get(bottle.id);
        if (!node) continue;
        const point = scene.project(bottle);
        node.hidden = scene.renderer === 'webgpu' || !point.visible;
        if (node.hidden) continue;
        node.style.width = `${point.size}px`;
        node.style.height = `${point.size}px`;
        node.style.opacity = String(bottle.opacity);
        node.style.transform = `translate3d(${point.x}px,${point.y}px,0) translate(-50%,-50%) rotate(${-65 + bottle.yaw * 12}deg)`;
      }
    };
    const resize = () => scene.layout(innerWidth, innerHeight);
    const unsubscribe = scene.subscribe(paint);
    resize();
    window.addEventListener('resize', resize);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', resize);
    };
  }, [scene]);
  return (
    <div className="world-bottle-sprites" aria-hidden="true">
      {scene.bottles.map((bottle) => (
        <div
          key={bottle.id}
          className="world-bottle-sprite"
          hidden
          ref={(node) => {
            if (node) nodes.current.set(bottle.id, node);
            else nodes.current.delete(bottle.id);
          }}
        >
          <GlassBottle />
        </div>
      ))}
    </div>
  );
}
