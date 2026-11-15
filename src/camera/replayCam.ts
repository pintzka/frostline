import { CONFIG } from '../core/config';
import { heightAt, LANDING, PARK } from '../park/terrain';
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

/**
 * Neste hopp for TV-kameraet, ut fra det det står ved nå (cur, -1 = ikke valgt ennå).
 * Bytter bare når skiløperen står på snøen, så det ikke klipper midt i et hopp (landingen kan være langt forbi kanten).
 */
export function nextTvKicker(cur: number, z: number, grounded: boolean): number {
  const want = tvKicker(z);
  if (cur < 0 || want < cur) return want;
  return want > cur && grounded ? want : cur;
}

/** Ser man fra a til b uten at snøen (eller et hopp) er i veien? Klaring = minst så mange meter over snøen. */
export function sightClear(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, clear: number = CONFIG.replayTvClear): boolean {
  const n = 40;
  for (let i = 2; i < n - 1; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (y < heightAt(x, z) + clear) return false;
  }
  return true;
}

/** Punktene skiløperen er på vei inn mot, over og ned landingen på hopp nr. i (midt i bakken, litt over snøen). */
function approachPoints(i: number): { x: number; y: number; z: number }[] {
  const k = PARK.kickers[i];
  const out: { x: number; y: number; z: number }[] = [];
  const end = k.z + Math.max(CONFIG.replayTvSwitchAfter, k.landingStart + LANDING.knuckle + LANDING.steep);
  for (let z = k.z - CONFIG.replayTvNear; z <= end; z += 2) out.push({ x: 0, y: heightAt(0, z) + CONFIG.camLookHeight, z });
  return out;
}

const spots = new Map<number, { x: number; y: number; z: number }>();

/**
 * Hvor TV-kameraet står ved hopp nr. i: til siden (innenfor bakken), litt etter kanten, over snøen.
 * Løftes til det ser skiløperen hele veien inn over hoppet (rampen og kanten står ellers i veien).
 */
export function tvSpot(i: number): { x: number; y: number; z: number } {
  const hit = spots.get(i);
  if (hit) return hit;
  const k = PARK.kickers[i];
  const x = Math.min(CONFIG.replayTvSide, PARK.width / 2 - 1);
  const z = k.z + CONFIG.replayTvAlong;
  const ground = heightAt(x, z);
  const pts = approachPoints(i);
  let up = CONFIG.replayTvHeight;
  while (up < CONFIG.replayTvLiftMax && !pts.every((p) => sightClear({ x, y: ground + up, z }, p))) up += CONFIG.replayTvLiftStep;
  const spot = { x, y: ground + up, z };
  spots.set(i, spot);
  return spot;
}

/**
 * Skal TV-kameraet vise noe nå, eller er skiløperen så langt unna hoppet at bak-kameraet er bedre?
 * Før hoppet: nærmere enn replayTvNear. Etter det siste hoppet: til du står på snøen godt forbi landingen.
 */
export function tvActive(i: number, z: number, grounded = true): boolean {
  const k = PARK.kickers[i];
  if (z < k.z - CONFIG.replayTvNear) return false;
  return !(grounded && z > k.z + CONFIG.replayTvSwitchAfter);
}

export function createReplayCam() {
  const rig = createCameraRig();
  const pose: CameraPose = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, fov: CONFIG.camFovBase };
  let lastKind: ReplayCamKind | null = null;
  let kicker = -1;
  let wasTv = false;

  return {
    /**
     * Kalles hvert bilde. cut = skiløperen ble flyttet (ny runde, fall), eller vinkelen er nettopp byttet.
     * grounded: står skiløperen på snøen (TV-kameraet bytter hopp bare da).
     */
    update(kind: ReplayCamKind, inp: CameraInput & { grounded?: boolean }, dt: number): CameraPose {
      const cut = !!inp.cut || kind !== lastKind;
      lastKind = kind;
      if (cut) kicker = -1;
      kicker = nextTvKicker(kicker, inp.z, inp.grounded ?? true);
      const useTv = kind === 'tv' && tvActive(kicker, inp.z, inp.grounded ?? true);
      // bak-riggen går alltid (også når TV viser), så den er klar når TV-kameraet bytter tilbake til den
      const back = rig.update({ ...inp, cut: cut || (wasTv && !useTv) }, dt);
      wasTv = useTv;
      if (kind === 'bak' || (kind === 'tv' && !useTv)) return back;
      // de andre ser på skiløperen
      pose.lx = inp.x; pose.ly = inp.y + CONFIG.camLookHeight; pose.lz = inp.z;
      if (kind === 'tv') {
        const s = tvSpot(kicker);
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
