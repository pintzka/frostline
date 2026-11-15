import { describe, expect, it } from 'vitest';
import { heightAt, PARK } from '../src/park/terrain';
import {
  GROUND_HALF, groundAt, MIN_TREE_GAP, planMarkers, planTrees, ridgeProfile, TREE_MIN_X, trunkRadius, WORLD,
} from '../src/render/sceneryLayout';

const trees = planTrees();

describe('terrenget rundt bakken', () => {
  it('er akkurat bakken der bakken finnes', () => {
    for (const [x, z] of [[0, 0], [30, 160], [-GROUND_HALF, 300], [GROUND_HALF, 500]]) {
      expect(groundAt(x, z)).toBe(heightAt(x, z));
    }
  });
  it('har ingen kant der den preparerte bakken slutter', () => {
    for (const z of [0, 165, 300, 450]) for (const s of [-1, 1]) {
      const inside = groundAt(s * (GROUND_HALF - 0.01), z), outside = groundAt(s * (GROUND_HALF + 0.01), z);
      expect(Math.abs(inside - outside)).toBeLessThan(0.05);
    }
  });
  it('stiger mot sidene, så det blir en dal med lier', () => {
    expect(groundAt(150, 300)).toBeGreaterThan(groundAt(GROUND_HALF, 300) + 20);
  });
  it('har ingen knekk der den preparerte bakken slutter', () => {
    for (const z of [0, 100, 250, 470]) {
      const e = 0.05, x = GROUND_HALF;
      const inside = (groundAt(x, z) - groundAt(x - e, z)) / e, outside = (groundAt(x + e, z) - groundAt(x, z)) / e;
      expect(Math.abs(inside - outside)).toBeLessThan(0.05);
    }
  });
  it('faller ned bak ryggen, så kanten av verden ligger lavt og skjult', () => {
    for (const z of [0, 300, 600]) expect(groundAt(WORLD.halfWidth, z)).toBeLessThan(groundAt(0, z));
  });
});

describe('trær', () => {
  it('står på samme sted hver gang', () => {
    expect(planTrees()).toEqual(trees);
  });
  it('et annet frø gir en annen skog', () => {
    expect(planTrees(7)[0]).not.toEqual(trees[0]);
  });
  it('har et fornuftig antall', () => {
    expect(trees.length).toBeGreaterThan(1500);
    expect(trees.length).toBeLessThan(6000);
  });
  it('står aldri i løypa', () => {
    for (const t of trees) expect(Math.abs(t.x)).toBeGreaterThanOrEqual(TREE_MIN_X);
    expect(TREE_MIN_X).toBeGreaterThan(PARK.width / 2 + 5);
  });
  it('står aldri på eller ved hoppene', () => {
    for (const t of trees) for (const k of PARK.kickers) {
      const onKicker = Math.abs(t.x) < k.width / 2 + 15 && t.z > k.z - 80 && t.z < k.z + 170;
      expect(onKicker).toBe(false);
    }
  });
  it('står på bakken: foten er i snøen, aldri i lufta, og ikke begravd', () => {
    for (const t of trees) {
      const r = trunkRadius(t);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const g = groundAt(t.x + Math.cos(ang) * r, t.z + Math.sin(ang) * r);
        expect(t.y).toBeLessThan(g);
      }
      expect(t.y).toBeGreaterThan(groundAt(t.x, t.z) - 3);
    }
  });
  it('finnes på begge sider, langs hele bakken', () => {
    for (const side of [-1, 1]) for (let z = 0; z < PARK.length; z += 50) {
      const near = trees.filter((t) => Math.sign(t.x) === side && t.z >= z && t.z < z + 50 && Math.abs(t.x) < 80);
      expect(near.length).toBeGreaterThan(5);
    }
  });
  it('står ikke oppå hverandre, og holder seg inne i verden', () => {
    for (const t of trees) {
      expect(Math.abs(t.x)).toBeLessThan(WORLD.halfWidth);
      expect(t.z).toBeGreaterThan(WORLD.zMin);
      expect(t.z).toBeLessThan(WORLD.zMax);
    }
    const sorted = [...trees].sort((a, b) => a.z - b.z);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].z - sorted[i].z < MIN_TREE_GAP; j++) {
        expect(Math.hypot(sorted[i].x - sorted[j].x, sorted[i].z - sorted[j].z)).toBeGreaterThanOrEqual(MIN_TREE_GAP);
      }
    }
  });
  it('står i grupper, ikke i et jevnt rutenett', () => {
    // telle trær i ruter på 20 x 20 m nær løypa: noen ruter er tette, andre nesten tomme
    const counts: number[] = [];
    for (let z = 0; z < PARK.length; z += 20) {
      counts.push(trees.filter((t) => t.x > TREE_MIN_X && t.x < TREE_MIN_X + 20 && t.z >= z && t.z < z + 20).length);
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThan(6);
  });
});

describe('hoppmerker', () => {
  it('to per hopp, ved siden av hoppet og på bakken', () => {
    const m = planMarkers();
    expect(m.length).toBe(PARK.kickers.length * 2);
    PARK.kickers.forEach((k, i) => {
      for (const p of m.slice(i * 2, i * 2 + 2)) {
        expect(Math.abs(p.x)).toBeGreaterThan(k.width / 2 + 3);
        expect(Math.abs(p.z - k.z)).toBeLessThan(5);
        expect(p.y).toBeLessThan(groundAt(p.x, p.z));
        expect(p.y).toBeGreaterThan(groundAt(p.x, p.z) - 1);
      }
    });
  });
});

describe('fjellrygger', () => {
  it('ligger mellom laveste og høyeste vinkel, og er like hver gang', () => {
    const r = ridgeProfile(3, 256, 2, 9);
    expect(r.length).toBe(256);
    for (const v of r) { expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThanOrEqual(9); }
    expect(ridgeProfile(3, 256, 2, 9)).toEqual(r);
    expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(3);
  });
});
