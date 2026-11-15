import { describe, expect, it } from 'vitest';
import { heightAt } from '../src/park/terrain';
import { buildGroundMesh, type GroundMesh } from '../src/render/groundGrid';
import { LOOK } from '../src/render/look';
import {
  createAutoQuality, createFpsMeter, forestCount, LEVELS, lowerLevel, parseChoice, settingsFor, spreadOrder, startLevel,
} from '../src/render/quality';
import { createSpray, type SprayFrame } from '../src/render/spray';

const A = LOOK.quality.auto;

describe('kvalitetsnivåene', () => {
  it('Høy ser ut som før: full oppløsning (2), skygger 2048, all skog, samme tåke og bakke', () => {
    const h = settingsFor('hoy');
    expect(h.pixelRatio).toBe(2);
    expect(h.shadowMapSize).toBe(LOOK.shadow.mapSize);
    expect(h.fogFar).toBe(LOOK.fog.far);
    expect(h.forest).toBe(1);
    expect(h.spray).toBe(1);
    expect(h.groundTolerance).toBe(LOOK.ground.tolerance);
    expect(h.antialias).toBe(true);
  });

  it('pixelRatio og skygger er 1 / 1,5 / 2 og av / 1024 / 2048', () => {
    expect(LEVELS.map((l) => settingsFor(l).pixelRatio)).toEqual([1, 1.5, 2]);
    expect(LEVELS.map((l) => settingsFor(l).shadowMapSize)).toEqual([0, 1024, 2048]);
  });

  it('hvert nivå ned koster aldri mer: mindre eller like mye av alt', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const lo = settingsFor(LEVELS[i - 1]), hi = settingsFor(LEVELS[i]);
      expect(lo.pixelRatio).toBeLessThanOrEqual(hi.pixelRatio);
      expect(lo.shadowMapSize).toBeLessThanOrEqual(hi.shadowMapSize);
      expect(lo.forest).toBeLessThanOrEqual(hi.forest);
      expect(lo.fogFar).toBeLessThanOrEqual(hi.fogFar);
      expect(lo.spray).toBeLessThanOrEqual(hi.spray);
      expect(lo.groundTolerance).toBeGreaterThanOrEqual(hi.groundTolerance);
      // tåka må fortsatt starte før den er helt tett
      expect(lo.fogFar).toBeGreaterThan(LOOK.fog.near + 50);
    }
  });

  it('ett nivå ned om gangen, og ingenting under Lav', () => {
    expect(lowerLevel('hoy')).toBe('middels');
    expect(lowerLevel('middels')).toBe('lav');
    expect(lowerLevel('lav')).toBeNull();
  });

  it('valget fra lagringen leses trygt: ukjent eller tomt blir Auto', () => {
    expect(parseChoice('lav')).toBe('lav');
    expect(parseChoice('hoy')).toBe('hoy');
    expect(parseChoice('auto')).toBe('auto');
    expect(parseChoice(null)).toBe('auto');
    expect(parseChoice('ultra')).toBe('auto');
    expect(parseChoice(undefined)).toBe('auto');
  });

  it('Auto starter på Middels på mobil og Høy på PC; et fast valg gjelder uansett enhet', () => {
    expect(startLevel('auto', true)).toBe('middels');
    expect(startLevel('auto', false)).toBe('hoy');
    expect(startLevel('lav', false)).toBe('lav');
    expect(startLevel('hoy', true)).toBe('hoy');
  });
});

describe('skogtetthet', () => {
  it('tegner riktig andel av trærne i hver bit', () => {
    expect(forestCount(100, 1)).toBe(100);
    expect(forestCount(100, 0.45)).toBe(45);
    expect(forestCount(0, 0.5)).toBe(0);
    expect(forestCount(3, 0)).toBe(0);
  });

  it('rekkefølgen blandes fast, så de trærne som blir igjen er spredt, ikke bare de første klyngene', () => {
    const xs = Array.from({ length: 200 }, (_, i) => i);
    const a = spreadOrder(xs, 5), b = spreadOrder(xs, 5);
    expect(a).toEqual(b);
    expect([...a].sort((p, q) => p - q)).toEqual(xs);
    // de første 45 % dekker både starten og slutten av lista
    const kept = a.slice(0, forestCount(200, 0.45));
    expect(Math.min(...kept)).toBeLessThan(20);
    expect(Math.max(...kept)).toBeGreaterThan(180);
    expect(xs[0]).toBe(0); // originalen endres ikke
  });
});

describe('FPS-måleren', () => {
  it('gir snittet over et helt vindu, ikke hvert bilde', () => {
    const m = createFpsMeter(1);
    const out: number[] = [];
    for (let i = 0; i < 120; i++) { const v = m.add(1 / 60); if (v !== null) out.push(v); }
    expect(out).toHaveLength(2);
    for (const v of out) expect(v).toBeCloseTo(60, 0);
    expect(m.value).toBeCloseTo(60, 0);
  });

  it('ett hakk (ett tregt bilde) gir et rolig snitt, ikke et hopp til 4 fps', () => {
    const m = createFpsMeter(1);
    let v: number | null = null;
    for (let i = 0; i < 60 && v === null; i++) v = m.add(i === 30 ? 0.25 : 1 / 60);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(40);
  });

  it('bilder med dt 0 (pause) telles ikke, og reset starter vinduet på nytt', () => {
    const m = createFpsMeter(1);
    for (let i = 0; i < 30; i++) m.add(1 / 30);
    for (let i = 0; i < 100; i++) expect(m.add(0)).toBeNull();
    m.reset();
    const out: number[] = [];
    for (let i = 0; i < 61; i++) { const v = m.add(1 / 60); if (v !== null) out.push(v); }
    expect(out).toHaveLength(1);
    expect(out[0]).toBeCloseTo(60, 0);
  });
});

