import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { brakeRate, carveRate, createSpray, landingCount, type SprayFrame } from '../src/render/spray';

/** Et bilde der skiløperen kjører rett ned en flat bakke i 15 m/s. */
function frame(over: Partial<SprayFrame> = {}): SprayFrame {
  return {
    dt: 1 / 60, x: 0, y: 0, z: 0, heading: 0, vx: 0, vy: 0, vz: 15,
    edge: 0, brake: 0, grounded: true, sinceLanding: 99, popAge: 99, airTime: 0,
    nx: 0, ny: 1, nz: 0, lastPop: '', camX: 0, camY: 50, camZ: 0, ...over,
  };
}

/** Kjører sprut i et antall sekunder med fast fps. Skiløperen flytter seg med farten. */
function run(seconds: number, fps: number, over: Partial<SprayFrame> = {}, seed = 1) {
  const s = createSpray({ seed, groundAt: () => 0 });
  const dt = 1 / fps;
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) s.update(frame({ dt, z: i * dt * 15, sinceLanding: 99 + i * dt, popAge: 99 + i * dt, ...over }));
  return s;
}

describe('snøsprut: hvor mye', () => {
  it('kjører du rett fram uten kant og brems, spruter det ikke', () => {
    expect(run(2, 60).emitted).toBe(0);
  });

  it('i lufta spruter det ingenting, selv med full kant og brems', () => {
    expect(run(2, 60, { grounded: false, edge: 1, brake: 1, airTime: 1 }).emitted).toBe(0);
  });

  it('hardere kant og høyere fart gir mer sprut', () => {
    expect(carveRate(1, 15)).toBeGreaterThan(carveRate(0.5, 15));
    expect(carveRate(0.5, 15)).toBeGreaterThan(carveRate(0.2, 15));
    expect(carveRate(1, 20)).toBeGreaterThan(carveRate(1, 8));
    expect(carveRate(1, 0)).toBe(0);
    expect(run(2, 60, { edge: 1 }).emitted).toBeGreaterThan(run(2, 60, { edge: 0.4 }).emitted * 2);
  });

  it('mengden følger kant og fart mykt, uten hopp', () => {
    for (let e = 0; e < 1; e += 0.01) expect(Math.abs(carveRate(e + 0.01, 15) - carveRate(e, 15))).toBeLessThan(CONFIG.sprayCarveRate * 0.04);
    for (let v = 0; v < 25; v += 0.1) expect(Math.abs(carveRate(1, v + 0.1) - carveRate(1, v))).toBeLessThan(CONFIG.sprayCarveRate * 0.02);
  });

  it('brems gir mest sprut, mer enn full carving', () => {
    expect(brakeRate(1, 15)).toBeGreaterThan(carveRate(1, 25));
    expect(run(2, 60, { brake: 1 }).emitted).toBeGreaterThan(run(2, 60, { edge: 1 }).emitted);
  });

  it('bremsesprut kommer mykt når du trykker S, ikke alt på en gang', () => {
    const s = createSpray({ seed: 3, groundAt: () => 0 });
    const counts: number[] = [];
    for (let i = 0; i < 60; i++) {
      const before = s.emitted;
      s.update(frame({ brake: 1, z: i * 0.25 }));
      counts.push(s.emitted - before);
    }
    const first = counts.slice(0, 3).reduce((a, b) => a + b, 0);
    const late = counts.slice(50, 53).reduce((a, b) => a + b, 0);
    expect(first).toBeLessThan(late * 0.5);
  });

  it('landing gir en puff, og større jo hardere og raskere du lander', () => {
    expect(landingCount(0.3, 15)).toBe(0);
    expect(landingCount(4, 15)).toBeGreaterThan(landingCount(2, 15));
    expect(landingCount(3, 22)).toBeGreaterThan(landingCount(3, 10));
    expect(landingCount(100, 100)).toBe(CONFIG.sprayLandMax);

    const land = (vy: number) => {
      const s = createSpray({ seed: 2, groundAt: () => 0 });
      s.update(frame({ grounded: false, vy, airTime: 0.8, sinceLanding: 1 }));
      s.update(frame({ grounded: true, vy: 0, airTime: 0.8, sinceLanding: 0.004 }));
      return s.emitted;
    };
    expect(land(-2)).toBeGreaterThan(10);
    expect(land(-5)).toBeGreaterThan(land(-2));
  });

  it('små hopp over kuler gir ingen puff', () => {
    const s = createSpray({ seed: 2, groundAt: () => 0 });
    s.update(frame({ grounded: false, vy: -0.5, airTime: 0.05, sinceLanding: 1 }));
    s.update(frame({ grounded: true, airTime: 0.05, sinceLanding: 0.004 }));
    expect(s.emitted).toBe(0);
  });

  it('perfekt pop gir mer fokk enn vanlig pop', () => {
    const pop = (lastPop: SprayFrame['lastPop']) => {
      const s = createSpray({ seed: 2, groundAt: () => 0 });
      s.update(frame({ popAge: 5, lastPop }));
      s.update(frame({ popAge: 0.004, grounded: false, lastPop }));
      return s.emitted;
    };
    expect(pop('pop')).toBe(CONFIG.sprayPopCount);
    expect(pop('perfekt')).toBe(Math.round(CONFIG.sprayPopCount * CONFIG.sprayPopPerfect));
    expect(pop('perfekt')).toBeGreaterThan(pop('pop'));
  });

  it('pop gir litt fokk fra avsparket', () => {
    const s = createSpray({ seed: 2, groundAt: () => 0 });
    s.update(frame({ popAge: 5 }));
    s.update(frame({ popAge: 0.004, grounded: false }));
    expect(s.emitted).toBeGreaterThanOrEqual(CONFIG.sprayPopCount);
    expect(s.emitted).toBeLessThan(CONFIG.sprayPopCount * 2);
  });

  it('samme mengde sprut i 30 og 144 fps', () => {
    for (const over of [{ edge: 0.7 }, { brake: 1 }, { edge: -1, brake: 1 }]) {
      const a = run(3, 30, over).emitted;
      const b = run(3, 144, over).emitted;
      expect(Math.abs(a - b) / b).toBeLessThan(0.03);
    }
  });

  it('er lik hver gang med samme frø', () => {
    const a = run(1, 60, { edge: 0.8 }, 42);
    const b = run(1, 60, { edge: 0.8 }, 42);
    expect(a.count).toBe(b.count);
    expect(Array.from(a.positions.subarray(0, a.count * 3))).toEqual(Array.from(b.positions.subarray(0, b.count * 3)));
  });

  it('holder seg innenfor fast maks antall partikler', () => {
    const s = run(6, 60, { brake: 1, edge: 1 });
    expect(s.count).toBeLessThanOrEqual(CONFIG.sprayMax);
    expect(s.positions.length).toBe(CONFIG.sprayMax * 3);
  });
});

