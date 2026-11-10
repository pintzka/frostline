import * as THREE from 'three';
import { CONFIG } from '../core/config';

/**
 * Midlertidig skiløper (bokser). Byttes ut med ekte modell i arbeidsstrøm 4 (Karakter og animasjon).
 * Kroppen lener seg rundt føttene, mens skiene blir liggende på snøen og bare vipper litt på kanten.
 */
export function createPlaceholderSkier() {
  const root = new THREE.Group();
  const upper = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff5a36, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 12), mat);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0x223344 }));
  head.position.y = 1.75;
  upper.add(body, head);

  const skiMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24 });
  const skis: THREE.Mesh[] = [];
  for (const sx of [-CONFIG.skiGap / 2, CONFIG.skiGap / 2]) {
    const ski = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, CONFIG.skiLength), skiMat);
    ski.position.set(sx, 0.02, 0);
    skis.push(ski);
  }
  root.add(upper, ...skis);
  root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });

  return {
    root,
    /** Lener kroppen inn i svingen (rad, positiv = mot høyre). Skiene vipper bare litt på kanten. */
    setLean(lean: number) {
      upper.rotation.z = lean;
      for (const ski of skis) ski.rotation.z = lean * CONFIG.skiEdgeTilt;
    },
  };
}
