import { CONFIG } from '../core/config';

/**
 * Terrenget er en høydefunksjon h(x, z). Bakken går nedover i +z.
 * Fase 0: en grå testbakke med jevn helning og svake bølger.
 * Arbeidsstrøm 5 (Park og verktøy) eier denne fila.
 */
const slope = Math.tan((CONFIG.slopeDeg * Math.PI) / 180);

export const PARK = {
  width: 80,
  length: 600,
};

export function heightAt(x: number, z: number): number {
  const base = -z * slope;
  const waves = 0.35 * Math.sin(z * 0.05) * Math.cos(x * 0.08);
  // svak "bolle" mot kantene så man ikke sklir ut av bakken
  const edge = Math.max(0, Math.abs(x) - PARK.width * 0.4);
  return base + waves + 0.02 * edge * edge;
}

/** Normalvektor (enhetslengde) via endelige differanser. */
export function normalAt(x: number, z: number): [number, number, number] {
  const e = 0.05;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  const nx = -dx, ny = 1, nz = -dz;
  const len = Math.hypot(nx, ny, nz);
  return [nx / len, ny / len, nz / len];
}
