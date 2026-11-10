import { CONFIG } from '../core/config';

/**
 * Terrenget er en høydefunksjon h(x, z). Bakken går nedover i +z.
 * En grå testbakke med jevn helning, svake bølger og tre hopp (kickere) med landinger.
 * Arbeidsstrøm 5 (Park og verktøy) eier denne fila.
 */
const DEG = Math.PI / 180;
const slope = Math.tan(CONFIG.slopeDeg * DEG);

/**
 * Et hopp: en rampe som bøyer seg mykt opp til en kant (lip), en kort bakside,
 * og lenger ned en landing der bakken blir brattere, så du lander langs bakken i stedet for rett inn i den.
 */
export interface Kicker {
  name: string;
  /** Hvor kanten står (m nedover bakken). */
  z: number;
  /** Kantens vinkel mot bakken (grader). Bestemmer mest hvor høyt og langt du flyr. */
  lipDeg: number;
  /** Rampens krumning (m). Større = lengre og mykere rampe, mindre spark oppover. */
  radius: number;
  /** Bredden på hoppet (m). */
  width: number;
  /** Hvor landingen begynner å bli brattere, målt fra kanten (m). */
  landingStart: number;
  /** Hvor mye brattere enn bakken den bratte delen av landingen er (grader). */
  landingDeg: number;
}

/** Platået etter kanten: høyde i forhold til kanten, og hvor kort kanten ned til platået er (m). */
export const DECK = { height: 0.85, drop: 1 };

/** Landingens deler (m): kort kant inn, bratt del der du lander, og lang myk utkjøring. */
export const LANDING = { knuckle: 6, steep: 32, runout: 75 };

export const PARK = {
  width: 80,
  length: 600,
  kickers: [
    // tallene er funnet ved å teste mange kombinasjoner i en hel kjøring fra start:
    // myk rampe og utkjøring (maks 2,1 g), landing under 10° (også 5 % saktere og 3 % raskere),
    // og under 11° med perfekt pop
    { name: 'Lite', z: 160, lipDeg: 12, radius: 50, width: 9, landingStart: 19, landingDeg: 9 },
    { name: 'Medium', z: 290, lipDeg: 21, radius: 65, width: 10, landingStart: 37, landingDeg: 15 },
    { name: 'Stort', z: 430, lipDeg: 25, radius: 75, width: 12, landingStart: 40, landingDeg: 18 },
  ] as Kicker[],
};

/** Rampens lengde: en parabel med gitt krumning ender i riktig vinkel når lengde = radius · tan(vinkel). */
export function rampLength(k: Kicker): number {
  return k.radius * Math.tan(k.lipDeg * DEG);
}

/** Hvor høyt kanten står over bakken (m). */
export function lipHeight(k: Kicker): number {
  return (rampLength(k) * Math.tan(k.lipDeg * DEG)) / 2;
}

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

function smoothstep(a: number, b: number, t: number): number {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Hvor mye hoppene hever (rampe) eller senker (landing) bakken i punktet (x, z). */
function kickerOffset(x: number, z: number): number {
  let sum = 0;
  for (const k of PARK.kickers) {
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
