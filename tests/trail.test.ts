import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createTrail } from '../src/render/trail';

describe('skispor', () => {
  it('legger et nytt punkt bare når skiløperen har kjørt langt nok', () => {
    const t = createTrail();
    expect(t.update(0, 0, 0, 0)).toBe(true);
    expect(t.update(0, 0, CONFIG.trailSpacing * 0.5, 0)).toBe(false);
    expect(t.update(0, 0, CONFIG.trailSpacing * 1.01, 0)).toBe(true);
    expect(t.points().length).toBe(2);
  });

  it('holder et fast antall punkter og glemmer de eldste først', () => {
    const t = createTrail();
    const n = CONFIG.trailMaxPoints + 50;
    for (let i = 0; i < n; i++) t.update(0, 0, i * CONFIG.trailSpacing * 1.01, 0);
    const pts = t.points();
    expect(pts.length).toBe(CONFIG.trailMaxPoints);
    expect(pts[pts.length - 1].z).toBeCloseTo((n - 1) * CONFIG.trailSpacing * 1.01 - CONFIG.skiLength / 2, 6);
    for (let i = 1; i < pts.length; i++) expect(pts[i].z).toBeGreaterThan(pts[i - 1].z);
  });

  it('lagrer en sidevektor vinkelrett på skiene, så sporene får riktig avstand', () => {
    const t = createTrail();
    for (const heading of [0, 0.7, -1.2, Math.PI]) {
      t.update(heading * 100, 0, 0, heading);
      const p = t.points()[t.points().length - 1];
      expect(Math.hypot(p.rx, p.rz)).toBeCloseTo(1, 6);
      expect(p.rx * Math.sin(heading) + p.rz * Math.cos(heading)).toBeCloseTo(0, 6);
    }
  });

  it('legger sporet ved bakenden av skiene, ikke midt under skiløperen', () => {
    for (const heading of [0, 0.6, -1.1]) {
      const t = createTrail();
      t.update(3, 0, 10, heading);
      const back = CONFIG.skiLength / 2;
      const p = t.points()[0];
      expect(p.x).toBeCloseTo(3 - Math.sin(heading) * back, 6);
      expect(p.z).toBeCloseTo(10 - Math.cos(heading) * back, 6);
      // spissen følger bakenden hvert bilde, også mellom de lagrede punktene
      t.update(3, 0, 10.1, heading);
      expect(t.tip().z).toBeCloseTo(10.1 - Math.cos(heading) * back, 6);
    }
  });

  it('stopper i lufta og fortsetter der skiløperen lander, uten å slette sporet', () => {
    const t = createTrail();
    for (let i = 0; i < 20; i++) t.update(0, 0, i, 0, true);
    // flyr 40 m, oppdatert hvert bilde
    for (let z = 20; z < 60; z += 0.4) expect(t.update(0, 0, z, 0, false)).toBe(false);
    t.update(0, 0, 60, 0, true);
    const pts = t.points();
    expect(pts.length).toBe(21);
    expect(pts[20].start).toBe(true);
    expect(pts.slice(0, 20).some((p) => p.start)).toBe(false);
  });

  it('starter et nytt spor ved restart i stedet for å tegne en strek over bakken', () => {
    const t = createTrail();
    for (let i = 0; i < 20; i++) t.update(0, 0, i, 0);
    t.update(0, 0, 500, 0);
    expect(t.points().length).toBe(1);
  });
});
