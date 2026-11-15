import { AUDIO } from './config';
import { normalAt } from '../park/terrain';
import type { SkierState } from '../physics/skier';

/**
 * Ren lydlogikk: hvor sterk og hvor lys hver lyd skal være.
 * Ingen Web Audio og ingen three.js her, så alt kan testes.
 */

export interface SoundInput {
  /** m/s */
  speed: number;
  grounded: boolean;
  /** kanten, -1 til 1 */
  edge: number;
  /** brems, 0–1 */
  brake: number;
  /** hvor mye skiene glir sidelengs, 0–1 */
  skid: number;
  /** skiene glir på en rail eller boks: ingen snø-sus eller carve, men en lys skrape-lyd (og vind som på bakken) */
  rail?: boolean;
}

export interface SoundLevels {
  wind: number; windTone: number;
  snow: number; snowTone: number;
  carve: number; carveTone: number;
  scrape: number; scrapeTone: number;
}

/** Holder et tall mellom 0 og 1. Ugyldige tall (NaN) blir 0, så lyden aldri går amok. */
export function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : v === Infinity ? 1 : 0;
}

/** 0 under a, 1 over b, rett linje mellom. */
function ramp(v: number, a: number, b: number): number {
  return clamp01((v - a) / (b - a));
}

/** Myk overgang 0–1 (ingen knekk i starten og slutten). */
function smooth(v: number): number {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

export function soundLevels(i: SoundInput): SoundLevels {
  const speed = Number.isFinite(i.speed) ? Math.max(0, i.speed) : 0;
  const ground = i.grounded ? 1 : 0;

  // vind: mer og lysere jo fortere du kjører
  const w = Math.pow(ramp(speed, AUDIO.windMinSpeed, AUDIO.windFullSpeed), AUDIO.windCurve);
  const wind = clamp01((AUDIO.windFloor + (1 - AUDIO.windFloor) * w) * (i.grounded ? 1 : AUDIO.windAirBoost));
  const windTone = clamp01(ramp(speed, 0, AUDIO.windFullSpeed));

  // jevnt sus under skiene, bare på bakken
  const fadeIn = smooth(ramp(speed, 0, AUDIO.fadeInSpeed));
  const s = Math.pow(ramp(speed, 0, AUDIO.snowFullSpeed), AUDIO.snowCurve) * fadeIn;
  const snow = clamp01(s * ground);
  const snowTone = clamp01(ramp(speed, 0, AUDIO.snowFullSpeed));

  // carve-hvisl: hard kant i fart
  const edge = smooth(ramp(Math.abs(i.edge), AUDIO.carveEdgeStart, 1));
  const carve = clamp01(edge * smooth(ramp(speed, 1, AUDIO.carveFullSpeed)) * ground);
  const carveTone = clamp01(0.3 * edge + 0.7 * ramp(speed, 0, AUDIO.carveFullSpeed));

  // skrape: brems eller skrens, sterkere i fart; stille når du står
  const rough = Math.max(clamp01(i.brake), AUDIO.scrapeSkidShare * clamp01(i.skid));
  const scrape = clamp01(rough * Math.pow(ramp(speed, 0, AUDIO.scrapeFullSpeed), AUDIO.scrapeCurve) * fadeIn * ground);
  const scrapeTone = clamp01(ramp(speed, 0, AUDIO.scrapeFullSpeed));

  if (i.rail) {
    // på railen: ikke snø under skiene, men metall/plast som skraper, lysere jo fortere
    const r = clamp01(AUDIO.railScrape * Math.pow(ramp(speed, 0, AUDIO.scrapeFullSpeed), AUDIO.scrapeCurve) * fadeIn);
    return { wind, windTone, snow: 0, snowTone, carve: 0, carveTone, scrape: r, scrapeTone: clamp01(AUDIO.railScrapeTone + (1 - AUDIO.railScrapeTone) * scrapeTone) };
  }
  return { wind, windTone, snow, snowTone, carve, carveTone, scrape, scrapeTone };
}

/** Hvor mye skiene glir sidelengs (0 = rett fram, 1 = helt på tvers). */
export function skidAmount(s: Pick<SkierState, 'vx' | 'vz' | 'heading'>): number {
  const v = Math.hypot(s.vx, s.vz);
  if (!(v > 1)) return 0;
  const side = Math.abs(Math.cos(s.heading) * s.vx - Math.sin(s.heading) * s.vz) / v;
  return clamp01(side);
}

/**
 * Landing: hvor kraftig dumpet er (0–1).
 * Bygger mest på lufttiden (s), så et stort hopp lander med tyngde selv når landingen er myk,
 * og litt på støtet (farten rett inn i bakken, m/s).
 */
export function landingLevel(airTime: number, impact: number): number {
  const air = Number.isFinite(airTime) ? Math.max(0, airTime) : 0;
  const hit = Number.isFinite(impact) ? Math.max(0, impact) : 0;
  const level = AUDIO.landFloor
    + AUDIO.landAirShare * ramp(air, AUDIO.landAirStart, AUDIO.landAirFull)
    + AUDIO.landImpactShare * smooth(ramp(hit, AUDIO.landMinImpact, AUDIO.landFullImpact));
  // bittesmå luftturer (kuler i bakken) er nesten stille, ellers dunker det hele tiden
  const bump = smooth(ramp(air, 0, AUDIO.landBumpAir));
  return clamp01(level * bump);
}

/** Pop: hvor sterk avspark-lyden er (0–1), ut fra lading og om den var perfekt. */
export function popLevel(charge: number, perfect: boolean): number {
  const base = AUDIO.popMin + (1 - AUDIO.popMin) * clamp01(charge);
  return clamp01(base * (perfect ? AUDIO.popPerfectBoost : 1));
}

export interface SoundEvents {
  /** styrke på pop-lyden, eller null hvis ingen pop dette steget */
  pop: number | null;
  /** styrke på landingen, eller null hvis ingen landing dette steget */
  landing: number | null;
}

/** Ser på forrige og nåværende fysikksteg og finner ut om det var en pop eller en landing. */
export function detectEvents(prev: SkierState, cur: SkierState): SoundEvents {
  let pop: number | null = null;
  let landing: number | null = null;
  // pop: avsparket nullstiller popAge, så den blir mindre enn før
  if (cur.popAge < prev.popAge && cur.lastPop !== '') pop = popLevel(prev.popCharge, cur.lastPop === 'perfekt');
  // landing: var i lufta, er nå på bakken; farten rett inn i bakken (fra før landingen) bestemmer hvor hardt
  if (!prev.grounded && cur.grounded) {
    const [nx, ny, nz] = normalAt(cur.x, cur.z);
    const impact = -(prev.vx * nx + prev.vy * ny + prev.vz * nz);
    landing = landingLevel(prev.airTime, impact);
  }
  return { pop, landing };
}

/**
 * Har verdien endret seg nok til at det er verdt å sende den til lyden?
 * step = minste endring; relative = true betyr andel av verdien (for frekvenser).
 */
export function changedEnough(last: number | undefined, next: number, step: number, relative = false): boolean {
  if (last === undefined || !Number.isFinite(last)) return true;
  const limit = relative ? step * Math.max(Math.abs(last), 1e-6) : step;
  return Math.abs(next - last) > limit;
}
