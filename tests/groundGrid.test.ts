import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { heightAt, LANDING, PARK, rampLength } from '../src/park/terrain';
import { FINE, groundColumns, groundRows, gridIndex, meshHeight } from '../src/render/groundGrid';
import { GROUND_HALF, makeRandom, WORLD } from '../src/render/sceneryLayout';

const xs = groundColumns();
const zs = groundRows();
const shown = (x: number, z: number) => meshHeight(xs, zs, heightAt, x, z);
const MAX_GAP = 0.03;

describe('den synlige bakken stemmer med fysikkbakken', () => {
  it('rundt hvert hopp: under 3 cm forskjell, også på sidene av platået', () => {
    for (const k of PARK.kickers) {
      let worst = 0;
      const z0 = k.z - rampLength(k) - 2, z1 = k.z + k.landingStart + LANDING.knuckle + 4;
      for (let z = z0; z <= z1; z += 0.13) for (let x = -(k.width / 2 + 6); x <= k.width / 2 + 6; x += 0.07) {
        worst = Math.max(worst, Math.abs(shown(x, z) - heightAt(x, z)));
      }
      expect(worst, `${k.name}: ${worst.toFixed(3)} m`).toBeLessThan(MAX_GAP);
    }
  });

  it('i hele løypa: under 3 cm forskjell', () => {
    const rnd = makeRandom(5);
    let worst = 0;
    for (let i = 0; i < 60000; i++) {
      const x = (rnd() * 2 - 1) * PARK.width / 2, z = FINE.zMin + rnd() * (FINE.zMax - FINE.zMin);
      worst = Math.max(worst, Math.abs(shown(x, z) - heightAt(x, z)));
    }
    expect(worst).toBeLessThan(MAX_GAP);
  });

  it('har en rad punkter akkurat på hver hoppkant (der rampen knekker)', () => {
    for (const k of PARK.kickers) expect(zs).toContain(k.z);
  });

  it('dekker hele bredden og går forbi restart og slutten av utkjøringen', () => {
    expect(xs[0]).toBe(-GROUND_HALF);
    expect(xs[xs.length - 1]).toBe(GROUND_HALF);
    const restart = PARK.length - CONFIG.runEndMargin;
    const runoutEnd = Math.max(...PARK.kickers.map((k) => k.z + k.landingStart + LANDING.knuckle + LANDING.steep + LANDING.runout));
    expect(FINE.zMax).toBeGreaterThanOrEqual(restart + 20);
    expect(FINE.zMax).toBeGreaterThanOrEqual(runoutEnd + 10);
    // terrenget rundt går mye lenger enn tåka (280 m), så kanten av verden syns aldri
    expect(WORLD.zMax - restart).toBeGreaterThan(300);
  });

  it('holder antall trekanter nede (god ytelse)', () => {
    const tris = gridIndex(xs.length, zs.length).length / 3;
    expect(tris).toBeLessThan(300000);
  });
});
