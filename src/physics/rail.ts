import { CONFIG } from '../core/config';
import { heightAt as parkHeightAt, PARK } from '../park/terrain';
import type { ParkData, Rail } from '../park/format';
import type { SkierInput, SkierState } from './skier';

/**
 * Rails og bokser: å treffe dem, gli langs dem, balanse og å hoppe av.
 * Ren logikk uten three.js, deterministisk med fast steg. Tallene står i src/core/config.ts.
 *
 * En rail er et rett stykke som følger bakken i fast høyde over snøen. Starten er en myk rampe
 * opp fra snøen, så du kan kjøre rett opp på den. Du kan også poppe opp på den fra siden av starten.
 */
const DEG = Math.PI / 180;

/** Formen på en rail, regnet ut fra parkfila. I verden er x motsatt av parkfila (der positivt = til høyre). */
export interface RailShape {
  rail: Rail;
  /** Startpunktet i verden (m). */
  x0: number; z0: number;
  /** Retningen langs bakken (enhetsvektor, vannrett). */
  dx: number; dz: number;
  /** Retningen som en vinkel, som heading (rad). */
  yaw: number;
  /** Hvor langt fra midten skiene kan treffe (m). */
  catchHalf: number;
}

/** Lager formen på alle railene i parken. */
export function railShapes(park: ParkData): RailShape[] {
  return (park.rails ?? []).map((r) => {
    const a = (r.angleDeg ?? 0) * DEG;
    // i verden er +x til venstre når du ser nedover, så parkfilas x og vinkel snus
    const dx = -Math.sin(a), dz = Math.cos(a);
    const catchHalf = r.kind === 'box' ? CONFIG.boxWidth / 2 + CONFIG.railCatch / 2 : CONFIG.railCatch;
    return { rail: r, x0: -r.x, z0: r.z, dx, dz, yaw: Math.atan2(dx, dz), catchHalf };
  });
}

/** Rails i parken som kjøres nå. */
export const RAILS = railShapes(PARK);

type HeightFn = (x: number, z: number) => number;

