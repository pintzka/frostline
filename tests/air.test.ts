import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, speedOf, stepSkier, type SkierState } from '../src/physics/skier';
import { heightAt, normalAt, PARK } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;

interface Flight {
  startZ: number; endZ: number; airtime: number; heightOverLip: number;
  /** Vinkelen mellom farten og bakken i det skiløperen lander (grader). Liten = myk landing. */
  landingAngle: number;
  /** Hvor mye av farten som er igjen etter landingen (0–1). */
  speedKept: number;
  /** Hvor hardt rampen presset skiløperen opp før hoppet, i g (1 = som å stå stille). */
  rampG: number;
}

/** Kjør rett ned hele bakken og logg hver gang skiløperen er i lufta. */
function rideAndLog(brakeBeforeZ?: number) {
  const s = createSkier();
  const flights: Flight[] = [];
  let cur: Flight | null = null;
  let lipY = 0;
  let rampG = 0;
  for (let i = 0; i < 60 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
    const brake = brakeBeforeZ !== undefined && s.z > brakeBeforeZ - 60 && s.z < brakeBeforeZ - 5 && speedOf(s) > 4 ? 1 : 0;
    const wasGrounded = s.grounded;
    const y0 = s.y, vx0 = s.vx, vy0 = s.vy, vz0 = s.vz, v0 = speedOf(s);
    stepSkier(s, { steer: 0, brake }, dt);
    if (wasGrounded && s.grounded) {
      // kraften fra bakken (per kg) langs bakkens normal, delt på g
      const [nx, ny, nz] = normalAt(s.x, s.z);
      const ax = (s.vx - vx0) / dt, ay = (s.vy - vy0) / dt + CONFIG.gravity, az = (s.vz - vz0) / dt;
      rampG = Math.max(rampG, (ax * nx + ay * ny + az * nz) / CONFIG.gravity);
    }
    if (wasGrounded && !s.grounded) {
      cur = { startZ: s.z, endZ: 0, airtime: 0, heightOverLip: 0, landingAngle: 0, speedKept: 1, rampG };
      lipY = y0;
    }
    if (cur && !s.grounded) {
      cur.airtime += dt;
      // høyde over kanten, målt langs bakkens helning (som i DESIGN.md)
      const slope = Math.tan((CONFIG.slopeDeg * Math.PI) / 180);
      const lineY = lipY - (s.z - cur.startZ) * slope;
      cur.heightOverLip = Math.max(cur.heightOverLip, s.y - lineY);
    }
    if (cur && s.grounded) {
      const [nx, ny, nz] = normalAt(s.x, s.z);
      const vn = -(vx0 * nx + vy0 * ny + vz0 * nz);
      cur.landingAngle = (Math.asin(Math.max(-1, Math.min(1, vn / v0))) * 180) / Math.PI;
      cur.speedKept = speedOf(s) / v0;
      cur.endZ = s.z;
      flights.push(cur);
      cur = null;
    }
    if (!wasGrounded || !s.grounded) rampG = 0;
    if (s.grounded && Math.min(...PARK.kickers.map((k) => Math.abs(s.z - k.z))) > 40) rampG = 0;
  }
  return { s, flights };
}

function flightFor(flights: Flight[], kickerZ: number) {
  return flights.find((f) => Math.abs(f.startZ - kickerZ) < 3);
}

describe('hopp og luft', () => {
  const { s, flights } = rideAndLog();
  const [small, medium, big] = PARK.kickers;

  it('letter bare fra hoppene, ikke fra småkuler i bakken', () => {
    expect(flights.length).toBe(PARK.kickers.length);
    for (const k of PARK.kickers) expect(flightFor(flights, k.z)).toBeDefined();
  });

  it('lite hopp: 1,0–1,3 s i lufta og 1–2 m over kanten', () => {
    const f = flightFor(flights, small.z)!;
    expect(f.airtime).toBeGreaterThanOrEqual(1.0);
    expect(f.airtime).toBeLessThanOrEqual(1.3);
    expect(f.heightOverLip).toBeGreaterThanOrEqual(1);
    expect(f.heightOverLip).toBeLessThanOrEqual(2);
  });

  it('medium hopp: 1,6–2,0 s i lufta og 3–4 m over kanten', () => {
    const f = flightFor(flights, medium.z)!;
    expect(f.airtime).toBeGreaterThanOrEqual(1.6);
    expect(f.airtime).toBeLessThanOrEqual(2.0);
    expect(f.heightOverLip).toBeGreaterThanOrEqual(3);
    expect(f.heightOverLip).toBeLessThanOrEqual(4);
  });

  // Høyden er lavere enn målet i DESIGN.md (5–7 m): du kommer inn i ca. 100 km/t, og da gir en
  // myk rampe (maks 2,1 g) ca. 3 m. Se DESIGN.md.
  it('stort hopp: 2,3–2,9 s i lufta og minst 2,5 m over kanten', () => {
    const f = flightFor(flights, big.z)!;
    expect(f.airtime).toBeGreaterThanOrEqual(2.3);
    expect(f.airtime).toBeLessThanOrEqual(2.9);
    expect(f.heightOverLip).toBeGreaterThanOrEqual(2.5);
    expect(f.heightOverLip).toBeLessThanOrEqual(7);
  });

  it('rampene dytter mykt (maks 2,1 g), ikke et brått spark', () => {
    for (const f of flights) expect(f.rampG).toBeLessThanOrEqual(2.1);
  });

  it('landingene er myke: under 12° mot bakken, og nesten all fart beholdes', () => {
    for (const f of flights) {
      expect(f.landingAngle).toBeLessThan(12);
      expect(f.speedKept).toBeGreaterThan(0.97);
    }
  });

  it('lander på bakken og kjører videre', () => {
    expect(s.grounded).toBe(true);
    expect(Math.abs(s.y - heightAt(s.x, s.z))).toBeLessThan(1e-6);
    expect(speedOf(s)).toBeGreaterThan(15);
  });

  it('kommer seg trygt over hoppet i lav fart også', () => {
    const slow = rideAndLog(small.z).s;
    for (const v of [slow.x, slow.y, slow.z, slow.vx, slow.vy, slow.vz]) expect(Number.isFinite(v)).toBe(true);
    expect(slow.z).toBeGreaterThan(small.z + 20);
  });

  it('er deterministisk', () => {
    const a = rideAndLog().flights, b = rideAndLog().flights;
    expect(a).toEqual(b);
  });

  it('svinger ikke i lufta (spinn kommer senere)', () => {
    const t: SkierState = { ...createSkier(), y: heightAt(0, 5) + 5, vz: 20, grounded: false };
    const h0 = t.heading;
    for (let i = 0; i < 0.3 * CONFIG.physicsHz; i++) stepSkier(t, { steer: 1, brake: 0 }, dt);
    expect(t.heading).toBe(h0);
  });
});
