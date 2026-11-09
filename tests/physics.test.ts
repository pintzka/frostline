import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, speedOf, stepSkier } from '../src/physics/skier';
import { heightAt } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;
function run(seconds: number, steer = 0, brake = 0) {
  const s = createSkier();
  for (let i = 0; i < seconds * CONFIG.physicsHz; i++) stepSkier(s, { steer, brake }, dt);
  return s;
}

describe('skiløper-fysikk', () => {
  it('akselererer nedover bakken', () => {
    const s = run(3);
    expect(speedOf(s)).toBeGreaterThan(8);
    expect(s.z).toBeGreaterThan(10);
  });

  it('overstiger aldri toppfarten', () => {
    const s = run(30);
    expect(speedOf(s)).toBeLessThanOrEqual(CONFIG.maxSpeed + 1e-6);
  });

  it('gir aldri NaN, heller ikke med full styring', () => {
    for (const steer of [-1, 0.5, 1]) {
      const s = run(20, steer);
      for (const v of [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.heading]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('holder seg på bakken (fase 0, ingen hopp)', () => {
    const s = run(10, 0.3);
    expect(Math.abs(s.y - heightAt(s.x, s.z))).toBeLessThan(1e-6);
  });

  it('bremsing gir lavere fart', () => {
    expect(speedOf(run(5, 0, 1))).toBeLessThan(speedOf(run(5)));
  });

  it('er deterministisk', () => {
    const a = run(8, 0.4), b = run(8, 0.4);
    expect(a).toEqual(b);
  });
});
