import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, speedOf, stepSkier } from '../src/physics/skier';
import { PARK } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;

function moving(speed: number) {
  const s = createSkier();
  const a = (CONFIG.slopeDeg * Math.PI) / 180;
  s.vz = speed * Math.cos(a);
  s.vy = -speed * Math.sin(a);
  return s;
}

describe('fart over toppfarten (f.eks. etter et hopp)', () => {
  it('kuttes ikke brått ned til toppfarten', () => {
    const s = moving(CONFIG.maxSpeed + 5);
    stepSkier(s, { steer: 0, brake: 0 }, dt);
    expect(speedOf(s)).toBeGreaterThan(CONFIG.maxSpeed + 4.9);
  });

  it('tas mykt ned mot toppfarten på noen sekunder', () => {
    const s = moving(CONFIG.maxSpeed + 5);
    let biggestStep = 0;
    for (let i = 0; i < 6 * CONFIG.physicsHz; i++) {
      const v0 = speedOf(s);
      stepSkier(s, { steer: 0, brake: 0 }, dt);
      biggestStep = Math.max(biggestStep, Math.abs(speedOf(s) - v0));
    }
    expect(speedOf(s)).toBeLessThan(CONFIG.maxSpeed + 0.5);
    // aldri mer enn 0,05 m/s (0,2 km/t) på ett steg
    expect(biggestStep).toBeLessThan(0.05);
  });
});

describe('fartsmåleren', () => {
  it('hopper aldri brått, heller ikke ved letting og landing på hoppene', () => {
    const s = createSkier();
    let biggestStep = 0, where = 0, flights = 0;
    for (let i = 0; i < 60 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
      const v0 = speedOf(s), was = s.grounded;
      stepSkier(s, { steer: 0, brake: 0 }, dt);
      if (was && !s.grounded) flights++;
      const d = Math.abs(speedOf(s) - v0);
      if (d > biggestStep) { biggestStep = d; where = s.z; }
    }
    expect(flights).toBe(PARK.kickers.length);
    // 0,1 m/s på ett steg er 0,36 km/t: syns ikke på måleren
    expect(biggestStep, `størst hopp ved z=${where.toFixed(0)}`).toBeLessThan(0.1);
  });
});
