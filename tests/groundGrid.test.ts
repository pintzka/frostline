import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { heightAt, LANDING, PARK, rampLength } from '../src/park/terrain';
import { buildGroundMesh, FINE, groundRows, type GroundMesh } from '../src/render/groundGrid';
import { GROUND_HALF, WORLD } from '../src/render/sceneryLayout';

const MAX_GAP = 0.03;

/**
 * Største forskjell mellom det meshen viser (rett linje mellom punktene i hver trekant)
 * og fysikkbakken, prøvd på 15 punkter i hver trekant.
 */
function worstGap(mesh: GroundMesh, keep: (x: number, z: number) => boolean = () => true): number {
  const p = mesh.positions, ix = mesh.indices;
  let worst = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    if (!keep((p[a] + p[b] + p[c]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3)) continue;
    for (let i = 0; i <= 4; i++) for (let j = 0; i + j <= 4; j++) {
      const u = i / 4, v = j / 4, w = 1 - u - v;
      const x = u * p[a] + v * p[b] + w * p[c];
      const y = u * p[a + 1] + v * p[b + 1] + w * p[c + 1];
      const z = u * p[a + 2] + v * p[b + 2] + w * p[c + 2];
      worst = Math.max(worst, Math.abs(y - heightAt(x, z)));
    }
  }
  return worst;
}

const mesh = buildGroundMesh();
const zs = groundRows();

describe('den synlige bakken stemmer med fysikkbakken', () => {
  it('under 3 cm forskjell overalt i løypa og rundt hoppene', () => {
    expect(worstGap(mesh)).toBeLessThan(MAX_GAP);
  });

  it('har en rad punkter akkurat på hver hoppkant (der rampen knekker)', () => {
    for (const k of PARK.kickers) expect(zs).toContain(k.z);
  });

  it('den tette sonen følger hoppene: et mye bredere hopp stemmer også', () => {
    const k = PARK.kickers[2];
    const old = k.width;
    k.width = 34;
    try {
      const wide = buildGroundMesh();
      const near = (x: number, z: number) => Math.abs(x) < k.width / 2 + 8 && z > k.z - rampLength(k) - 3 && z < k.z + 60;
      expect(worstGap(wide, near)).toBeLessThan(MAX_GAP);
    } finally {
      k.width = old;
    }
  });

  it('er glissen der bakken er rett: få trekanter langt fra hoppene', () => {
    const p = mesh.positions, ix = mesh.indices;
    let calm = 0;
    for (let t = 0; t < ix.length; t += 3) {
      const z = p[ix[t] * 3 + 2];
      if (z > 20 && z < 120) calm++;
    }
    // 100 m bakke uten hopp: bare noen tusen trekanter
    expect(calm).toBeLessThan(15000);
  });

  it('dekker hele bredden og går forbi restart og slutten av utkjøringen', () => {
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      minX = Math.min(minX, mesh.positions[i]); maxX = Math.max(maxX, mesh.positions[i]);
    }
    expect(minX).toBe(-GROUND_HALF);
    expect(maxX).toBe(GROUND_HALF);
    expect(zs[0]).toBe(FINE.zMin);
    expect(zs[zs.length - 1]).toBe(FINE.zMax);
    const restart = PARK.length - CONFIG.runEndMargin;
    const runoutEnd = Math.max(...PARK.kickers.map((k) => k.z + k.landingStart + LANDING.knuckle + LANDING.steep + LANDING.runout));
    expect(FINE.zMax).toBeGreaterThanOrEqual(restart + 20);
    expect(FINE.zMax).toBeGreaterThanOrEqual(runoutEnd + 10);
    // terrenget rundt går mye lenger enn tåka (280 m), så kanten av verden syns aldri
    expect(WORLD.zMax - restart).toBeGreaterThan(300);
  });

  it('holder antall trekanter nede (god ytelse)', () => {
    expect(mesh.indices.length / 3).toBeLessThan(200000);
  });
});
