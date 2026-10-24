import { useEffect, useRef } from 'react';
import { createSurface } from './surface';

export const NOTE_OPEN_MS = 1900;

const vertex = `
attribute vec2 aUv;
uniform float uProgress;
varying vec2 vUv;
varying float vLight;
void main() {
  vUv=aUv;
  vec2 p=aUv-0.5;
  float spread=smoothstep(0.03,0.76,uProgress);
  float lengthen=smoothstep(0.16,0.96,uProgress);
  float creases=pow(1.0-smoothstep(0.06,1.0,uProgress),1.7);
  float fold=sin(p.x*25.0+p.y*14.0)*sin(p.y*29.0-p.x*8.0);
  float fine=sin(p.x*57.0-p.y*39.0);
  float z=(fold*0.085+fine*0.018)*creases;
  vec2 sheet=p*vec2(mix(0.24,1.0,spread),mix(0.18,1.0,lengthen));
  sheet.x+=sin(p.y*19.0+p.x*4.0)*0.025*creases;
  sheet.y+=sin(p.x*23.0-p.y*9.0)*0.020*creases;
  float angle=-0.13*(1.0-spread)+0.025*sin(uProgress*3.14159);
  sheet=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*sheet;
  sheet/=1.0-z*1.5;
  sheet.y+=0.09*(1.0-lengthen);
  vLight=1.0+(cos(p.x*25.0+p.y*14.0)*sin(p.y*29.0-p.x*8.0)*0.28-fine*0.08-0.06)*creases;
  gl_Position=vec4(sheet*2.0,-z,1.0);
}`;
const fragment = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec2 uCrop;
varying vec2 vUv;
varying float vLight;
void main() {
  vec3 photo=texture2D(uTexture,(vUv-0.5)*uCrop+0.5).rgb;
  vec3 paper=mix(photo,vec3(0.961,0.933,0.859),0.86);
  gl_FragColor=vec4(paper*vLight,1.0);
}`;

// One connected mesh: creases relax as the edges spread; no separate flying tiles.
export function PaperSurface({ onReady }: { onReady: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const target = canvas.current!;
    const start = performance.now();
    const surface = createSurface(target, vertex, fragment, 36);
    if (!surface) return;
    let frame = 0,
      disposed = false;
    const image = new Image();
    const draw = (time: number) => {
      if (disposed) return;
      const p = Math.min(1, (time - start) / NOTE_OPEN_MS);
      surface.float('uProgress', p);
      surface.draw();
      if (p < 1) frame = requestAnimationFrame(draw);
    };
    image.onload = () => {
      if (disposed) return;
      const { width, height } = target.getBoundingClientRect();
      surface.resize(width, height, Math.min(devicePixelRatio, 1.5));
      const aspect = width / height,
        photoAspect = image.width / image.height;
      surface.pair('uCrop', Math.min(1, aspect / photoAspect), Math.min(1, photoAspect / aspect));
      surface.image(image);
      draw(performance.now());
      ready.current();
    };
    image.src = '/assets/paper-texture.jpg';
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      image.onload = null;
      surface.dispose();
    };
  }, []);
  return <canvas ref={canvas} className="paper-surface" aria-hidden="true" />;
}
