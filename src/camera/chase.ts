import * as THREE from 'three';
import { CONFIG } from '../core/config';
import { createCameraRig, type CameraInput } from './rig';

/**
 * Følgekamera: lavt og nært bak skiløperen, FOV øker med farten.
 * Selve logikken ligger i rig.ts (testbar); her flyttes bare three.js-kameraet.
 * Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 */
export function createChaseCamera(aspect: number) {
  const cam = new THREE.PerspectiveCamera(CONFIG.camFovBase, aspect, 0.1, 2000);
  const rig = createCameraRig();

  return {
    camera: cam,
    update(inp: CameraInput, dt: number) {
      const p = rig.update(inp, dt);
      cam.position.set(p.px, p.py, p.pz);
      cam.lookAt(p.lx, p.ly, p.lz);
      if (Math.abs(cam.fov - p.fov) > 0.01) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
    },
    resize(a: number) { cam.aspect = a; cam.updateProjectionMatrix(); },
  };
}
