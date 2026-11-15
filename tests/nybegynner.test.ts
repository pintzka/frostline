import { describe, expect, it, vi } from 'vitest';

// Late som om spilleren har valgt nybegynnerparken (lagret i localStorage) før spillet lastes.
// Da bygger hele spillet (bakke, fysikk, fall og trær) seg for den parken, akkurat som i nettleseren.
vi.hoisted(() => {
  const data: Record<string, string> = { 'frostline.park': 'nybegynner' };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => { data[k] = v; },
    },
  });
});

import { CONFIG } from '../src/core/config';
import { createGame, stepGame, type Game } from '../src/core/game';
import { createSkier, speedOf, stepSkier } from '../src/physics/skier';
import { heightAt, LANDING, lipHeight, normalAt, PARK, rampLength, type Kicker } from '../src/park/terrain';
import { validatePark } from '../src/park/format';
import { CURRENT_PARK_ID, PARKS } from '../src/park/parks';
import { respawnSpot } from '../src/tricks/fall';
import { planMarkers, planTrees } from '../src/render/sceneryLayout';
import nybegynner from '../src/park/parks/nybegynner.json';
import type { RawControls } from '../src/tricks/controls';

const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const slope = Math.tan(CONFIG.slopeDeg * DEG);
const none: RawControls = { steer: 0, brake: 0, flip: 0, pop: false };
/** Det minste hoppet i testbakken. Alle hoppene her skal være mindre. */
const lite = PARKS.testbakke.kickers[0];

interface Flight { kicker: string; airtime: number; heightOverLip: number; landingAngle: number; rampG: number; pop: string; lipSpeed: number }

/**
 * Kjør rett ned hele bakken med den ekte fysikken og logg hvert hopp.
 * scale: farten ganges med dette 30 m før rampen på hoppet nr. `at` (for å teste litt saktere og raskere fart).
 * lead: slipp pop så mange sekunder før kanten (null = ingen pop).
 */
function ride(opts: { lead?: number | null; scale?: number; at?: number } = {}) {
  const { lead = null, scale = 1, at = -1 } = opts;
  const s = createSkier();
  const out: Flight[] = [];
  let cur: (Flight & { lipY: number; lipZ: number }) | null = null;
  let rampG = 0;
  const scaleZ = at >= 0 ? PARK.kickers[at].z - rampLength(PARK.kickers[at]) - 30 : Infinity;
  let scaled = false;
  for (let i = 0; i < 70 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
    if (!scaled && s.z > scaleZ) { s.vx *= scale; s.vy *= scale; s.vz *= scale; scaled = true; }
    const next = PARK.kickers.find((k) => k.z - s.z > -1 && k.z - s.z < 60);
    const timeToLip = next ? (next.z - s.z) / Math.max(1, s.vz) : Infinity;
    const pop = lead !== null && next !== undefined && s.grounded && timeToLip > lead;
    const was = s.grounded, y0 = s.y, vx0 = s.vx, vy0 = s.vy, vz0 = s.vz, v0 = speedOf(s);
    stepSkier(s, { steer: 0, brake: 0, pop }, dt);
    if (was && s.grounded) {
      // kraften fra bakken langs normalen, i g (rampen og utkjøringen)
      const [nx, ny, nz] = normalAt(s.x, s.z);
      const ax = (s.vx - vx0) / dt, ay = (s.vy - vy0) / dt + CONFIG.gravity, az = (s.vz - vz0) / dt;
      rampG = Math.max(rampG, (ax * nx + ay * ny + az * nz) / CONFIG.gravity);
    }
    if (was && !s.grounded) {
      const k = PARK.kickers.find((k) => Math.abs(k.z - s.z) < 3);
      cur = { kicker: k ? k.name : '', airtime: 0, heightOverLip: 0, landingAngle: 0, rampG, pop: '', lipSpeed: v0, lipY: y0, lipZ: s.z };
    }
    if (cur && !s.grounded) {
      cur.airtime += dt;
      cur.heightOverLip = Math.max(cur.heightOverLip, s.y - (cur.lipY - (s.z - cur.lipZ) * slope));
    }
    if (cur && s.grounded) {
      const [nx, ny, nz] = normalAt(s.x, s.z);
      cur.landingAngle = Math.asin(Math.max(-1, Math.min(1, -(vx0 * nx + vy0 * ny + vz0 * nz) / v0))) / DEG;
      cur.pop = s.lastPop;
      out.push(cur);
      cur = null;
      rampG = 0;
    }
    // utkjøringen etter en landing telles med, men nullstill langt fra hoppene
    if (s.grounded && Math.min(...PARK.kickers.map((k) => Math.abs(s.z - k.z))) > 60) rampG = 0;
  }
  return out;
}

