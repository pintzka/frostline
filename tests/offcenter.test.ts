import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, placeSkier, speedOf, stepSkier } from '../src/physics/skier';
import { heightAt, normalAt, PARK, rampLength } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;

/**
 * Kjør rett ned (uten styring) fra x0, gjennom alle hoppene, og finn det hardeste kraftsparket
 * fra bakken (i g) og den bratteste landingen (grader mellom farten og bakken).
 * Utenfor midten kjører du på sidene av hoppene, og der skal det også være mykt.
 */
function rideAt(x0: number) {
  const s = createSkier();
  s.x = x0;
  s.y = heightAt(s.x, s.z);
  let maxG = 0, maxLanding = 0;
  for (let i = 0; i < 60 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
    const was = s.grounded, vx0 = s.vx, vy0 = s.vy, vz0 = s.vz, v0 = speedOf(s);
    stepSkier(s, { steer: 0, brake: 0 }, dt);
    const [nx, ny, nz] = normalAt(s.x, s.z);
    if (was && s.grounded) {
      const ax = (s.vx - vx0) / dt, ay = (s.vy - vy0) / dt + CONFIG.gravity, az = (s.vz - vz0) / dt;
      maxG = Math.max(maxG, (ax * nx + ay * ny + az * nz) / CONFIG.gravity);
    }
    if (!was && s.grounded) {
      const ang = (Math.asin(Math.min(1, -(vx0 * nx + vy0 * ny + vz0 * nz) / v0)) * 180) / Math.PI;
      maxLanding = Math.max(maxLanding, ang);
    }
  }
  return { maxG, maxLanding };
}

describe('sidene på hoppene', () => {
  // før: 3 m brede sider (70–76° bratte) ga kraftspark på 5 g ved x = 5
  for (const x of [5, -5, 8, -8, 12, -12]) {
    it(`kjøring rett ned ved x = ${x} gir ingen kraftspark over 2,5 g og ingen landing brattere enn 15°`, () => {
      const r = rideAt(x);
      expect(r.maxG).toBeLessThan(2.5);
      expect(r.maxLanding).toBeLessThan(15);
    });
  }
  it('er myke over hele bredden, ikke bare der vi tilfeldigvis måler', () => {
    for (let x = 1; x <= 26; x += 1.5) {
      const r = rideAt(x);
      expect(r.maxG, `x = ${x}`).toBeLessThan(2.5);
      expect(r.maxLanding, `x = ${x}`).toBeLessThan(15);
    }
  });
});

describe('kanten ute på sidene av hoppene', () => {
  /**
   * Kjør rett over ett hopp fra rett før rampen, ved x og med gitt fart. Gir det største kraftsparket
   * (all kraft fra bakken, i g) og den største fartsendringen (m/s) på ett steg mens du står på snøen.
   * Før: ute på sidene er kanten lav, og skiløperen ble limt til bakken over knekken (40–80 g på ett steg).
   */
  function overKicker(k: (typeof PARK.kickers)[number], x: number, speed: number) {
    const s = createSkier();
    placeSkier(s, x, k.z - rampLength(k) - 3, speed);
    let maxG = 0, maxDv = 0;
    for (let i = 0; i < 6 * CONFIG.physicsHz && s.z < k.z + 60; i++) {
      const was = s.grounded, vx0 = s.vx, vy0 = s.vy, vz0 = s.vz, v0 = speedOf(s);
      stepSkier(s, { steer: 0, brake: 0 }, dt);
      if (was && s.grounded) {
        const ax = (s.vx - vx0) / dt, ay = (s.vy - vy0) / dt + CONFIG.gravity, az = (s.vz - vz0) / dt;
        maxG = Math.max(maxG, Math.hypot(ax, ay, az) / CONFIG.gravity);
        maxDv = Math.max(maxDv, Math.abs(speedOf(s) - v0));
      }
    }
    return { maxG, maxDv };
  }

  for (const k of PARK.kickers) {
    it(`«${k.name}»: under 3 g og under 0,3 m/s fartsendring per steg over hele bredden, i alle farter`, () => {
      for (const speed of [4, 7, 10, 14, 18]) {
        for (let x = 0; x <= k.width / 2 + k.sideWidth + 2; x += 0.5) {
          const r = overKicker(k, x, speed);
          expect(r.maxG, `x = ${x}, ${speed} m/s`).toBeLessThan(3);
          expect(r.maxDv, `x = ${x}, ${speed} m/s`).toBeLessThan(0.3);
        }
      }
    });
  }
});
