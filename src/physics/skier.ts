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
  return { x: 0, y: heightAt(0, z), z, vx: 0, vy: 0, vz: 2, heading: 0, grounded: true };
}

export function speedOf(s: SkierState): number {
  return Math.hypot(s.vx, s.vy, s.vz);
}

export function stepSkier(s: SkierState, inp: SkierInput, dt: number): void {
  const g = CONFIG.gravity;
  s.heading += -inp.steer * CONFIG.turnRate * dt;

  if (s.grounded) {
    const [nx, ny, nz] = normalAt(s.x, s.z);
    // tyngdekraftens komponent langs bakken
    const gDotN = -g * ny;
    let ax = -gDotN * nx;
    let ay = -g - gDotN * ny;
    let az = -gDotN * nz;

    // skienes retning projisert på bakken
    let fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    let fy = -(nx * fx + nz * fz) / ny;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;

    // carving: fjern sidelengs fart gradvis (skiene griper)
    const vAlong = s.vx * fx + s.vy * fy + s.vz * fz;
    const sx = s.vx - vAlong * fx, sy = s.vy - vAlong * fy, sz = s.vz - vAlong * fz;
    const grip = Math.min(1, CONFIG.edgeGrip * dt);
    s.vx -= sx * grip; s.vy -= sy * grip; s.vz -= sz * grip;

    // friksjon + luftmotstand + brems
    const v = speedOf(s);
    if (v > 1e-6) {
      const drag = CONFIG.dragCoef * v * v + CONFIG.snowFriction * g + inp.brake * 6;
      ax -= (s.vx / v) * drag; ay -= (s.vy / v) * drag; az -= (s.vz / v) * drag;
    }

    s.vx += ax * dt; s.vy += ay * dt; s.vz += az * dt;

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
