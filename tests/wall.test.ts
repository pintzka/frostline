import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, speedOf, stepSkier } from '../src/physics/skier';
import { heightAt, normalAt, PARK } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;

/**
 * Kjør på skrå mot kanten av bakken (før første hopp) og mål det største hoppet i fart per steg.
 * steer = 0 holder skiene i samme retning; steer mot kanten svinger enda mer inn mot den.
 */
function rideToWall(heading: number, speed: number, steer: number) {
  const s = createSkier();
  s.z = 20;
  s.y = heightAt(0, s.z);
  s.heading = heading;
  const a = (CONFIG.slopeDeg * Math.PI) / 180;
  s.vx = speed * Math.sin(heading);
  s.vz = speed * Math.cos(heading) * Math.cos(a);
  s.vy = -speed * Math.cos(heading) * Math.sin(a);
  let maxDv = 0, maxDvx = 0, maxTurn = 0, maxX = 0, maxG = 0;
  for (let i = 0; i < 6 * CONFIG.physicsHz && s.z < 140; i++) {
    const v0 = speedOf(s), vx0 = s.vx, vy0 = s.vy, vz0 = s.vz, dir0 = Math.atan2(s.vx, s.vz), was = s.grounded;
    stepSkier(s, { steer, brake: 0 }, dt);
    // de første stegene justerer farten seg til bakken; ikke tell dem
    if (i < 5) continue;
    maxDv = Math.max(maxDv, Math.abs(speedOf(s) - v0));
    maxDvx = Math.max(maxDvx, Math.abs(s.vx - vx0));
    let d = Math.atan2(s.vx, s.vz) - dir0;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (speedOf(s) > 3) maxTurn = Math.max(maxTurn, Math.abs(d) * 180 / Math.PI);
    maxX = Math.max(maxX, Math.abs(s.x));
    if (was && s.grounded) {
      // hvor hardt bollen presser skiløperen (i g)
      const [nx, ny, nz] = normalAt(s.x, s.z);
      const ax = (s.vx - vx0) / dt, ay = (s.vy - vy0) / dt + CONFIG.gravity, az = (s.vz - vz0) / dt;
      maxG = Math.max(maxG, (ax * nx + ay * ny + az * nz) / CONFIG.gravity);
    }
  }
  return { maxDv, maxDvx, maxTurn, maxX, maxG };
}

describe('kanten av bakken', () => {
  const cases: [number, number, number][] = [];
  for (const side of [1, -1]) {
    for (const heading of [0.4, 0.7, 1.0, 1.3]) {
      for (const speed of [12, 20, 25]) {
        cases.push([side * heading, speed, 0]);
        cases.push([side * heading, speed, -side]); // styrer enda mer inn mot kanten
      }
    }
  }
  it('snur deg mykt: under 0,3 m/s fartsendring per steg, ingen brå sving, ingen kraftspark, treffer aldri veggen', () => {
    const results = cases.map(([heading, speed, steer]) => ({ heading, speed, steer, r: rideToWall(heading, speed, steer) }));
    for (const { heading, speed, steer, r } of results) {
      const what = `retning ${heading}, fart ${speed}, styring ${steer}: ${JSON.stringify(r)}`;
      expect(r.maxDv, what).toBeLessThan(0.3);
      expect(r.maxDvx, what).toBeLessThan(0.3);
      // kameraet følger fartsretningen: under 2° per steg (før: 26–108°)
      expect(r.maxTurn, what).toBeLessThan(2);
      // inkludert trykket fra en full carvesving i 90 km/t (ca. 2,8 g)
      expect(r.maxG, what).toBeLessThan(3);
      // bollen og den myke bremsen skal snu deg før nødstoppen helt ytterst
      expect(r.maxX, what).toBeLessThan(PARK.width / 2);
    }
  });
});
