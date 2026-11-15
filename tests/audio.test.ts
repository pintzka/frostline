import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, stepSkier, type SkierState } from '../src/physics/skier';
import { heightAt, PARK } from '../src/park/terrain';
import { clamp01, detectEvents, landingLevel, popLevel, skidAmount, soundLevels, type SoundInput } from '../src/audio/mix';
import { createAudio } from '../src/audio/engine';

const dt = 1 / CONFIG.physicsHz;
const base: SoundInput = { speed: 10, grounded: true, edge: 0, brake: 0, skid: 0 };
const at = (o: Partial<SoundInput>) => soundLevels({ ...base, ...o });

function moving(speed: number): SkierState {
  const s = createSkier();
  const a = (CONFIG.slopeDeg * Math.PI) / 180;
  s.vz = speed * Math.cos(a);
  s.vy = -speed * Math.sin(a);
  return s;
}

describe('lydnivåer', () => {
  it('mer og lysere vind jo fortere du kjører', () => {
    let last = at({ speed: 0 });
    for (const speed of [3, 8, 14, 20, 25]) {
      const l = at({ speed });
      expect(l.wind).toBeGreaterThan(last.wind);
      expect(l.windTone).toBeGreaterThan(last.windTone);
      last = l;
    }
  });

  it('snø-suset følger farten, og er helt stille i lufta', () => {
    expect(at({ speed: 0 }).snow).toBe(0);
    expect(at({ speed: 15 }).snow).toBeGreaterThan(at({ speed: 5 }).snow);
    const air = at({ speed: 20, grounded: false, edge: 1, brake: 1, skid: 1 });
    expect(air.snow).toBe(0);
    expect(air.carve).toBe(0);
    expect(air.scrape).toBe(0);
    // men vinden er der fortsatt
    expect(air.wind).toBeGreaterThan(0.3);
  });

  it('carve-hvislet kommer med hard kant, ikke med rette ski', () => {
    expect(at({ speed: 15, edge: 0 }).carve).toBe(0);
    expect(at({ speed: 15, edge: 0.2 }).carve).toBe(0);
    expect(at({ speed: 15, edge: -1 }).carve).toBeGreaterThan(at({ speed: 15, edge: 0.6 }).carve);
    expect(at({ speed: 15, edge: 1 }).carve).toBeCloseTo(at({ speed: 15, edge: -1 }).carve, 9);
  });

  it('brems gir skrape-lyd, sterkere i fart, og stille når du står', () => {
    expect(at({ brake: 0 }).scrape).toBe(0);
    expect(at({ brake: 1, speed: 12 }).scrape).toBeGreaterThan(at({ brake: 1, speed: 4 }).scrape);
    expect(at({ brake: 1, speed: 0 }).scrape).toBe(0);
    // skrens gir litt skrape, men mindre enn full brems
    expect(at({ skid: 1 }).scrape).toBeGreaterThan(0);
    expect(at({ skid: 1 }).scrape).toBeLessThan(at({ brake: 1 }).scrape);
  });

  it('alle verdier er alltid endelige og mellom 0 og 1, også med rare tall inn', () => {
    const odd = [0, -5, 1e9, NaN, Infinity, -Infinity, 0.5, 30];
    for (const speed of odd) for (const edge of odd) for (const brake of odd) for (const grounded of [true, false]) {
      const l = soundLevels({ speed, edge, brake, skid: edge, grounded });
      for (const v of Object.values(l)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    for (const v of odd) {
      for (const x of [landingLevel(v, v), landingLevel(v, 1), landingLevel(1, v), popLevel(v, true), popLevel(v, false), clamp01(v)]) {
        expect(Number.isFinite(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
    }
  });

  it('små endringer i farten gir små endringer i lyden (ingen brå hopp)', () => {
    let prev = at({ speed: 0, edge: 0 });
    for (let i = 1; i <= 3000; i++) {
      const speed = i * 0.01, edge = Math.min(1, i / 3000);
      const l = at({ speed, edge, brake: edge });
      for (const k of Object.keys(l) as (keyof typeof l)[]) expect(Math.abs(l[k] - prev[k])).toBeLessThan(0.02);
      prev = l;
    }
  });
});

describe('landing og pop', () => {
  it('lengre lufttid og hardere støt gir kraftigere dump', () => {
    // ingen lufttid = ingen lyd
    expect(landingLevel(0, 0)).toBe(0);
    let last = 0;
    for (const air of [0.1, 0.3, 0.7, 1.2, 2, 2.5, 3]) {
      const l = landingLevel(air, 1);
      expect(l).toBeGreaterThan(last);
      last = l;
    }
    expect(landingLevel(1, 6)).toBeGreaterThan(landingLevel(1, 2));
    expect(landingLevel(4, 20)).toBe(1);
  });

  it('kuler i bakken (bittelitt lufttid) er nesten stille', () => {
    expect(landingLevel(0.05, 2)).toBeLessThan(0.05);
  });

  it('rekkefølgen i ekte kjøring: ollie < lite < medium < stort < stort med pop', () => {
    // ollie på flat bakke, fullt ladet
    const s = moving(15);
    let ollie = 0;
    for (let i = 0; i < 2 * CONFIG.physicsHz; i++) {
      const prev = { ...s };
      stepSkier(s, { steer: 0, brake: 0, pop: i < 0.6 * CONFIG.physicsHz }, dt);
      ollie = Math.max(ollie, detectEvents(prev, s).landing ?? 0);
    }
    // hele bakken: uten pop, og med perfekt pop (slipp like før kanten)
    const ride = (lead: number | null) => {
      const r = createSkier();
      const best = new Map<string, number>();
      for (let i = 0; i < 80 * CONFIG.physicsHz && r.z < PARK.length - 45; i++) {
        const next = PARK.kickers.find((k) => k.z - r.z > -1 && k.z - r.z < 60);
        const timeToLip = next ? (next.z - r.z) / Math.max(1, r.vz) : Infinity;
        const pop = lead !== null && next !== undefined && r.grounded && timeToLip > lead;
        const prev = { ...r };
        stepSkier(r, { steer: 0, brake: 0, pop }, dt);
        const l = detectEvents(prev, r).landing;
        const k = PARK.kickers.find((k) => r.z > k.z && r.z < k.z + 100);
        if (l !== null && k) best.set(k.name, Math.max(best.get(k.name) ?? 0, l));
      }
      return best;
    };
    const plain = ride(null);
    const popped = ride(0.05);
    const order = [ollie, plain.get('Lite')!, plain.get('Medium')!, plain.get('Stort')!, popped.get('Stort')!];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1] + 0.05);
    expect(ollie).toBeLessThan(0.35);
    expect(popped.get('Stort')!).toBeGreaterThan(0.8);
  });

  it('pop er sterkere med full lading, og litt sterkere når den er perfekt', () => {
    expect(popLevel(1, false)).toBeGreaterThan(popLevel(0, false));
    expect(popLevel(0.5, true)).toBeGreaterThan(popLevel(0.5, false));
  });

  it('finner pop og landing i et ekte hopp, én gang hver', () => {
    const s = moving(15);
    let pops = 0, landings = 0, landing = 0;
    for (let i = 0; i < 2 * CONFIG.physicsHz; i++) {
      const prev = { ...s };
      stepSkier(s, { steer: 0, brake: 0, pop: i < 0.6 * CONFIG.physicsHz }, dt);
      const e = detectEvents(prev, s);
      if (e.pop !== null) pops++;
      if (e.landing !== null) { landings++; landing = e.landing; }
    }
    expect(pops).toBe(1);
    expect(landings).toBe(1);
    expect(landing).toBeGreaterThan(0.1);
  });

  it('et høyt fall gir hardere landing enn et lite hopp', () => {
    const land = (drop: number) => {
      const s: SkierState = { ...moving(15), grounded: false };
      s.y = heightAt(s.x, s.z) + drop;
      for (let i = 0; i < 3 * CONFIG.physicsHz; i++) {
        const prev = { ...s };
        stepSkier(s, { steer: 0, brake: 0 }, dt);
        const e = detectEvents(prev, s);
        if (e.landing !== null) return e.landing;
      }
      return -1;
    };
    expect(land(4)).toBeGreaterThan(land(0.3));
  });

  it('ingen lyd-hendelser når du bare kjører', () => {
    const s = moving(10);
    for (let i = 0; i < 2 * CONFIG.physicsHz; i++) {
      const prev = { ...s };
      stepSkier(s, { steer: Math.sin(i / 100), brake: 0 }, dt);
      const e = detectEvents(prev, s);
      expect(e.pop).toBeNull();
      expect(e.landing).toBeNull();
    }
  });

  it('skrens: 0 når skiene peker dit du kjører, 1 på tvers', () => {
    expect(skidAmount({ vx: 0, vz: 10, heading: 0 })).toBeCloseTo(0, 9);
    expect(skidAmount({ vx: 0, vz: 10, heading: Math.PI / 2 })).toBeCloseTo(1, 9);
    expect(skidAmount({ vx: 0, vz: 0.2, heading: 1 })).toBe(0);
  });
});

describe('lydmotoren uten Web Audio', () => {
  it('gjør ingenting farlig når nettleseren ikke har lyd', () => {
    const a = createAudio();
    const s = createSkier();
    expect(() => {
      a.step({ ...s }, s, 0);
      a.frame();
      a.newRun();
      a.toggleMute();
      a.suspend();
      a.resume();
    }).not.toThrow();
  });
});

describe('lyd på rails', () => {
  it('på railen: ingen snø-sus eller carve, men skrape, og vind som på bakken (ikke luft)', () => {
    const base = { speed: 15, grounded: true, edge: 0.8, brake: 0, skid: 0 };
    const snow = soundLevels(base);
    const rail = soundLevels({ ...base, rail: true });
    const air = soundLevels({ ...base, grounded: false });
    expect(rail.snow).toBe(0);
    expect(rail.carve).toBe(0);
    expect(rail.scrape).toBeGreaterThan(0.3);
    expect(rail.scrapeTone).toBeGreaterThan(snow.scrapeTone - 1e-9);
    expect(rail.wind).toBe(snow.wind);
    expect(rail.wind).toBeLessThan(air.wind);
  });
});
