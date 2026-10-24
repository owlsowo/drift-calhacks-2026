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
