import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, speedOf, stepSkier, type SkierState } from '../src/physics/skier';
import { heightAt, PARK } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;

interface Flight { startZ: number; endZ: number; airtime: number; heightOverLip: number }

/** Kjør rett ned hele bakken og logg hver gang skiløperen er i lufta. */
function rideAndLog(brakeBeforeZ?: number) {
  const s = createSkier();
  const flights: Flight[] = [];
  let cur: Flight | null = null;
  let lipY = 0;
  for (let i = 0; i < 60 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
    const brake = brakeBeforeZ !== undefined && s.z > brakeBeforeZ - 60 && s.z < brakeBeforeZ - 5 && speedOf(s) > 4 ? 1 : 0;
    const wasGrounded = s.grounded;
    const y0 = s.y;
    stepSkier(s, { steer: 0, brake }, dt);
    if (wasGrounded && !s.grounded) { cur = { startZ: s.z, endZ: 0, airtime: 0, heightOverLip: 0 }; lipY = y0; }
    if (cur && !s.grounded) {
      cur.airtime += dt;
      // høyde over kanten, målt langs bakkens helning (som i DESIGN.md)
      const slope = Math.tan((CONFIG.slopeDeg * Math.PI) / 180);
      const lineY = lipY - (s.z - cur.startZ) * slope;
      cur.heightOverLip = Math.max(cur.heightOverLip, s.y - lineY);
    }
    if (cur && s.grounded) { cur.endZ = s.z; flights.push(cur); cur = null; }
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

  it('stort hopp: 2,3–2,8 s i lufta og 5–7 m over kanten', () => {
    const f = flightFor(flights, big.z)!;
    expect(f.airtime).toBeGreaterThanOrEqual(2.3);
    expect(f.airtime).toBeLessThanOrEqual(2.8);
    expect(f.heightOverLip).toBeGreaterThanOrEqual(5);
    expect(f.heightOverLip).toBeLessThanOrEqual(7);
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