const of = (flights: Flight[], k: Kicker) => flights.find((f) => f.kicker === k.name);

describe('nybegynnerparken', () => {
  it('er valgt og validerer uten feil', () => {
    expect(CURRENT_PARK_ID).toBe('nybegynner');
    expect(PARK.name).toBe('Nybegynner');
    expect(validatePark(nybegynner)).toEqual([]);
  });

  it('respawn-tallene i parkfila sjekkes: begge eller ingen, og fornuftige verdier', () => {
    const copy = () => JSON.parse(JSON.stringify(nybegynner));
    const one = copy(); delete one.kickers[0].respawnSpeed;
    expect(validatePark(one).join(' ')).toMatch(/både "respawnBeforeRamp" og "respawnSpeed"/);
    const near = copy(); near.kickers[1].respawnBeforeRamp = 2;
    expect(validatePark(near).join(' ')).toMatch(/minst 10 m/);
    const fast = copy(); fast.kickers[1].respawnSpeed = 99;
    expect(validatePark(fast).join(' ')).toMatch(/respawnSpeed/);
    const typo = copy(); typo.kickers[1].respawnSped = 10;
    expect(validatePark(typo).join(' ')).toMatch(/ukjent felt "respawnSped"/);
    // uten tallene brukes standardtallene fra config (75 m, laget for testbakken). Det første hoppet har ingen
    // hopp over seg, så der er det gyldig. På de neste er 75 m for langt (du havner oppe på hoppet over),
    // og det er bare den feilen som kommer (samlet-test sjekker også dette).
    const first = copy(); delete first.kickers[0].respawnBeforeRamp; delete first.kickers[0].respawnSpeed;
    expect(validatePark(first)).toEqual([]);
    const without = copy(); for (const k of without.kickers) { delete k.respawnBeforeRamp; delete k.respawnSpeed; }
    const errs = validatePark(without);
    expect(errs.length).toBeGreaterThan(0);
    for (const e of errs) expect(e).toMatch(/oppe på/);
  });

  it('har 3–4 hopp, alle mindre enn «Lite» i testbakken, og god plass mellom dem', () => {
    expect(PARK.kickers.length).toBeGreaterThanOrEqual(3);
    expect(PARK.kickers.length).toBeLessThanOrEqual(4);
    expect(PARK.length).toBeLessThanOrEqual(PARKS.testbakke.length);
    for (const k of PARK.kickers) {
      expect(lipHeight(k)).toBeLessThan(lipHeight(lite));
      expect(k.lipDeg).toBeLessThan(lite.lipDeg);
    }
    PARK.kickers.slice(1).forEach((k, i) => {
      const prev = PARK.kickers[i];
      const prevEnd = prev.z + prev.landingStart + LANDING.knuckle + LANDING.steep;
      expect(k.z - rampLength(k) - prevEnd).toBeGreaterThanOrEqual(30);
    });
  });

  const plain = ride();

  it('en vanlig kjøring letter fra hvert hopp og bare der', () => {
    expect(plain.map((f) => f.kicker)).toEqual(PARK.kickers.map((k) => k.name));
  });

  it('små hopp: kortere og lavere enn «Lite», men lange nok til at triks teller', () => {
    const liteFlight = { airtime: 1.18, height: 1.06 }; // målt for «Lite» i air.test.ts-kjøringen
    for (const f of plain) {
      expect(f.airtime).toBeGreaterThan(CONFIG.trickMinAir);
      expect(f.airtime).toBeLessThan(liteFlight.airtime);
      expect(f.heightOverLip).toBeLessThan(liteFlight.height);
    }
  });

  it('myk rampe (maks 2,1 g) og myk landing (under 10°), og nesten all fart beholdes', () => {
    for (const f of plain) {
      expect(f.rampG, f.kicker).toBeLessThanOrEqual(2.1);
      expect(f.landingAngle, f.kicker).toBeLessThan(10);
    }
  });

  it('også myk landing med 5 % saktere og 3 % raskere fart inn mot hoppet', () => {
    PARK.kickers.forEach((k, i) => {
      for (const scale of [0.95, 1.03]) {
        const f = of(ride({ scale, at: i }), k);
        expect(f, `${k.name} ×${scale}`).toBeDefined();
        expect(f!.landingAngle, `${k.name} ×${scale}`).toBeLessThan(10);
        expect(f!.rampG, `${k.name} ×${scale}`).toBeLessThanOrEqual(2.1);
      }
    });
  });

  it('perfekt pop gir mer høyde og lander fortsatt under 11°', () => {
    const perfect = ride({ lead: 0.05 });
    for (const k of PARK.kickers) {
      const p = of(perfect, k)!, n = of(plain, k)!;
      expect(p.pop).toBe('perfekt');
      expect(p.heightOverLip).toBeGreaterThan(n.heightOverLip + 0.2);
      expect(p.landingAngle).toBeLessThan(11);
    }
  });

  it('er deterministisk', () => {
    expect(ride()).toEqual(plain);
  });
});

