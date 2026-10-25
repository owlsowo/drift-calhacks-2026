import test from 'node:test';
import assert from 'node:assert/strict';
import { ShoreScene } from '../apps/web/src/shore-scene';

test('Five choices remain inside every supported fixed-camera viewport through bounded drift', () => {
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
    [320, 568],
    [740, 360],
  ]) {
    const scene = new ShoreScene();
    assert.equal(scene.bottles.filter((b) => b.opacity).length, 0);
    assert.ok(Object.isFrozen(scene.camera));
    scene.layout(width, height);
    scene.showChoices(true);
    for (let frame = 0; frame < 3600; frame++) {
      scene.step(1 / 30);
      for (const bottle of scene.bottles.filter((b) => b.opacity)) {
        const p = scene.project(bottle);
        assert.ok(p.visible && p.x > 24 && p.x < width - 24 && p.y > 24 && p.y < height - 24);
      }
    }
    assert.equal(scene.bottles.filter((b) => b.opacity).length, 5);
    scene.showChoices(false);
    assert.equal(scene.bottles.filter((b) => b.opacity).length, 0);
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
  scene.showChoices(true);
  assert.equal(scene.bottles.filter((b) => b.opacity).length, 5);
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
