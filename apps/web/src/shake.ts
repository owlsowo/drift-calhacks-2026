// A deliberate alternation, rather than cursor travel or a single phone bump.
export class ShakeMeter {
  private direction = 0;
  private changedAt = 0;
  private startedAt = 0;
  private turns = 0;
  reset() {
    this.direction = 0;
    this.changedAt = 0;
    this.startedAt = 0;
    this.turns = 0;
  }
  hit(direction: number, time: number) {
    if (this.direction && (time - this.changedAt > 1000 || time - this.startedAt > 3000))
      this.reset();
    const sign = Math.sign(direction);
    if (!sign) return { progress: this.turns / 4, complete: false };
    if (!this.direction) {
      this.direction = sign;
      this.changedAt = time;
      this.startedAt = time;
    } else if (sign !== this.direction && time - this.changedAt >= 55) {
      this.direction = sign;
      this.changedAt = time;
      this.turns++;
    }
    return { progress: Math.min(1, this.turns / 4), complete: this.turns >= 4 };
  }
}

type Acceleration = { x: number | null; y: number | null; z: number | null } | null;

/** Lock one axis per gesture so unrelated bumps on different axes cannot add up. */
export class MotionShakeMeter {
  private meter = new ShakeMeter();
  private gravity: number[] | undefined;
  private axis: number | undefined;
  private lastImpulse = 0;

  reset() {
    this.meter.reset();
    this.gravity = undefined;
    this.axis = undefined;
    this.lastImpulse = 0;
  }

  sample(acceleration: Acceleration, includingGravity: Acceleration, time: number) {
    const read = (value: Acceleration) => [value?.x, value?.y, value?.z];
    let values = read(acceleration);
    if (!values.some((value) => typeof value === 'number' && Number.isFinite(value))) {
      const gravityValues = read(includingGravity);
      // Browsers can emit an all-null reading while permission/sensors start.
      // It is not a resting zero-gravity sample and must not prime the baseline.
      if (!gravityValues.some((value) => typeof value === 'number' && Number.isFinite(value)))
        return undefined;
      const raw = gravityValues.map((value) =>
        typeof value === 'number' && Number.isFinite(value) ? value : 0,
      );
      // Prime the filter from the resting phone, not an invented zero-gravity reading.
      if (!this.gravity) {
        this.gravity = raw;
        return { progress: 0, complete: false };
      }
      values = raw.map((value, index) => {
        this.gravity![index] = this.gravity![index] * 0.85 + value * 0.15;
        return value - this.gravity![index];
      });
    }
    const finite = values.map((value) =>
      typeof value === 'number' && Number.isFinite(value) ? value : 0,
    );
    if (this.axis !== undefined && time - this.lastImpulse > 1000) {
      this.axis = undefined;
      this.meter.reset();
    }
    const strongest = finite.reduce(
      (best, value, index) => (Math.abs(value) > Math.abs(finite[best]) ? index : best),
      0,
    );
    const axis = this.axis ?? strongest;
    if (Math.abs(finite[axis]) <= 8) return undefined;
    this.axis = axis;
    this.lastImpulse = time;
    return this.meter.hit(finite[axis], time);
  }
}
