import { CONFIG } from '../core/config';
import { heightAt, LANDING, normalAt, PARK, rampLength } from '../park/terrain';
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
  /** Farten du får når du settes tilbake (m/s). */
  respawnSpeed: number;
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
  return { time: 99, side: 1, respawnX: 0, respawnZ: CONFIG.startZ, respawnSpeed: CONFIG.fallBackSpeed, respawned: true, sloppyAge: 99 };
}

/** Ligger du i snøen nå (ingen styring, pop eller triks)? */
export function isFalling(f: FallState): boolean {
  return f.time < CONFIG.fallRespawnAt;
}

/** Hele fallet, med blekingen inn igjen etter at du er satt tilbake. */
export function fallTotalTime(): number {
  return CONFIG.fallRespawnAt + CONFIG.fallFadeTime;
}

/** Er fallet ferdig, også blekingen inn igjen? Før det virker ikke R. */
export function fallDone(f: FallState): boolean {
  return f.time >= fallTotalTime();
}

/** Strekningen (z) der et hopp er: fra litt før rampen til der landingen blir bratt. Der settes du aldri. */
function kickerZone(k: (typeof PARK.kickers)[number]): [number, number] {
  return [k.z - rampLength(k) - CONFIG.fallRampMargin, k.z + k.landingStart + LANDING.knuckle];
}

/**
 * Hvor du settes tilbake.
 * - Lettet du fra kanten på et hopp og falt på landingen: et fast stykke før rampen på det hoppet,
 *   med en fart som gir samme fart på kanten som en vanlig kjøring (så du kan prøve trikset igjen).
 * - Ellers (f.eks. pop på flat bakke): et fast stykke før fallstedet, men aldri på et hopp.
 */
export function respawnSpot(fallX: number, fallZ: number, takeoffZ: number): { x: number; z: number; speed: number } {
  const i = PARK.kickers.findIndex((k) => Math.abs(takeoffZ - k.z) <= CONFIG.fallTakeoffWindow && fallZ > k.z);
  if (i >= 0) {
    const k = PARK.kickers[i];
    return { x: 0, z: Math.max(CONFIG.startZ, k.z - rampLength(k) - CONFIG.fallRespawnBeforeRamp[i]), speed: CONFIG.fallRespawnSpeed[i] };
  }
  const half = PARK.width / 2 - 2;
  const x = Math.max(-half, Math.min(half, fallX));
  let z = Math.max(CONFIG.startZ, fallZ - CONFIG.fallBackDistance);
  // havner du på et hopp, flyttes du bakover til før rampen (de bakerste hoppene sjekkes sist)
  for (let n = PARK.kickers.length - 1; n >= 0; n--) {
    const k = PARK.kickers[n];
    const [from, to] = kickerZone(k);
    if (Math.abs(x) < k.width / 2 + 4 && z > from && z < to) z = Math.max(CONFIG.startZ, from);
  }
  return { x, z, speed: CONFIG.fallBackSpeed };
}

/** Starter et fall. Kalles i steget du lander. takeoffZ = der du lettet. */
export function startFall(f: FallState, s: SkierState, t: TrickState, takeoffZ: number): void {
  f.time = 0;
  f.respawned = false;
  // velt mot den siden du snurret mot, ellers mot den siden du lente
  if (Math.abs(t.spinRate) > CONFIG.fallSpinSideMin) f.side = Math.sign(t.spinRate);
  else f.side = s.lean < 0 ? -1 : 1;
  const spot = respawnSpot(s.x, s.z, takeoffZ);
  f.respawnX = spot.x; f.respawnZ = spot.z; f.respawnSpeed = spot.speed;
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
  const fade = Math.exp(-CONFIG.fallLetGo * dt);
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
    placeSkier(s, f.respawnX, f.respawnZ, f.respawnSpeed);
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
  return { roll, drop, pitch: CONFIG.fallPitch * down };
}

/** Kroppen vakler etter en slurvete landing: starter i ro, svinger fra side til side og dør ut. */
export function landingWobble(f: FallState): { roll: number; pitch: number } {
  const t = f.sloppyAge;
  if (t > CONFIG.sloppyWobbleEnd) return { roll: 0, pitch: 0 };
  const env = CONFIG.sloppyWobble * Math.exp(-t / CONFIG.sloppyWobbleDecay) * ease(t / CONFIG.sloppyWobbleRampIn);
  const w = 2 * Math.PI * CONFIG.sloppyWobbleHz;
  return { roll: env * Math.sin(w * t), pitch: CONFIG.sloppyWobblePitch * env * Math.sin(w * t * 0.5) };
}