function smoothstep(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

/** Punktet midt på railen u meter fra starten (vannrett). */
export function railCenter(r: RailShape, u: number): [number, number] {
  return [r.x0 + u * r.dx, r.z0 + u * r.dz];
}

/** Høyden på toppen av railen u meter fra starten: snøen under, pluss høyden (mykt opp i rampen). */
export function railTop(r: RailShape, u: number, h: HeightFn = parkHeightAt): number {
  const [x, z] = railCenter(r, u);
  return h(x, z) + r.rail.height * smoothstep(u / CONFIG.railRampLength);
}

/** Hvor (u, side) et punkt er i forhold til railen: u langs, side ut til siden (m). */
export function railLocal(r: RailShape, x: number, z: number): { u: number; side: number } {
  const ox = x - r.x0, oz = z - r.z0;
  return { u: ox * r.dx + oz * r.dz, side: ox * r.dz - oz * r.dx };
}

/** Punktet i verden for (u, side). Toppen gjelder midt på railen. */
function railPoint(r: RailShape, u: number, side: number, h: HeightFn): [number, number, number] {
  const [cx, cz] = railCenter(r, u);
  return [cx + side * r.dz, railTop(r, u, h), cz - side * r.dx];
}

/** Retningen langs railen i 3D (enhetsvektor), u meter fra starten. */
export function railDir(r: RailShape, u: number, h: HeightFn = parkHeightAt): [number, number, number] {
  const e = 0.05;
  const len = r.rail.length;
  const a = Math.max(0, Math.min(len, u - e)), b = Math.max(0, Math.min(len, u + e));
  const dy = (railTop(r, b, h) - railTop(r, a, h)) / Math.max(1e-6, b - a);
  const l = Math.hypot(1, dy);
  return [r.dx / l, dy / l, r.dz / l];
}

export type RailStyle = '5050' | 'boardslide';

/** Navnet som vises på skjermen. */
export function railStyleName(style: RailStyle): string {
  return style === '5050' ? '50-50' : 'Boardslide';
}

/** Hvordan du har det på railen. */
export interface RailRide {
  /** Står du på en rail nå? */
  on: boolean;
  /** Hvilken rail (indeks i lista), og hvor langt på den (m fra starten). */
  index: number;
  u: number;
  /** Hvor langt fra midten du står (m), og hvor fort det endrer seg. Glir mykt inn mot midten. */
  side: number;
  sideVel: number;
  /** Farten langs railen (m/s). */
  speed: number;
  style: RailStyle;
  /** Balansen: 0 = midt over, ±1 = du faller av. */
  balance: number;
  /** Sekunder på denne railen. */
  time: number;
  /** Landet du skjevt? Da gir railen halve poeng. */
  sloppy: boolean;
  /** Falt du av? Da blir neste landing i snøen et fall. Gjelder til du lander. */
  bail: boolean;
  /** Stilen du hadde da du falt av (for teksten på skjermen). */
  bailStyle: RailStyle;
}

export function createRailRide(): RailRide {
  return { on: false, index: -1, u: 0, side: 0, sideVel: 0, speed: 0, style: '5050', balance: 0, time: 0, sloppy: false, bail: false, bailStyle: '5050' };
}

/** Der skiene treffer en rail. */
export interface RailHit {
  index: number;
  u: number;
  side: number;
  /** Kom du fra lufta (true) eller kjørte du opp rampen (false)? */
  fromAir: boolean;
}

/**
 * Treffer skiløperen en rail i dette steget? prev = posisjonen før steget.
 * Fra lufta: skiene går fra over toppen til på eller under toppen, på vei ned, og innenfor bredden.
 * Fra snøen: du kjører opp starten av rampen, omtrent langs railen.
 */
export function findRailHit(rails: RailShape[], prev: { x: number; y: number; z: number }, s: SkierState, h: HeightFn = parkHeightAt): RailHit | null {
  for (let i = 0; i < rails.length; i++) {
    const r = rails[i];
    const { u, side } = railLocal(r, s.x, s.z);
    if (u < 0 || u > r.rail.length || Math.abs(side) > r.catchHalf) continue;
    const top = railTop(r, u, h);
    const d = railDir(r, u, h);
    const along = s.vx * d[0] + s.vy * d[1] + s.vz * d[2];
    if (along < CONFIG.railMinSpeed) continue;
    if (!s.grounded) {
      const p = railLocal(r, prev.x, prev.z);
      const prevTop = railTop(r, Math.max(0, Math.min(r.rail.length, p.u)), h);
      // farten rett inn mot railen (vinkelrett på den, oppover er positivt)
      const ny = Math.hypot(d[0], d[2]);
      const into = -(s.vx * -d[1] * d[0] / ny + s.vy * ny + s.vz * -d[1] * d[2] / ny);
      if (prev.y >= prevTop - 0.02 && s.y <= top && into > 0) return { index: i, u, side, fromAir: true };
    } else {
      const hs = Math.hypot(s.vx, s.vz);
      const cos = (s.vx * r.dx + s.vz * r.dz) / Math.max(1e-6, hs);
      if (top - s.y <= CONFIG.railStepUp && cos >= Math.cos(CONFIG.railGroundMaxDeg * DEG)) return { index: i, u, side, fromAir: false };
    }
  }
  return null;
}

/** Korteste vinkel fra a til b (rad), mellom -π og π. */
function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * Hvor mye skiene må vris for å peke langs railen (rad). Kroppen skal ikke snu seg brått,
 * så den som kaller må vri spinnet like mye (tricks/rotation.ts shiftSpin).
 */
export function railHeadingShift(rails: RailShape[], s: SkierState, hit: RailHit): number {
  return angleDiff(s.heading, rails[hit.index].yaw);
}

/** Setter fart og posisjon langs railen ut fra punktet (u, side). Farten fra forrige posisjon, så den aldri hopper. */
function place(rr: RailRide, r: RailShape, s: SkierState, h: HeightFn): void {
  const [x, y, z] = railPoint(r, rr.u, rr.side, h);
  s.x = x; s.y = y; s.z = z;
}

/**
 * Låser skiløperen til railen. Farten langs railen beholdes; farten inn i den og ut til siden tas opp av beina,
 * som når du lander i snøen. Posisjonen flyttes ikke sidelengs (den glir inn mot midten etterpå).
 */
export function startGrind(rr: RailRide, rails: RailShape[], s: SkierState, hit: RailHit, style: RailStyle, balance: number, sloppy: boolean, h: HeightFn = parkHeightAt): void {
  const r = rails[hit.index];
  const d = railDir(r, hit.u, h);
  const speed = s.vx * d[0] + s.vy * d[1] + s.vz * d[2];
  s.heading += angleDiff(s.heading, r.yaw);
  Object.assign(rr, { on: true, index: hit.index, u: hit.u, side: hit.side, sideVel: 0, speed, style, balance, time: 0, sloppy, bail: false });
  place(rr, r, s, h);
  s.vx = speed * d[0]; s.vy = speed * d[1]; s.vz = speed * d[2];
  s.grounded = true;
  if (hit.fromAir) s.sinceLanding = 0;
}

/** Dytter skiløperen av railen ut til siden (mot den siden du lener), som et fall. */
export function bailOff(rr: RailRide, rails: RailShape[], s: SkierState, index: number, style: RailStyle, towards: number): void {
  const r = rails[index];
  const side = towards < 0 ? -1 : 1;
  s.vx += side * r.dz * CONFIG.railBailPush;
  s.vz += -side * r.dx * CONFIG.railBailPush;
  s.vy += CONFIG.railBailUp;
  s.grounded = false;
  s.airTime = 0;
  s.popCharge = 0;
  Object.assign(rr, { on: false, bail: true, bailStyle: style });
}

/** Hvordan glidningen endte i dette steget: null = du er fortsatt på railen. */
export type GrindEnd = 'slutt' | 'pop' | 'fall' | null;

/**
 * Ett fysikksteg på railen. Farten bremses av friksjon og luft, tyngdekraften langs railen drar.
 * Styring dytter balansen; ved ±1 faller du av. Pop (hold og slipp) hopper av. Slutten av railen: du flyr videre.
 */
export function stepGrind(rr: RailRide, rails: RailShape[], s: SkierState, inp: SkierInput, dt: number, h: HeightFn = parkHeightAt): GrindEnd {
  const r = rails[rr.index];
  const g = CONFIG.gravity;
  rr.time += dt;
  s.popAge += dt;
  s.sinceLanding += dt;

  // kanten og bremsen slippes mykt (de betyr ingenting på railen)
  s.edge *= Math.exp(-CONFIG.edgeResponse * dt);
  s.brake *= Math.exp(-CONFIG.brakeResponse * dt);

  // balansen: styring dytter, og den går mykt tilbake mot midten av seg selv
  const steer = Math.max(-1, Math.min(1, inp.steer));
  rr.balance += (steer * CONFIG.railSteerRate - rr.balance * CONFIG.railRecover) * dt;
  // kroppen lener seg like mye som balansen (myk fjær), så du ser hvor nær du er å falle
  const w = CONFIG.railLeanSpeed;
  const want = rr.balance * CONFIG.railLeanMax;
  s.leanRate += (w * w * (want - s.lean) - 2 * w * s.leanRate) * dt;
  s.lean += s.leanRate * dt;
  if (Math.abs(rr.balance) >= 1) { bailOff(rr, rails, s, rr.index, rr.style, rr.balance); return 'fall'; }

  // farten langs railen: tyngdekraften langs den, minus friksjon og luftmotstand (kan bare stoppe deg)
  const d = railDir(r, rr.u, h);
  const mu = rr.style === '5050' ? CONFIG.railFriction5050 : CONFIG.railFrictionBoard;
  const cos = Math.hypot(d[0], d[2]);
  rr.speed += -g * d[1] * dt;
  rr.speed = Math.max(0, rr.speed - (mu * g * cos + CONFIG.dragCoef * rr.speed * rr.speed) * dt);
  if (rr.speed < CONFIG.railMinSpeed) { bailOff(rr, rails, s, rr.index, rr.style, rr.balance); return 'fall'; }

  // flytt langs railen, og gli mykt inn mot midten
  const ox = s.x, oy = s.y, oz = s.z;
  rr.u += rr.speed * cos * dt;
  const e = Math.exp(-CONFIG.railCenter * dt);
  const x0 = rr.side, v0 = rr.sideVel, k = CONFIG.railCenter;
  rr.side = (x0 + (v0 + k * x0) * dt) * e;
  rr.sideVel = (v0 - (v0 + k * x0) * k * dt) * e;
  place(rr, r, s, h);
  // farten er det du faktisk flyttet deg, så den stemmer når du flyr av
  s.vx = (s.x - ox) / dt; s.vy = (s.y - oy) / dt; s.vz = (s.z - oz) / dt;

  // pop: lad mens knappen holdes, hopp av når den slippes
  const holding = !!inp.pop;
  if (holding) s.popCharge = Math.min(1, s.popCharge + dt / CONFIG.popChargeTime);
  const popNow = !holding && s.popHeld && s.popCharge > 0;
  s.popHeld = holding;
  if (popNow) {
    const d2 = railDir(r, rr.u, h);
    const c = Math.hypot(d2[0], d2[2]);
    // rett opp fra railen (vinkelrett på den)
    const up = [-d2[1] * d2[0] / c, c, -d2[1] * d2[2] / c];
    const strength = CONFIG.popSpeed * (CONFIG.popMinCharge + (1 - CONFIG.popMinCharge) * s.popCharge);
    s.vx += up[0] * strength; s.vy += up[1] * strength; s.vz += up[2] * strength;
    s.lastPop = 'pop';
    s.popAge = 0;
  }
  if (!holding) s.popCharge = 0;
  if (popNow || rr.u >= r.rail.length) {
    s.grounded = false;
    s.airTime = 0;
    s.popCharge = 0;
    rr.on = false;
    return popNow ? 'pop' : 'slutt';
  }
  return null;
}

/** Ligger punktet (x, z) på en rail eller rett før den? Brukes så du ikke settes tilbake midt på en rail. */
export function railAt(rails: RailShape[], x: number, z: number, margin = 2): RailShape | null {
  for (const r of rails) {
    const { u, side } = railLocal(r, x, z);
    if (u > -margin && u < r.rail.length + margin && Math.abs(side) < r.catchHalf + margin) return r;
  }
  return null;
}
