import { CONFIG } from '../core/config';
import { heightAt } from '../park/terrain';

/**
 * Kamerariggens logikk, uten three.js, så den kan testes.
 * Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 *
 * Kameraet sitter alltid camDistance bak skiløperen (ingen gummistrikk som
 * strekker seg i høy fart). Bare retningen, høyden og synsfeltet glir mykt,
 * og glidningen er lik uansett bildefrekvens.
 */
export interface CameraInput {
  x: number; y: number; z: number;
  vx: number; vz: number;
  /** Retningen skiene peker (rad). */
  heading: number;
  speed: number;
}

export interface CameraPose {
  px: number; py: number; pz: number;
  /** Punktet kameraet ser på. */
  lx: number; ly: number; lz: number;
  fov: number;
}

/** Hvor stor del av avstanden som tas igjen på dt sekunder (lik for alle fps). */
function follow(rate: number, dt: number) {
  return 1 - Math.exp(-rate * dt);
}

/** Retningen skiløperen faktisk beveger seg. I lav fart brukes skienes retning. */
function travelYaw(inp: CameraInput): number {
  const hs = Math.hypot(inp.vx, inp.vz);
  const min = CONFIG.camDirMinSpeed;
  const w = Math.min(1, Math.max(0, (hs - min) / min));
  const dx = (1 - w) * Math.sin(inp.heading) + (hs > 0 ? (w * inp.vx) / hs : 0);
  const dz = (1 - w) * Math.cos(inp.heading) + (hs > 0 ? (w * inp.vz) / hs : 0);
  return Math.atan2(dx, dz);
}

export function createCameraRig() {
  let ready = false;
  let yaw = 0;
  let lift: number = CONFIG.camHeight;
  let fov: number = CONFIG.camFovBase;
  let lastX = 0, lastZ = 0;
  const pose: CameraPose = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, fov };

  return {
    update(inp: CameraInput, dt: number): CameraPose {
      // første bilde, eller restart (R): hopp rett på plass i stedet for å fly dit
      const snap = !ready || Math.hypot(inp.x - lastX, inp.z - lastZ) > CONFIG.camSnapDistance;
      lastX = inp.x; lastZ = inp.z;

      const wantYaw = travelYaw(inp);
      if (snap) yaw = wantYaw;
      else {
        const d = Math.atan2(Math.sin(wantYaw - yaw), Math.cos(wantYaw - yaw));
        yaw += d * follow(CONFIG.camYawFollow, dt);
      }

      pose.px = inp.x - Math.sin(yaw) * CONFIG.camDistance;
      pose.pz = inp.z - Math.cos(yaw) * CONFIG.camDistance;

      // høyden måles over snøen bak skiløperen og glir mykt over kuler
      const snow = heightAt(pose.px, pose.pz);
      const wantLift = Math.max(snow, inp.y) + CONFIG.camHeight - inp.y;
      lift = snap ? wantLift : lift + (wantLift - lift) * follow(CONFIG.camHeightFollow, dt);
      pose.py = Math.max(inp.y + lift, snow + CONFIG.camMinClearance);

      pose.lx = inp.x + Math.sin(yaw) * CONFIG.camLookAhead;
      pose.ly = inp.y + CONFIG.camLookHeight;
      pose.lz = inp.z + Math.cos(yaw) * CONFIG.camLookAhead;

      const t = Math.min(1, inp.speed / CONFIG.maxSpeed);
      const wantFov = CONFIG.camFovBase + (CONFIG.camFovMax - CONFIG.camFovBase) * t * t;
      fov = snap ? wantFov : fov + (wantFov - fov) * follow(CONFIG.camFovFollow, dt);
      pose.fov = fov;

      ready = true;
      return pose;
    },
  };
}
