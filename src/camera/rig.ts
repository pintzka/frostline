import { CONFIG } from '../core/config';
import { heightAt } from '../park/terrain';

/**
 * Kamerariggens logikk, uten three.js, så den kan testes.
 * Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 *
 * Kameraet sitter alltid camDistance bak og camHeight over skiløperen (ingen gummistrikk som
 * strekker seg i høy fart), og løftes bare når snøen bak krever det. Retningen, høyden og
 * synsfeltet glir mykt, og glidningen er lik uansett bildefrekvens.
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

/** Korteste vinkel fra a til b (rad), mellom -π og π. */
function angleDiff(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * Retningen skiløperen faktisk beveger seg. I lav fart brukes skienes retning.
 * Mellom de to blandes vinklene (ikke pilene), så retningen glir jevnt selv når de peker hver sin vei.
 */
function travelYaw(inp: CameraInput): number {
  const hs = Math.hypot(inp.vx, inp.vz);
  if (hs === 0) return inp.heading;
  const min = CONFIG.camDirMinSpeed;
  const w = Math.min(1, Math.max(0, (hs - min) / min));
  return inp.heading + w * angleDiff(inp.heading, Math.atan2(inp.vx, inp.vz));
}

/** Myk utgave av max(a, b): ingen knekk der den bytter fra den ene til den andre. */
function softMax(a: number, b: number, k: number) {
  return (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
}

export function createCameraRig() {
  let ready = false;
  let yaw = 0;
  // hvor høyt snøen bak tvinger kameraet over skiløperen (m); stiger med en gang, synker mykt
  let snowLift = -Infinity;
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
        // følg mykt, men aldri raskere enn camMaxYawRate, så kameraet ikke slenger rundt
        const step = angleDiff(yaw, wantYaw) * follow(CONFIG.camYawFollow, dt);
        const cap = CONFIG.camMaxYawRate * dt;
        yaw += Math.max(-cap, Math.min(cap, step));
      }

      pose.px = inp.x - Math.sin(yaw) * CONFIG.camDistance;
      pose.pz = inp.z - Math.cos(yaw) * CONFIG.camDistance;

      // høyden måles over skiløperen. Ligger snøen bak høyere (oppoverbakke, bratt landing),
      // løftes kameraet akkurat så mye som trengs, med en myk overgang i stedet for en klamp som knekker
      const wantSnow = heightAt(pose.px, pose.pz) + CONFIG.camSnowClearance - inp.y;
      if (snap || wantSnow > snowLift) snowLift = wantSnow;
      else snowLift += (wantSnow - snowLift) * follow(CONFIG.camHeightFollow, dt);
      pose.py = inp.y + softMax(CONFIG.camHeight, snowLift, CONFIG.camHeightBlend);

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
