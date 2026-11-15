import { CONFIG } from '../core/config';
import { lipHeight, rampLength, type Kicker, type ParkData } from './format';
import { CURRENT_PARK } from './parks';

/**
 * Terrenget er en høydefunksjon h(x, z). Bakken går nedover i +z.
 * Alle tallene for bakken (bredde, lengde, bølger, hopp og landinger) står i en JSON-fil
 * i src/park/parks/. Her er bare formlene som gjør tallene om til en bakke.
 * Arbeidsstrøm 5 (Park og verktøy) eier denne fila.
 */
export { lipHeight, rampLength, type Kicker, type ParkData };

const DEG = Math.PI / 180;
const slope = Math.tan(CONFIG.slopeDeg * DEG);

function smoothstep(a: number, b: number, t: number): number {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

export interface Terrain {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number): [number, number, number];
}

/** Lager høyde- og normalfunksjonene for en park. */
export function createTerrain(park: ParkData): Terrain {
  const { deck: DECK, landing: LANDING, waves, edge: bowl } = park;

  /**
   * Hvor mye lavere enn vanlig bakken ligger u meter etter kanten, på grunn av landingen.
   * Helningen bygges opp og ned med myke cosinus-overganger, så det aldri blir knekk.
   */
  function landingDepth(k: Kicker, u: number): number {
    const m = Math.tan((CONFIG.slopeDeg + k.landingDeg) * DEG) - slope;
    const { knuckle: a, steep: b, runout: c } = LANDING;
    let t = u - k.landingStart;
    if (t <= 0) return 0;
    // kanten inn: helningen øker mykt fra 0 til m
    if (t < a) return m * (t / 2 - (a / (2 * Math.PI)) * Math.sin((Math.PI * t) / a));
    let d = (m * a) / 2;
    t -= a;
    // den bratte delen
    if (t < b) return d + m * t;
    d += m * b;
    t -= b;
    // utkjøringen: helningen minker mykt fra m til 0
    if (t < c) return d + m * (t / 2 + (c / (2 * Math.PI)) * Math.sin((Math.PI * t) / c));
    return d + (m * c) / 2;
  }

  /** Hvor mye hoppene hever (rampe) eller senker (landing) bakken i punktet (x, z). */
  function kickerOffset(x: number, z: number): number {
    let sum = 0;
    for (const k of park.kickers) {
      const u = z - k.z;
      const half = k.width / 2;
      // full høyde på midten, myk overgang ut mot sidene
      const across = 1 - smoothstep(half, half + 3, Math.abs(x));

      const lr = rampLength(k), h = lipHeight(k);
      const deck = h * DECK.height, lb = DECK.drop;
      let along = 0;
      if (u >= -lr && u <= 0) along = h * ((u + lr) / lr) ** 2; // rampen opp mot kanten
      else if (u > 0 && u <= lb) along = deck + (h - deck) * (1 - u / lb) ** 2; // liten kant ned til platået
      else if (u > lb) {
        // platået (table) i høyde med kanten, som går over i landingen
        const f0 = k.landingStart, f1 = k.landingStart + LANDING.knuckle + LANDING.steep;
        along = deck * (1 - smoothstep(f0, f1, u));
      }
      sum += along * across;

      // landingen: bakken blir brattere og ligger lavere etter landingen, over hele bredden
      sum -= landingDepth(k, u);
    }
    return sum;
  }

  function heightAt(x: number, z: number): number {
    const base = -z * slope;
    const wave = waves.height * Math.sin(z * waves.along) * Math.cos(x * waves.across);
    // svak "bolle" mot kantene så man ikke sklir ut av bakken
    const e = Math.max(0, Math.abs(x) - park.width * bowl.start);
    return base + wave + bowl.strength * e * e + kickerOffset(x, z);
  }

  /** Normalvektor (enhetslengde) via endelige differanser. */
  function normalAt(x: number, z: number): [number, number, number] {
    const e = 0.05;
    const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    const nx = -dx, ny = 1, nz = -dz;
    const len = Math.hypot(nx, ny, nz);
    return [nx / len, ny / len, nz / len];
  }

  return { heightAt, normalAt };
}

/** Parken som kjøres nå (fra JSON-fila). */
export const PARK = CURRENT_PARK;
/** Platået etter kanten (fra parkfila). */
export const DECK = PARK.deck;
/** Landingens deler (fra parkfila). */
export const LANDING = PARK.landing;

const current = createTerrain(PARK);
export const heightAt = current.heightAt;
export const normalAt = current.normalAt;
