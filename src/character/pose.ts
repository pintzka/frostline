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

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => { const u = clamp01(t); return u * u * (3 - 2 * u); };

/**
 * Glatter ut overgangene (avspark, landing), så kroppen aldri rykker fra ett bilde til det neste.
 * Hvert tall følger målet med en myk fjær (kritisk dempet), likt uansett bildefrekvens.
 * vel holder farten til hvert tall mellom bildene.
 */
export function smoothPose(prev: Pose & { vel?: Pose }, target: Pose, dt: number): Pose & { vel: Pose } {
  const w = 22; // hvor raskt (rad/s): ca. 0,15 s for å nå målet
  const v = prev.vel ?? { drop: 0, pitch: 0, skiLift: 0 };
  const out = { drop: 0, pitch: 0, skiLift: 0, vel: { drop: 0, pitch: 0, skiLift: 0 } };
  for (const key of ['drop', 'pitch', 'skiLift'] as const) {
    // løst nøyaktig for ett steg, så den er stabil også ved lav bildefrekvens
    const x0 = prev[key] - target[key], v0 = v[key];
    const e = Math.exp(-w * dt);
    const x = (x0 + (v0 + w * x0) * dt) * e;
    out.vel[key] = (v0 - (v0 + w * x0) * w * dt) * e;
    out[key] = target[key] + x;
  }
  return out;
}

export function poseFor(s: PoseInput): Pose {
  if (s.grounded) {
    // sats mens pop lades
    let drop = 0.22 * s.popCharge;
    let pitch = 0.3 * s.popCharge;
    // fjæring rett etter landing: ned med en gang, tilbake opp på 0,35 s
    const land = 1 - ease(s.sinceLanding / 0.35);
    drop = Math.max(drop, 0.18 * land);
    pitch = Math.max(pitch, 0.2 * land);
    return { drop, pitch, skiLift: 0 };
  }

  // avspark: strekker seg opp de første 0,15 s, går så over i en rolig stilling
  const kick = 1 - ease((s.airTime - 0.08) / 0.15);
  const drop = -0.14 * kick + 0.04 * (1 - kick);
  // skiene opp under kroppen etter avsparket, og ned igjen når snøen nærmer seg
  const tuckIn = ease((s.airTime - 0.08) / 0.2);
  const tuckOut = ease((s.heightAboveSnow - 0.1) / 0.7);
  const skiLift = 0.3 * tuckIn * tuckOut;
  return { drop, pitch: 0.12 * tuckIn * tuckOut, skiLift };
}
