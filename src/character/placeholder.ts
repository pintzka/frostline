import * as THREE from 'three';

/**
 * Midlertidig skiløper (bokser). Byttes ut med ekte modell i arbeidsstrøm 4 (Karakter og animasjon).
 */
export function createPlaceholderSkier() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff5a36, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 12), mat);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0x223344 }));
  head.position.y = 1.75;
  const skiMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24 });
  for (const sx of [-0.15, 0.15]) {
    const ski = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 1.7), skiMat);
    ski.position.set(sx, 0.02, 0);
    g.add(ski);
  }
  g.add(body, head);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}
