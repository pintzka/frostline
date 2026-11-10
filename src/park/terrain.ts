import { CONFIG } from '../core/config';

/**
 * Terrenget er en høydefunksjon h(x, z). Bakken går nedover i +z.
 * En grå testbakke med jevn helning, svake bølger og tre hopp (kickere).
 * Arbeidsstrøm 5 (Park og verktøy) eier denne fila.
 */
const slope = Math.tan((CONFIG.slopeDeg * Math.PI) / 180);

/**
 * Et hopp: en rampe som bøyer seg opp til en kant (lip), og en kort bakside ned igjen.
 * Kanten står i en vinkel mot bakken, og den vinkelen bestemmer mest hvor høyt og langt du flyr.
 */
export interface Kicker {
  name: string;
  /** Hvor kanten står (m nedover bakken). */
  z: number;
  /** Kantens vinkel mot bakken (grader). */
  lipDeg: number;
  /** Hvor høyt kanten står over bakken (m). */
  height: number;
  /** Bredden på hoppet (m). */
  width: number;
}

export const PARK = {
  width: 80,
  length: 600,
  kickers: [
    { name: 'Lite', z: 160, lipDeg: 13, height: 0.7, width: 9 },
    { name: 'Medium', z: 290, lipDeg: 20, height: 1.5, width: 10 },
    { name: 'Stort', z: 430, lipDeg: 26, height: 2.8, width: 12 },
  ] as Kicker[],
};

/** Hvor lang rampen er for at den skal ende i riktig vinkel (parabel: helning = 2·høyde/lengde). */
export function rampLength(k: Kicker): number {
  return (2 * k.height) / Math.tan((k.lipDeg * Math.PI) / 180);
}

/** Baksiden er bratt og kort, så du flyr over den. */
function backLength(k: Kicker): number {
  return 3 * k.height;
}

function smoothstep(a: number, b: number, t: number): number {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Hvor mye hoppene hever bakken i punktet (x, z). */
function kickerOffset(x: number, z: number): number {
  let sum = 0;
  for (const k of PARK.kickers) {
    const u = z - k.z;
    const lr = rampLength(k), lb = backLength(k);
    if (u < -lr || u > lb) continue;
    const along = u <= 0 ? k.height * ((u + lr) / lr) ** 2 : k.height * (1 - u / lb) ** 2;
    // full høyde på midten, myk overgang ut mot sidene
    const half = k.width / 2;
    const across = 1 - smoothstep(half, half + 2, Math.abs(x));
    sum += along * across;
  }
  return sum;
}

export function heightAt(x: number, z: number): number {
  const base = -z * slope;
  const waves = 0.35 * Math.sin(z * 0.05) * Math.cos(x * 0.08);
  // svak "bolle" mot kantene så man ikke sklir ut av bakken
  const edge = Math.max(0, Math.abs(x) - PARK.width * 0.4);
  return base + waves + 0.02 * edge * edge + kickerOffset(x, z);
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