describe('snøsprut: hvordan den ser ut', () => {
  it('blekner bort og forsvinner etter en stund', () => {
    const s = createSpray({ seed: 5, groundAt: () => 0 });
    for (let i = 0; i < 30; i++) s.update(frame({ brake: 1, z: i * 0.25 }));
    expect(s.count).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) s.update(frame({ brake: 0, z: 10 + i * 0.25 }));
    expect(s.count).toBe(0);
  });

  it('nye partikler tones inn i stedet for å dukke opp brått', () => {
    const s = createSpray({ seed: 5, groundAt: () => 0 });
    s.update(frame({ edge: 1, dt: 1 / 144 }));
    s.update(frame({ edge: 1, dt: 1 / 144 }));
    expect(s.count).toBeGreaterThan(0);
    for (let i = 0; i < s.count; i++) expect(s.alphas[i]).toBeLessThan(CONFIG.sprayOpacity * 0.8);
  });

  it('carving kaster snøen ut på yttersiden av svingen', () => {
    // edge > 0 svinger mot -x (høyre), så snøen skal kastes mot +x
    for (const [edge, sign] of [[1, 1], [-1, -1]] as const) {
      const s = createSpray({ seed: 7, groundAt: () => 0 });
      for (let i = 0; i < 20; i++) s.update(frame({ edge, vx: 0, vz: 0.0001 + 15, z: 0 }));
      let sum = 0;
      for (let i = 0; i < s.count; i++) sum += s.positions[i * 3];
      expect(Math.sign(sum / s.count)).toBe(sign);
    }
  });

  it('snøen faller og blir liggende oppå snøen, løftet nok til at den ikke kuttes av bakken', () => {
    const s = createSpray({ seed: 9, groundAt: () => 0 });
    for (let i = 0; i < 20; i++) s.update(frame({ brake: 1, z: i * 0.25 }));
    for (let i = 0; i < 40; i++) {
      s.update(frame({ z: 5 + i * 0.25 }));
      for (let k = 0; k < s.count; k++) {
        expect(s.positions[k * 3 + 1]).toBeGreaterThanOrEqual(CONFIG.sprayGroundLift * s.sizes[k] - 1e-6);
      }
    }
  });

  it('partikler helt inntil kameraet tones bort, så de ikke dekker skjermen', () => {
    const s = createSpray({ seed: 4, groundAt: () => 0 });
    // kameraet står midt i landingspuffen
    s.update(frame({ grounded: false, vy: -5, vz: 0, airTime: 0.8, sinceLanding: 1, camY: 0.5 }));
    s.update(frame({ grounded: true, vz: 0, airTime: 0.8, sinceLanding: 0.004, camY: 0.5 }));
    for (let i = 0; i < 30; i++) s.update(frame({ z: i * 0.01, vz: 0, camY: 0.5, camZ: i * 0.01 }));
    let near = 0;
    for (let i = 0; i < s.count; i++) {
      const d = Math.hypot(s.positions[i * 3], s.positions[i * 3 + 1] - 0.5, s.positions[i * 3 + 2] - 0.29);
      if (d < CONFIG.sprayNearFade[0]) { near++; expect(s.alphas[i]).toBe(0); }
    }
    expect(near).toBeGreaterThan(0);
  });

  it('ingen partikler blir lagt igjen der du startet etter en restart', () => {
    const s = createSpray({ seed: 9, groundAt: () => 0 });
    s.update(frame({ edge: 1, z: 300 }));
    s.update(frame({ edge: 1, z: 5 }));
    for (let i = 0; i < s.count; i++) {
      const z = s.positions[i * 3 + 2];
      expect(z < 20 || z > 280).toBe(true);
    }
  });
});
