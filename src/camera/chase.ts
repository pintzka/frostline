import * as THREE from 'three';
import { CONFIG } from '../core/config';
import { heightAt } from '../park/terrain';

/**
 * Følgekamera: lavt og nært bak skiløperen, FOV øker med farten.
 * Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 */
export function createChaseCamera(aspect: number) {
  const cam = new THREE.PerspectiveCamera(CONFIG.camFovBase, aspect, 0.1, 2000);
  const pos = new THREE.Vector3(0, 10, -10);
  const look = new THREE.Vector3();
  let yaw = 0;

  return {
    camera: cam,
    update(target: THREE.Vector3, heading: number, speed: number, dt: number) {
      // myk oppfølging av retning
      let d = heading - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw += d * Math.min(1, dt * 4);

      const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(CONFIG.camDistance);
      const want = target.clone().add(back);
      want.y = Math.max(want.y, heightAt(want.x, want.z)) + CONFIG.camHeight;
      pos.lerp(want, Math.min(1, dt * 8));
      cam.position.copy(pos);

      look.copy(target).add(new THREE.Vector3(Math.sin(yaw) * 3, 0.8, Math.cos(yaw) * 3));
      cam.lookAt(look);

      const t = Math.min(1, speed / CONFIG.maxSpeed);
      const fov = CONFIG.camFovBase + (CONFIG.camFovMax - CONFIG.camFovBase) * t * t;
      if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    },
    resize(a: number) { cam.aspect = a; cam.updateProjectionMatrix(); },
  };
}