/** Kjører spillet rett ned fra en tilstand uten taster og logger hvert hopp. */
function flights(g: Game, untilZ: number) {
  const out: { z: number; speed: number; angle: number }[] = [];
  let cur: { z: number; speed: number; angle: number } | null = null;
  for (let i = 0; i < 60 * CONFIG.physicsHz && g.skier.z < untilZ; i++) {
    const s = g.skier;
    const was = s.grounded, vx = s.vx, vy = s.vy, vz = s.vz;
    stepGame(g, none, dt);
    if (was && !s.grounded) cur = { z: s.z, speed: speedOf(s), angle: 0 };
    if (!was && s.grounded && cur) {
      const [nx, ny, nz] = normalAt(s.x, s.z);
      const v = Math.hypot(vx, vy, vz);
      cur.angle = Math.asin(Math.max(-1, Math.min(1, -(vx * nx + vy * ny + vz * nz) / v))) / DEG;
      out.push(cur); cur = null;
    }
  }
  return out;
}

describe('nybegynnerparken: fall og respawn', () => {
  const normal = flights(createGame(), PARK.length);

  it('fall på landingen: tilbake før rampen på samme hopp, med samme fart på kanten (innen 3 %) og myk landing', () => {
    PARK.kickers.forEach((k) => {
      const spot = respawnSpot(0, k.z + 30, k.z + 0.5);
      const g = createGame();
      Object.assign(g.fall, { respawnX: spot.x, respawnZ: spot.z, respawnSpeed: spot.speed, respawned: false, time: CONFIG.fallRespawnAt - dt / 2 });
      stepGame(g, none, dt);
      expect(g.skier.z, k.name).toBeLessThan(k.z - rampLength(k) - 15);
      const first = flights(g, k.z + 100)[0];
      const plainFlight = normal.find((f) => Math.abs(f.z - k.z) < 3)!;
      expect(Math.abs(first.z - k.z), k.name).toBeLessThan(3);
      expect(Math.abs(first.speed / plainFlight.speed - 1), k.name).toBeLessThan(0.03);
      expect(first.angle, k.name).toBeLessThan(10);
    });
  });

  it('aldri på en rampe, et platå eller i kanten inn til landingen', () => {
    for (let z = 10; z < PARK.length - 50; z += 0.5) {
      for (const takeoff of [z - 5, z - 40]) {
        const spot = respawnSpot(0, z, takeoff);
        for (const k of PARK.kickers) {
          const inside = spot.z > k.z - rampLength(k) - 5 && spot.z < k.z + k.landingStart + LANDING.knuckle;
          expect(inside, 'fall z=' + z + ', satt tilbake z=' + spot.z).toBe(false);
        }
        expect(spot.z).toBeLessThanOrEqual(z);
      }
    }
  });
});

describe('nybegynnerparken: miljøet bygges for parken', () => {
  it('trærne står aldri i løypa eller ved hoppene', () => {
    for (const t of planTrees()) {
      expect(Math.abs(t.x)).toBeGreaterThan(PARK.width / 2);
      for (const k of PARK.kickers) {
        expect(Math.abs(t.x) < k.width / 2 + 15 && t.z > k.z - 80 && t.z < k.z + 170).toBe(false);
      }
    }
  });

  it('to merker per hopp, ved siden av hoppet', () => {
    const m = planMarkers();
    expect(m.length).toBe(PARK.kickers.length * 2);
    PARK.kickers.forEach((k, i) => {
      for (const p of m.slice(i * 2, i * 2 + 2)) expect(Math.abs(p.z - k.z)).toBeLessThan(5);
    });
  });

  it('bakken følger nybegynnerparken (ikke testbakken)', () => {
    const k = PARK.kickers[0];
    // på kanten av det første hoppet står bakken over grunnhelningen med akkurat kanthøyden
    const base = -k.z * slope + nybegynner.waves.height * Math.sin(k.z * nybegynner.waves.along);
    expect(heightAt(0, k.z) - base).toBeCloseTo(lipHeight(k), 5);
  });
});
