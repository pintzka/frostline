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
  // triks roterer hele kroppen (med ski) rundt midten av kroppen, ikke rundt føttene
  const pivot = new THREE.Group();
  pivot.position.y = CONFIG.trickPivotHeight;
  const inner = new THREE.Group();
  inner.position.y = -CONFIG.trickPivotHeight;
  inner.add(upper, ...skis);
  pivot.add(inner);
  root.add(pivot);
  root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });

  return {
    root,
    /** Lener kroppen inn i svingen (rad, positiv = mot høyre). Skiene vipper bare litt på kanten. */
    setLean(lean: number) {
      upper.rotation.z = lean;
      for (const ski of skis) ski.rotation.z = lean * CONFIG.skiEdgeTilt;
    },
    /**
     * Spinn og flip fra tricks/rotation.ts (rad). Spinn positiv = mot høyre, flip positiv = framover.
     * Spinnet er rundt den loddrette aksen, flipen rundt kroppens egen sideakse.
     */
    setTrick(spin: number, flip: number, roll = 0) {
      pivot.rotation.set(flip, -spin, roll, 'YXZ');
    },
    /**
     * Fall fra tricks/fall.ts: kroppen velter til siden (roll, rad) og synker ned mot snøen (drop, m).
     * Brukes sammen med setTrick, som tar imot roll.
     */
    setFallDrop(drop: number) {
      pivot.position.y = CONFIG.trickPivotHeight - drop;
    },
    /**
     * Hopp-bevegelsen fra pose.ts: kroppen går ned (sats/landing) eller strekker seg opp (avspark),
     * og skiene trekkes opp under kroppen i lufta. Formen på kroppen endres ikke.
     */
    setPose(p: { drop: number; pitch: number; skiLift: number }) {
      upper.position.y = -p.drop;
      upper.rotation.x = p.pitch;
      for (const ski of skis) ski.position.y = 0.02 + p.skiLift;
    },
  };
}
