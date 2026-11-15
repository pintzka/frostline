import { CONFIG } from '../core/config';
import { heightAt, normalAt, PARK, rampLength } from '../park/terrain';
import { placeSkier, type SkierState } from '../physics/skier';
import type { TrickState } from './rotation';

/**
 * Hva som skjer etter landingen. Ren logikk uten three.js, så den kan testes.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila.
 *
 * Ren landing: ingenting. Slurvete: du mister litt fart og kroppen vakler et øyeblikk.
 * Fall: kroppen velter, du sklir og bremser opp i snøen, skjermen blekner, og du settes
 * tilbake et stykke før hoppet du falt på. Mens du faller virker ingen taster.
 */
export interface FallState {
  /** Sekunder siden fallet startet. 99 = ikke noe fall nå. */
  time: number;
  /** Hvilken side kroppen velter mot (1 = høyre, -1 = venstre). */
  side: number;
  /** Hvor du settes tilbake. */
  respawnX: number;
  respawnZ: number;
  /** Sant når du allerede er satt tilbake i dette fallet. */
  respawned: boolean;
  /** Sekunder siden siste slurvete landing. 99 = lenge siden. */
  sloppyAge: number;
}

const TURN = 2 * Math.PI;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** Myk overgang 0 → 1, flat i begge ender, så ingenting starter eller stopper brått. */
const ease = (t: number) => { const u = clamp01(t); return u * u * (3 - 2 * u); };

export function createFall(): FallState {
  return { time: 99, side: 1, respawnX: 0, respawnZ: 5, respawned: true, sloppyAge: 99 };
}

/** Ligger du i snøen nå (ingen styring, pop eller triks)? */
export function isFalling(f: FallState): boolean {
  return f.time < CONFIG.fallRespawnAt;
}

/** Hele fallet, med blekingen inn igjen etter at du er satt tilbake. */
export function fallTotalTime(): number {
  return CONFIG.fallRespawnAt + CONFIG.fallFadeTime;
}

/**
 * Hvor du settes tilbake: et stykke før rampen på det siste hoppet du passerte, midt i hoppet.
 * Langt nok bak til at du rekker å få opp farten før kanten. Har du ikke passert noe hopp: på start.
 */
export function respawnSpot(fallZ: number): { x: number; z: number } {
  const behind = PARK.kickers.filter((k) => k.z < fallZ);
  if (behind.length === 0) return { x: 0, z: 5 };
  const k = behind[behind.length - 1];
  return { x: 0, z: Math.max(5, k.z - rampLength(k) - CONFIG.fallRespawnBeforeRamp) };
}

/** Starter et fall. Kalles i steget du lander. */
export function startFall(f: FallState, s: SkierState, t: TrickState): void {
  f.time = 0;
  f.respawned = false;
  // velt mot den siden du snurret mot, ellers mot den siden du lente
  const lean = t.spinRate !== 0 ? t.spinRate : s.lean;
  f.side = lean < 0 ? -1 : 1;
  const spot = respawnSpot(s.z);
  f.respawnX = spot.x; f.respawnZ = spot.z;
  // kroppen vrir seg mykt tilbake til å se framover (ikke baklengs), så du står riktig når du settes tilbake
  t.spinTarget = Math.round(t.spin / TURN) * TURN;
  t.flipTarget = Math.round(t.flip / TURN) * TURN;
}

/** Du sklir i snøen og bremser opp. Ingen styring. */
function slide(s: SkierState, dt: number): void {
  const v = Math.hypot(s.vx, s.vy, s.vz);
  if (v > 0) {
    const want = Math.max(0, v * Math.exp(-CONFIG.fallSlideDrag * dt) - CONFIG.fallSlideDecel * dt);
    const k = want / v;
    s.vx *= k; s.vy *= k; s.vz *= k;
  }
  s.x += s.vx * dt; s.z += s.vz * dt;
  // hold deg på snøen og la farten følge bakken
  s.y = heightAt(s.x, s.z);
  const [nx, ny, nz] = normalAt(s.x, s.z);
  const vn = s.vx * nx + s.vy * ny + s.vz * nz;
  s.vx -= vn * nx; s.vy -= vn * ny; s.vz -= vn * nz;
  s.grounded = true;
  // kanten og leningen slippes mykt
  const fade = Math.exp(-8 * dt);
  s.edge *= fade; s.lean *= fade; s.leanRate *= fade;
  s.popCharge = 0;
  s.sinceLanding += dt; s.popAge += dt;
}

/**
 * Ett fysikksteg mens du faller. Gir true i steget du settes tilbake,
 * så kamera og skispor vet at det var et hopp, ikke en bevegelse.
 */
export function stepFall(f: FallState, s: SkierState, dt: number): boolean {
  if (f.time >= fallTotalTime()) return false;
  f.time += dt;
  if (!f.respawned && f.time >= CONFIG.fallRespawnAt) {
    f.respawned = true;
    placeSkier(s, f.respawnX, f.respawnZ, CONFIG.fallRespawnSpeed);
    return true;
  }
  if (!f.respawned) slide(s, dt);
  return false;
}

/** Ett steg etter en slurvete landing: farten tas litt ned, mykt over sloppyLossTime. */
export function stepSloppy(f: FallState, s: SkierState, dt: number): void {
  if (f.sloppyAge < CONFIG.sloppyLossTime) {
    const k = Math.pow(1 - CONFIG.sloppySpeedLoss, dt / CONFIG.sloppyLossTime);
    s.vx *= k; s.vy *= k; s.vz *= k;
  }
  f.sloppyAge += dt;
}

/** Hvor mye skjermen er bleket (0 = vanlig, 1 = helt dekket). Helt dekket i det du settes tilbake. */
export function fadeAmount(f: FallState): number {
  const r = CONFIG.fallRespawnAt, w = CONFIG.fallFadeTime;
  if (f.time < r) return ease((f.time - (r - w)) / w);
  return 1 - ease((f.time - r) / w);
}

/**
 * Kroppen i et fall: velter over til siden (roll), synker ned så den ligger på snøen (drop),
 * og bøyer seg litt framover (pitch). Reiser seg igjen før du settes tilbake.
 */
export function fallBody(f: FallState): { roll: number; drop: number; pitch: number } {
  const down = ease(f.time / CONFIG.fallTipTime) - ease((f.time - CONFIG.fallGetUpStart) / CONFIG.fallGetUpTime);
  const roll = f.side * CONFIG.fallRoll * down;
  // midten av kroppen (der den roterer) synker ned til den ligger på snøen
  const drop = (CONFIG.trickPivotHeight - CONFIG.fallLieHeight) * (1 - Math.cos(roll));
  return { roll, drop, pitch: 0.35 * down };
}

/** Kroppen vakler etter en slurvete landing: starter i ro, svinger fra side til side og dør ut. */
export function landingWobble(f: FallState): { roll: number; pitch: number } {
  const t = f.sloppyAge;
  if (t > 2) return { roll: 0, pitch: 0 };
  const env = CONFIG.sloppyWobble * Math.exp(-t / CONFIG.sloppyWobbleDecay) * ease(t / 0.06);
  const w = 2 * Math.PI * CONFIG.sloppyWobbleHz;
  return { roll: env * Math.sin(w * t), pitch: 0.5 * env * Math.sin(w * t * 0.5) };
}
