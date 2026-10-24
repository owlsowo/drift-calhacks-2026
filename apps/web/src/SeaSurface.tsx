import { useEffect, useRef, useState } from 'react';
import { createSurface, flatVertex } from './surface';

const fragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTexture;
uniform vec2 uCrop;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 uv=vUv;
  float depth=clamp((0.68-uv.y)/0.68,0.0,1.0);
  float water=smoothstep(0.0,0.12,depth);
  float swell=sin(uv.y*31.0-uTime*0.72+sin(uv.x*9.0)*0.7);
  float ripple=sin(uv.y*105.0-uTime*1.35+sin(uv.x*23.0+uTime*0.18));
  uv.y+=(swell*0.0035+ripple*0.0015)*water*depth;
  uv.x+=(sin(uv.y*43.0+uTime*0.42)*0.002+sin(uv.x*13.0-uTime*0.21)*0.001)*water*depth;
  vec3 photo=texture2D(uTexture,(uv-0.5)*uCrop+0.5).rgb;
  float reflection=exp(-pow((uv.x-0.54)*3.2,2.0));
  photo*=1.0+(ripple*0.025+swell*0.014)*reflection*water;
  vec3 wash=mix(vec3(0.09,0.27,0.38),vec3(0.06,0.21,0.33),vUv.y);
  gl_FragColor=vec4(mix(photo,wash,mix(0.20,0.267,vUv.y)),1.0);
}`;

export function SeaSurface({ paused }: { paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const control = useRef<((moving: boolean) => void) | undefined>(undefined);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const moving = useRef(!paused && !reduced);
  moving.current = !paused && !reduced;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const target = canvas.current!;
    const surface = createSurface(target, flatVertex, fragment);
    if (!surface) {
      target.dataset.motion = 'fallback';
      return;
    }
    let frame = 0,
      disposed = false,
      loaded = false,
      last = 0,
      time = 0;
    const image = new Image();
    const draw = (now: number) => {
      if (disposed || !loaded) return;
      if (last) time += Math.min(now - last, 80) / 1000;
      last = now;
      surface.float('uTime', time);
      surface.draw();
      if (moving.current && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (!disposed && loaded) {
        target.dataset.motion = moving.current && !document.hidden ? 'running' : 'paused';
        if (moving.current && !document.hidden) frame = requestAnimationFrame(draw);
      }
    };
    control.current = resume;
    const resize = () => {
      const { width, height } = target.getBoundingClientRect();
      surface.resize(width, height, Math.min(devicePixelRatio, 1.25));
      const aspect = width / height,
        photoAspect = image.width / image.height;
      surface.pair('uCrop', Math.min(1, aspect / photoAspect), Math.min(1, photoAspect / aspect));
      if (loaded) {
        surface.float('uTime', time);
        surface.draw();
      }
    };
    const lost = (event: Event) => {
      event.preventDefault();
      loaded = false;
      cancelAnimationFrame(frame);
      target.style.opacity = '0';
      target.dataset.motion = 'fallback';
    };
    image.onload = () => {
      if (disposed) return;
      surface.image(image);
      loaded = true;
      resize();
      target.style.opacity = '1';
      resume();
    };
    image.src = '/assets/sea-shore.jpg';
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    document.addEventListener('visibilitychange', resume);
    target.addEventListener('webglcontextlost', lost);
    return () => {
      disposed = true;
      control.current = undefined;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      target.removeEventListener('webglcontextlost', lost);
      image.onload = null;
      surface.dispose();
    };
  }, []);
  useEffect(() => {
    control.current?.(!paused && !reduced);
  }, [paused, reduced]);
  return <canvas ref={canvas} className="sea-surface" aria-hidden="true" />;
}
