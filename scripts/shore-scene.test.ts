import test from 'node:test';
import assert from 'node:assert/strict';
import { ShoreScene } from '../apps/web/src/shore-scene';

test('Three to five choices remain inside each viewport and hide unused bottle slots', () => {
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
    [320, 568],
    [740, 360],
  ]) {
    for (const count of [3, 4, 5]) {
      const scene = new ShoreScene();
      assert.equal(scene.bottles.filter((b) => b.opacity).length, 0);
      assert.ok(Object.isFrozen(scene.camera));
      scene.layout(width, height);
      scene.showChoices(true);
      scene.showChoices(true, count);
      for (let frame = 0; frame < 3600; frame++) {
        scene.step(1 / 30);
        for (const bottle of scene.bottles.filter((b) => b.opacity)) {
          const p = scene.project(bottle);
          assert.ok(p.visible && p.x > 24 && p.x < width - 24 && p.y > 24 && p.y < height - 24);
        }
      }
      assert.equal(scene.bottles.filter((b) => b.opacity).length, count);
      scene.showChoices(false);
      assert.equal(scene.bottles.filter((b) => b.opacity).length, 0);
    }
  }
});

test('Release arc settles and expires; pickup clears the prior thrown bottle', () => {
  const scene = new ShoreScene();
  scene.layout(390, 844);
  scene.throwBottle();
  assert.equal(scene.bottles.filter((b) => b.opacity).length, 1);
  for (let i = 0; i < 260; i++) scene.step(1 / 30);
  assert.equal(scene.bottles.filter((b) => b.opacity).length, 0);
  scene.throwBottle();
  scene.showChoices(true, 3);
  assert.equal(scene.bottles.filter((b) => b.opacity).length, 3);
});

test('Pause and reduced motion freeze bottle poses without stopping selection', () => {
  const scene = new ShoreScene();
  scene.layout(320, 568);
  scene.showChoices(true);
  scene.setPaused(true);
  const paused = JSON.stringify(scene.bottles);
  scene.step(2);
  assert.equal(JSON.stringify(scene.bottles), paused);
  scene.setPaused(false);
  scene.reducedMotion = true;
  scene.step(1);
  assert.equal(JSON.stringify(scene.bottles), paused);
  scene.showChoices(false);
  assert.equal(scene.bottles.filter((b) => b.opacity).length, 0);
});
