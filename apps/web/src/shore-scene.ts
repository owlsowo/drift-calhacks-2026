// Bottle mesh/throw adaptation from EG_xry's 2026-10-25 prototype.
// The camera is fixed. Choices are a pickup ritual, not an inventory of five writers.
import {
  AMBIENT_BOTTLE_COUNT,
  MAX_BOTTLES,
  RELEASED_BOTTLE_INDEX,
} from './ocean-engine/scene-limits.js';
export type SceneBottle = {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  opacity: number;
  floatBlend: number;
  splashAge: number;
};
const TAN = Math.tan((29 * Math.PI) / 180);
const PITCH = -Math.atan(0.2 * TAN);
const PLACES = [
  [0.2, 0.57],
  [0.51, 0.62],
  [0.8, 0.56],
  [0.29, 0.76],
  [0.72, 0.76],
];
export class ShoreScene {
  readonly camera = Object.freeze({ x: 0, y: 4, z: 0, pitch: PITCH });
  readonly bottles: SceneBottle[] = Array.from({ length: MAX_BOTTLES }, (_, id) => ({
    id,
    x: 0,
    y: 0.025,
    z: -15,
    yaw: -0.7 + id * 0.8,
    pitch: 0.08,
    roll: 1.22,
    opacity: 0,
    floatBlend: 1,
    splashAge: -1,
  }));
  renderer: 'loading' | 'webgpu' | 'fallback' = 'loading';
  paused = false;
  reducedMotion = false;
  time = 0;
  private listeners = new Set<() => void>();
  private frame = 0;
  private running = false;
  private last = 0;
  private throwAge = -1;
  private seed: { x: number; z: number }[] = [];
  private width = 1440;
  private height = 1000;
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  notify() {
    for (const fn of this.listeners) fn();
  }
  setRenderer(value: typeof this.renderer) {
    this.renderer = value;
    this.notify();
  }
  layout(width: number, height: number) {
    if (!(width > 0 && height > 0)) return;
    this.width = width;
    this.height = height;
    const cp = Math.cos(PITCH),
      sp = Math.sin(PITCH),
      dy = 0.025 - this.camera.y;
    this.seed = PLACES.map(([x, y]) => {
      const v = (0.5 - y) * 2 * TAN;
      const z = (dy * (cp - v * sp)) / (-v * cp - sp);
      const depth = dy * sp - z * cp;
      return { x: (x - 0.5) * 2 * TAN * (width / height) * depth, z };
    });
    this.seed.forEach((p, i) => Object.assign(this.bottles[i], p));
    this.notify();
  }
  showChoices(show: boolean, count = AMBIENT_BOTTLE_COUNT) {
    this.layout(this.width, this.height);
    if (show) {
      this.throwAge = -1;
      this.bottles[RELEASED_BOTTLE_INDEX].opacity = 0;
    }
    for (let i = 0; i < AMBIENT_BOTTLE_COUNT; i++)
      this.bottles[i].opacity = show && i < count ? 1 : 0;
    this.notify();
    this.wake();
  }
  throwBottle() {
    this.throwAge = 0;
    const b = this.bottles[RELEASED_BOTTLE_INDEX];
    Object.assign(b, {
      x: 0.35,
      y: 3.75,
      z: -1.2,
      yaw: -0.4,
      pitch: 0.18,
      roll: -0.45,
      opacity: 1,
      floatBlend: 0,
      splashAge: -1,
    });
    if (this.paused || this.reducedMotion) {
      this.throwAge = 2;
      this.advanceThrow();
    }
    this.notify();
    this.wake();
  }
  setPaused(value: boolean) {
    this.paused = value;
    this.notify();
    this.wake();
  }
  step(dt: number) {
    if (!Number.isFinite(dt) || this.paused || this.reducedMotion) return;
    dt = Math.max(0, Math.min(0.08, dt));
    this.time += dt;
    for (let i = 0; i < AMBIENT_BOTTLE_COUNT; i++) {
      const b = this.bottles[i],
        p = this.seed[i];
      if (!p || !b.opacity) continue;
      b.x = p.x + Math.sin(this.time * 0.16 + i) * 0.09;
      b.z = p.z + Math.sin(this.time * 0.11 + i) * 0.08;
      b.yaw = -0.7 + i * 0.8 + Math.sin(this.time * 0.12 + i) * 0.12;
      b.roll = 1.22 + Math.sin(this.time * 0.6 + i) * 0.06;
    }
    if (this.throwAge >= 0) {
      this.throwAge += dt;
      this.advanceThrow();
    }
    this.notify();
  }
  private advanceThrow() {
    const b = this.bottles[RELEASED_BOTTLE_INDEX],
      age = this.throwAge;
    const impact = (3.8 + Math.sqrt(3.8 * 3.8 + 2 * 9.81 * 3.75)) / 9.81;
    if (age < impact) {
      b.x = 0.35 - 0.42 * age;
      b.z = -1.2 - 6.4 * age;
      b.y = 3.75 + 3.8 * age - 4.905 * age * age;
      b.pitch = 0.18 + age * 3.1;
      b.roll = -0.45 + age * 1.8;
      return;
    }
    const wet = age - impact,
      settle = (1 + wet * 4) * Math.exp(-wet * 4);
    b.x = 0.35 - 0.42 * impact;
    b.z = -1.2 - 6.4 * impact - (1 - Math.exp(-wet * 4)) * 1.6;
    b.y = -0.055 - Math.sin(Math.min(Math.PI, wet * 8)) * 0.14 * Math.exp(-wet * 2.5);
    b.floatBlend = Math.min(1, wet / 0.11);
    b.pitch = 0.08 + (0.18 + impact * 3.1 - 0.08) * settle;
    b.roll = 1.22 + (-0.45 + impact * 1.8 - 1.22) * settle;
    b.yaw = 0.15;
    b.splashAge = wet < 3 ? wet : -1;
    b.opacity = Math.max(0, Math.min(1, (8 - age) / 2));
    if (!b.opacity) this.throwAge = -1;
  }
  project(b: SceneBottle, width = this.width, height = this.height) {
    const cp = Math.cos(PITCH),
      sp = Math.sin(PITCH),
      dy = b.y - this.camera.y,
      dz = b.z - this.camera.z;
    const depth = dy * sp - dz * cp,
      up = dy * cp + dz * sp;
    return {
      x: width / 2 + (b.x * height) / (2 * TAN * Math.max(0.05, depth)),
      y: height / 2 - (up * height) / (2 * TAN * Math.max(0.05, depth)),
      size: (1.064 * height) / (2 * TAN * Math.max(0.05, depth)),
      visible: depth > 0.3 && b.opacity > 0,
    };
  }
  choiceTarget(index: number) {
    // Keep the generous tap target still while its glass bottle drifts within it.
    // This also avoids chasing moving focus outlines with a keyboard or pointer.
    return this.project({ ...this.bottles[index], ...this.seed[index] });
  }
  private wake() {
    if (
      this.running &&
      !document.hidden &&
      !this.frame &&
      this.bottles.some((b) => b.opacity > 0) &&
      !this.paused &&
      !this.reducedMotion
    ) {
      this.last = 0;
      this.frame = requestAnimationFrame(this.animate);
    }
  }
  private animate = (now: number) => {
    this.frame = 0;
    if (!this.running || document.hidden) return;
    const dt = this.last ? Math.min(0.08, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.step(dt);
    if (!this.paused && !this.reducedMotion && this.bottles.some((b) => b.opacity > 0))
      this.frame = requestAnimationFrame(this.animate);
  };
  start() {
    this.running = true;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => {
      this.reducedMotion = media.matches;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.notify();
      this.wake();
    };
    const visibility = () => {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.last = 0;
      this.wake();
    };
    preference();
    media.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      media.removeEventListener('change', preference);
      document.removeEventListener('visibilitychange', visibility);
    };
  }
}
