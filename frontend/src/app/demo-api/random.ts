/** Mulberry32 — the same generator as the C# API, so fixtures match across both. */
export class DeterministicRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(minInclusive: number, maxExclusive: number): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ ((t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0)) >>> 0)) >>> 0;
    const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return minInclusive + Math.floor(value * (maxExclusive - minInclusive));
  }
}
