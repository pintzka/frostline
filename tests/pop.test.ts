import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, speedOf, stepSkier, type SkierState } from '../src/physics/skier';
import { heightAt, normalAt, PARK, type Kicker } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;
const slope = Math.tan((CONFIG.slopeDeg * Math.PI) / 180);

/** Skiløper som allerede kjører rett ned, med farten langs bakken. */
function moving(speed: number) {
  const s = createSkier();
  const a = (CONFIG.slopeDeg * Math.PI) / 180;
  s.vz = speed * Math.cos(a);
  s.vy = -speed * Math.sin(a);
  return s;
}

interface PopFlight { heightOverLip: number; landingAngle: number; pop: string }

/**
 * Kjør hele bakken. Før hvert hopp holdes pop inne, og slippes når kanten er
 * `lead` sekunder unna (null = ingen pop).
 */
function ride(lead: number | null) {
  const s = createSkier();
  const flights = new Map<string, PopFlight>();
  let cur: { k: Kicker; lipY: number; lipZ: number; h: number } | null = null;
  for (let i = 0; i < 60 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
    const next = PARK.kickers.find((k) => k.z - s.z > -1 && k.z - s.z < 60);
    const timeToLip = next ? (next.z - s.z) / Math.max(1, s.vz) : Infinity;
    const pop = lead !== null && next !== undefined && s.grounded && timeToLip > lead;
    const was = s.grounded, y0 = s.y, v0 = speedOf(s), vx0 = s.vx, vy0 = s.vy, vz0 = s.vz;
    stepSkier(s, { steer: 0, brake: 0, pop }, dt);
    if (was && !s.grounded && next && !cur) cur = { k: next, lipY: y0, lipZ: s.z, h: 0 };
    if (cur && !s.grounded) cur.h = Math.max(cur.h, s.y - (cur.lipY - (s.z - cur.lipZ) * slope));
    if (cur && s.grounded) {
      const [nx, ny, nz] = normalAt(s.x, s.z);
      const ang = (Math.asin(-(vx0 * nx + vy0 * ny + vz0 * nz) / v0) * 180) / Math.PI;
      if (!flights.has(cur.k.name)) flights.set(cur.k.name, { heightOverLip: cur.h, landingAngle: ang, pop: s.lastPop });
      cur = null;
    }
  }
  return flights;
}

describe('pop', () => {
  it('lader opp mens du holder, til maks 1', () => {
    const s = moving(10);
    for (let i = 0; i < 0.25 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 0, pop: true }, dt);
    expect(s.popCharge).toBeGreaterThan(0.3);
    expect(s.popCharge).toBeLessThan(0.7);
    for (let i = 0; i < 2 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 0, pop: true }, dt);
    expect(s.popCharge).toBe(1);
  });

  it('gir et lite hopp (ollie) på flat bakke, og lander igjen', () => {
    const s = moving(15);
    for (let i = 0; i < 0.6 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 0, pop: true }, dt);
    stepSkier(s, { steer: 0, brake: 0, pop: false }, dt);
    expect(s.grounded).toBe(false);
    expect(s.lastPop).toBe('pop');
    let maxH = 0;
    for (let i = 0; i < 1 * CONFIG.physicsHz; i++) {
      stepSkier(s, { steer: 0, brake: 0, pop: false }, dt);
      maxH = Math.max(maxH, s.y - heightAt(s.x, s.z));
    }
    expect(maxH).toBeGreaterThan(0.04);
    expect(s.grounded).toBe(true);
  });

  it('gjør ingenting hvis du slipper i lufta', () => {
    const s: SkierState = { ...moving(15), y: heightAt(0, 5) + 3, grounded: false };
    stepSkier(s, { steer: 0, brake: 0, pop: true }, dt);
    const vy = s.vy;
    stepSkier(s, { steer: 0, brake: 0, pop: false }, dt);
    expect(s.vy).toBeCloseTo(vy - CONFIG.gravity * dt, 6);
  });

  const none = ride(null);
  const perfect = ride(0.05);
  const early = ride(0.6);

  it('perfekt pop på kanten gir mer høyde på alle hoppene', () => {
    for (const k of PARK.kickers) {
      expect(perfect.get(k.name)!.pop).toBe('perfekt');
      expect(perfect.get(k.name)!.heightOverLip).toBeGreaterThan(none.get(k.name)!.heightOverLip + 0.3);
    }
  });

  it('med perfekt pop når det store hoppet målet på 5–7 m', () => {
    const h = perfect.get('Stort')!.heightOverLip;
    expect(h).toBeGreaterThanOrEqual(5);
    expect(h).toBeLessThanOrEqual(7);
  });

  it('for tidlig slipp er ikke perfekt, og gir mindre høyde enn perfekt', () => {
    for (const k of PARK.kickers) {
      expect(early.get(k.name)?.pop).not.toBe('perfekt');
      expect(early.get(k.name)?.heightOverLip ?? 0).toBeLessThan(perfect.get(k.name)!.heightOverLip);
    }
  });

  it('landingene er fortsatt myke med perfekt pop (under 12°)', () => {
    for (const k of PARK.kickers) expect(perfect.get(k.name)!.landingAngle).toBeLessThan(12);
  });

  it('er deterministisk', () => {
    expect([...ride(0.05).entries()]).toEqual([...perfect.entries()]);
  });
});
