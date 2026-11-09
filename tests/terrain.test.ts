import { describe, expect, it } from 'vitest';
import { heightAt, normalAt } from '../src/park/terrain';

describe('terreng', () => {
  it('går nedover i +z', () => {
    expect(heightAt(0, 100)).toBeLessThan(heightAt(0, 0));
  });
  it('normalen har lengde 1 og peker oppover', () => {
    for (const [x, z] of [[0, 0], [10, 50], [-30, 200]]) {
      const [nx, ny, nz] = normalAt(x, z);
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6);
      expect(ny).toBeGreaterThan(0.8);
    }
  });
});
