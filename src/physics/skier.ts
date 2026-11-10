import { CONFIG } from '../core/config';
import { heightAt, normalAt, PARK } from '../park/terrain';

/**
 * Skiløperens fysikk. Ren logikk uten three.js, så den kan testes.
 * Arbeidsstrøm 1 (Kjernefysikk) eier denne fila.
 */
export interface SkierState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Retningen skiene peker (rad). 0 = rett ned bakken (+z). */
  heading: number;
  /** Hvor mye skiene står på kant, -1 (venstre) til 1 (høyre). Følger styringen mykt. */
  edge: number;
  /** Hvor mye skiløperen lener seg inn i svingen (rad). Positiv = mot høyre. */
  lean: number;
  /** Hvor fort leningen endrer seg (rad/s). Gjør at leningen starter rolig i stedet for å rykke. */
  leanRate: number;
  grounded: boolean;
}

export interface SkierInput {
  /** -1 (venstre) til 1 (høyre) */
  steer: number;
  /** 0–1, brems/plog */
  brake: number;
}

export function createSkier(): SkierState {
  const z = 5;
  return { x: 0, y: heightAt(0, z), z, vx: 0, vy: 0, vz: 2, heading: 0, edge: 0, lean: 0, leanRate: 0, grounded: true };
}

export function speedOf(s: SkierState): number {
  return Math.hypot(s.vx, s.vy, s.vz);
}

export function stepSkier(s: SkierState, inp: SkierInput, dt: number): void {
  const g = CONFIG.gravity;

  // kanten bygges opp og slippes mykt, selv om tastaturet bare er av/på
  s.edge += (inp.steer - s.edge) * (1 - Math.exp(-CONFIG.edgeResponse * dt));
  // i høy fart begrenses svingen av hvor hardt kanten kan presse
  const turnRate = Math.min(CONFIG.turnRate, CONFIG.carveAccel / Math.max(speedOf(s), 1e-3));
  s.heading += -s.edge * turnRate * dt;

  // len inn i svingen like mye som svingen presser (som en ekte skiløper), men aldri mer enn maks
  const sideAccel = speedOf(s) * s.edge * turnRate;
  const wantLean = Math.max(-CONFIG.maxLean, Math.min(CONFIG.maxLean, Math.atan(sideAccel / g)));
  // myk fjær (kritisk dempet): starter rolig, glir på plass og skyter ikke over
  const w = CONFIG.leanSpeed;
  s.leanRate += (w * w * (wantLean - s.lean) - 2 * w * s.leanRate) * dt;
  s.lean = Math.max(-CONFIG.maxLean, Math.min(CONFIG.maxLean, s.lean + s.leanRate * dt));

  if (s.grounded) {
    const [nx, ny, nz] = normalAt(s.x, s.z);
    // tyngdekraftens komponent langs bakken, forsterket så det føles raskt
    const gDotN = -g * ny;
    const ax = -gDotN * nx * CONFIG.slopeAccel;
    const ay = (-g - gDotN * ny) * CONFIG.slopeAccel;
    const az = -gDotN * nz * CONFIG.slopeAccel;

    // skienes retning projisert på bakken
    let fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    let fy = -(nx * fx + nz * fz) / ny;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;

    // carving: skiene vrir farten inn i sin egen retning og beholder den
    const vAlong = s.vx * fx + s.vy * fy + s.vz * fz;
    const sx = s.vx - vAlong * fx, sy = s.vy - vAlong * fy, sz = s.vz - vAlong * fz;
    const side = Math.hypot(sx, sy, sz);
    const keep = Math.exp(-CONFIG.edgeGrip * dt);
    const newSide = side * keep;
    const newAlong = (vAlong < 0 ? -1 : 1) * Math.sqrt(vAlong * vAlong + side * side - newSide * newSide);
    s.vx = newAlong * fx + sx * keep;
    s.vy = newAlong * fy + sy * keep;
    s.vz = newAlong * fz + sz * keep;

    s.vx += ax * dt; s.vy += ay * dt; s.vz += az * dt;

    // friksjon + luftmotstand + skrens + brems kan bare stoppe deg, aldri dytte deg bakover
    const v = speedOf(s);
    if (v > 0) {
      const drag = CONFIG.dragCoef * v * v + CONFIG.snowFriction * g + CONFIG.skidFriction * side + inp.brake * CONFIG.brakeDecel;
      const k = Math.max(0, v - drag * dt) / v;
      s.vx *= k; s.vy *= k; s.vz *= k;
    }

    // hold farten langs bakken
    const vn = s.vx * nx + s.vy * ny + s.vz * nz;
    s.vx -= vn * nx; s.vy -= vn * ny; s.vz -= vn * nz;
  } else {
    s.vy -= g * dt;
  }

  // toppfart
  const v = speedOf(s);
  if (v > CONFIG.maxSpeed) {
    const k = CONFIG.maxSpeed / v;
    s.vx *= k; s.vy *= k; s.vz *= k;
  }

  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;

  // hold deg innenfor parken
  const half = PARK.width / 2;
  if (s.x < -half) { s.x = -half; s.vx = Math.abs(s.vx) * 0.3; }
  if (s.x > half) { s.x = half; s.vx = -Math.abs(s.vx) * 0.3; }

  const h = heightAt(s.x, s.z);
  if (s.grounded || s.y <= h) {
    // fase 0: ingen hopp ennå, så vi følger alltid bakken
    s.y = h;
    s.grounded = true;
  }
}
