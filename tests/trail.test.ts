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
    expect(pts[pts.length - 1].z).toBeCloseTo((n - 1) * CONFIG.trailSpacing * 1.01, 6);
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

  it('starter et nytt spor ved restart i stedet for å tegne en strek over bakken', () => {
    const t = createTrail();
    for (let i = 0; i < 20; i++) t.update(0, 0, i, 0);
    t.update(0, 0, 500, 0);
    expect(t.points().length).toBe(1);
  });
});