/** Mater Auto med ett snitt per sekund. Gir nivåene den byttet til. */
function feed(auto: ReturnType<typeof createAutoQuality>, fps: number[]) {
  const drops: string[] = [];
  for (const f of fps) { const d = auto.update(f, 1); if (d) drops.push(d); }
  return drops;
}
const secs = (n: number, fps: number) => Array.from({ length: n }, () => fps);

describe('Auto senker kvaliteten når det går tregt', () => {
  it('holder nivået når fps er god', () => {
    const auto = createAutoQuality('hoy');
    expect(feed(auto, secs(60, 60))).toEqual([]);
    expect(auto.level).toBe('hoy');
  });

  it('går ett nivå ned etter noen sekunder under 45 fps (etter innsvingningen)', () => {
    const auto = createAutoQuality('hoy');
    const drops = feed(auto, secs(A.settle + A.slowFor - 1, 30));
    expect(drops).toEqual([]);
    expect(feed(auto, [30])).toEqual(['middels']);
    expect(auto.level).toBe('middels');
  });

  it('ett kort hakk under 45 fps senker ikke', () => {
    const auto = createAutoQuality('hoy');
    const pattern = [...secs(A.settle, 60)];
    for (let i = 0; i < 20; i++) pattern.push(40, 60, 60);
    expect(feed(auto, pattern)).toEqual([]);
  });

  it('hysterese: mellom 45 og 50 fps nullstilles ikke tellingen, over 50 gjør den det', () => {
    const a = createAutoQuality('hoy');
    feed(a, secs(A.settle, 60));
    const half = Math.ceil(A.slowFor / 2);
    expect(feed(a, [...secs(half, 40), 47, ...secs(A.slowFor - half, 40)])).toEqual(['middels']);
    const b = createAutoQuality('hoy');
    feed(b, secs(A.settle, 60));
    expect(feed(b, [...secs(half, 40), 55, ...secs(A.slowFor - half, 40)])).toEqual([]);
  });

  it('venter før den måler igjen etter et bytte, og stopper på Lav', () => {
    const auto = createAutoQuality('hoy');
    const drops = feed(auto, secs(120, 20));
    expect(drops).toEqual(['middels', 'lav']);
    expect(auto.level).toBe('lav');
    // det andre byttet kom ikke rett etter det første
    const b = createAutoQuality('hoy');
    const at: number[] = [];
    for (let i = 0; i < 40; i++) if (b.update(20, 1)) at.push(i);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(A.settle + A.slowFor);
  });

  it('går aldri opp igjen av seg selv, selv om fps blir god', () => {
    const auto = createAutoQuality('hoy');
    feed(auto, secs(A.settle + A.slowFor, 30));
    expect(auto.level).toBe('middels');
    expect(feed(auto, secs(300, 144))).toEqual([]);
    expect(auto.level).toBe('middels');
  });

  it('hold() (pause eller bytte) gir ny innsvingning og nullstiller tellingen', () => {
    const auto = createAutoQuality('hoy');
    feed(auto, secs(A.settle + A.slowFor - 1, 30));
    auto.hold();
    expect(feed(auto, secs(A.settle + A.slowFor - 1, 30))).toEqual([]);
    expect(feed(auto, [30])).toEqual(['middels']);
  });
});

describe('snøsprut på lavere nivå', () => {
  const frame = (i: number, dt: number): SprayFrame => ({
    dt, x: 0, y: 0, z: i * dt * 15, heading: 0, vx: 0, vy: 0, vz: 15, edge: 1, brake: 1, grounded: true,
    sinceLanding: 99 + i * dt, popAge: 99 + i * dt, airTime: 0, nx: 0, ny: 1, nz: 0, lastPop: '', camX: 0, camY: 50, camZ: 0,
  });
  const run = (amount: number) => {
    const s = createSpray({ seed: 1, groundAt: () => 0 });
    s.setAmount(amount);
    let peak = 0;
    for (let i = 0; i < 240; i++) { s.update(frame(i, 1 / 60)); peak = Math.max(peak, s.count); }
    return { emitted: s.emitted, peak };
  };

  it('færre partikler, omtrent i forhold til mengden, og aldri flere enn taket tillater', () => {
    const full = run(1), low = run(0.4);
    expect(low.emitted).toBeLessThan(full.emitted * 0.5);
    expect(low.emitted).toBeGreaterThan(full.emitted * 0.3);
    expect(low.peak).toBeLessThanOrEqual(Math.round(800 * 0.4));
  });
});

describe('bakken på lavere nivå', () => {
  function worstGap(mesh: GroundMesh): number {
    const p = mesh.positions, ix = mesh.indices;
    let worst = 0;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      for (let i = 0; i <= 3; i++) for (let j = 0; i + j <= 3; j++) {
        const u = i / 3, v = j / 3, w = 1 - u - v;
        const x = u * p[a] + v * p[b] + w * p[c];
        const y = u * p[a + 1] + v * p[b + 1] + w * p[c + 1];
        const z = u * p[a + 2] + v * p[b + 2] + w * p[c + 2];
        worst = Math.max(worst, Math.abs(y - heightAt(x, z)));
      }
    }
    return worst;
  }

  it('Lav gir færre trekanter, men skiene synker fortsatt under 4 cm ned i snøen', () => {
    const high = buildGroundMesh(settingsFor('hoy').groundTolerance);
    const low = buildGroundMesh(settingsFor('lav').groundTolerance);
    expect(low.indices.length).toBeLessThan(high.indices.length * 0.9);
    expect(worstGap(low)).toBeLessThan(0.04);
  });
});
