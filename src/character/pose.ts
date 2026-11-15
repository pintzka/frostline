/**
 * Hvordan skiløperen beveger kroppen rundt et hopp: sats, avspark, skiene opp i lufta, og fjæring ved landing.
 * Ren logikk uten three.js, så den kan testes. Arbeidsstrøm 4 (Karakter og animasjon) eier denne fila.
 */
export interface PoseInput {
  grounded: boolean;
  /** hvor mye pop er ladet (0–1) */
  popCharge: number;
  /** sekunder i lufta i dette hoppet */
  airTime: number;
  /** hvor høyt over snøen skiene er (m) */
  heightAboveSnow: number;
  /** sekunder siden siste landing */
  sinceLanding: number;
}

export interface Pose {
  /** hvor langt kroppen går ned mot skiene (m). Negativ = strekker seg opp. */
  drop: number;
  /** hvor mye kroppen lener seg framover (rad) */
  pitch: number;
  /** hvor høyt skiene trekkes opp under kroppen (m), som når du trekker knærne opp */
  skiLift: number;
}

import { CONFIG } from '../core/config';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => { const u = clamp01(t); return u * u * (3 - 2 * u); };

/**
 * Ett steg med en myk fjær (kritisk dempet): x følger target uten å skyte over, med farten v.
 * Løst nøyaktig for steget, så den er stabil og lik også ved lav bildefrekvens. Gir [ny x, ny fart].
 */
export function springStep(x: number, v: number, target: number, w: number, dt: number): [number, number] {
  const x0 = x - target;
  const e = Math.exp(-w * dt);
  return [target + (x0 + (v + w * x0) * dt) * e, (v - (v + w * x0) * w * dt) * e];
}

/**
 * Glatter ut overgangene (avspark, landing), så kroppen aldri rykker fra ett bilde til det neste.
 * Hvert tall følger målet med en myk fjær (kritisk dempet), likt uansett bildefrekvens.
 * vel holder farten til hvert tall mellom bildene.
 */
export function smoothPose(prev: Pose & { vel?: Pose }, target: Pose, dt: number): Pose & { vel: Pose } {
  const v = prev.vel ?? { drop: 0, pitch: 0, skiLift: 0 };
  const out = { drop: 0, pitch: 0, skiLift: 0, vel: { drop: 0, pitch: 0, skiLift: 0 } };
  for (const key of ['drop', 'pitch', 'skiLift'] as const) {
    [out[key], out.vel[key]] = springStep(prev[key], v[key], target[key], CONFIG.pose.speed, dt);
  }
  return out;
}

export function poseFor(s: PoseInput): Pose {
  const P = CONFIG.pose;
  if (s.grounded) {
    // sats mens pop lades
    let drop = P.crouchDrop * s.popCharge;
    let pitch = P.crouchPitch * s.popCharge;
    // fjæring rett etter landing: ned med en gang, tilbake opp på landTime
    const land = 1 - ease(s.sinceLanding / P.landTime);
    drop = Math.max(drop, P.landDrop * land);
    pitch = Math.max(pitch, P.landPitch * land);
    return { drop, pitch, skiLift: 0 };
  }

  // avspark: strekker seg opp en kort stund, går så over i en rolig stilling
  const kick = 1 - ease((s.airTime - P.kickStart) / P.kickTime);
  const drop = -P.kickStretch * kick + P.airDrop * (1 - kick);
  // skiene opp under kroppen etter avsparket, og ned igjen når snøen nærmer seg
  const tuckIn = ease((s.airTime - P.kickStart) / P.tuckTime);
  const tuckOut = ease((s.heightAboveSnow - P.tuckLowHeight) / P.tuckFadeHeight);
  const skiLift = P.tuckLift * tuckIn * tuckOut;
  return { drop, pitch: P.tuckPitch * tuckIn * tuckOut, skiLift };
}

/**
 * Leningen vises i kroppens retning: kjører du baklengs (switch), snus den. Fortegnet (1 = forlengs,
 * -1 = switch) glir mykt over i stedet for å bytte på ett bilde når du lander switch.
 */
export function followLeanSign(current: number, wantSwitch: boolean, dt: number): number {
  const target = wantSwitch ? -1 : 1;
  return target + (current - target) * Math.exp(-CONFIG.pose.leanSignSpeed * dt);
}
