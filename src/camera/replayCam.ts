import { CONFIG } from '../core/config';
import { heightAt, PARK } from '../park/terrain';
import { createCameraRig, type CameraInput, type CameraPose } from './rig';

/**
 * Kameravinklene i reprisen, uten three.js, så de kan testes.
 * - bak: som i spillet, bak skiløperen (egen rigg, så spillets kamera ikke påvirkes)
 * - tv: står fast ved siden av hoppet skiløperen er på vei mot, snur seg og zoomer etter skiløperen
 * - hoy: høyt over og bak skiløperen, ser ned på hele hoppet
 * Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 */
export type ReplayCamKind = 'bak' | 'tv' | 'hoy';

export const REPLAY_CAMS: { kind: ReplayCamKind; name: string }[] = [
  { kind: 'bak', name: 'Bak skiløperen' },
  { kind: 'tv', name: 'TV-kamera' },
  { kind: 'hoy', name: 'Høyt kamera' },
];

/** Hoppet TV-kameraet står ved: det første som skiløperen ikke er godt forbi. Er alle passert, det siste. */
export function tvKicker(z: number): number {
  const ks = PARK.kickers;
  for (let i = 0; i < ks.length; i++) if (z < ks[i].z + CONFIG.replayTvSwitchAfter) return i;
  return ks.length - 1;
}

/** Hvor TV-kameraet står ved hopp nr. i: til siden (innenfor bakken), litt etter kanten, over snøen. */
export function tvSpot(i: number): { x: number; y: number; z: number } {
  const k = PARK.kickers[i];
  const x = Math.min(CONFIG.replayTvSide, PARK.width / 2 - 1);
  const z = k.z + CONFIG.replayTvAlong;
  return { x, y: heightAt(x, z) + CONFIG.replayTvHeight, z };
}

export function createReplayCam() {
  const rig = createCameraRig();
  const pose: CameraPose = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, fov: CONFIG.camFovBase };
  let lastKind: ReplayCamKind | null = null;

  return {
    /** Kalles hvert bilde. cut = skiløperen ble flyttet (ny runde, fall), eller vinkelen er nettopp byttet. */
    update(kind: ReplayCamKind, inp: CameraInput, dt: number): CameraPose {
      const cut = !!inp.cut || kind !== lastKind;
      lastKind = kind;
      if (kind === 'bak') return rig.update({ ...inp, cut }, dt);
      // de andre ser på skiløperen
      pose.lx = inp.x; pose.ly = inp.y + CONFIG.camLookHeight; pose.lz = inp.z;
      if (kind === 'tv') {
        const s = tvSpot(tvKicker(inp.z));
        pose.px = s.x; pose.py = s.y; pose.pz = s.z;
        // zoom: skiløperen er omtrent like stor i bildet uansett hvor langt unna
        const dist = Math.hypot(inp.x - s.x, inp.y - s.y, inp.z - s.z);
        const fov = 2 * Math.atan(CONFIG.replayTvFrame / 2 / Math.max(dist, 0.1)) * 180 / Math.PI;
        pose.fov = Math.max(CONFIG.replayTvFovMin, Math.min(CONFIG.replayTvFovMax, fov));
        return pose;
      }
      // høyt: følger mykt, men hopper rett på plass ved klipp
      const wx = inp.x, wy = inp.y + CONFIG.replayHighUp, wz = inp.z - CONFIG.replayHighBack;
      const k = cut ? 1 : 1 - Math.exp(-CONFIG.replayHighFollow * dt);
      pose.px += (wx - pose.px) * k; pose.py += (wy - pose.py) * k; pose.pz += (wz - pose.pz) * k;
      pose.fov = CONFIG.replayHighFov;
      return pose;
    },
  };
}
