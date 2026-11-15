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

  // armer: henger fra skuldrene og kan strekke seg mot skiene i en grab
  const armGeo = new THREE.BoxGeometry(0.09, 0.7, 0.09);
  const arms: THREE.Group[] = [];
  for (const ax of [-0.33, 0.33]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(ax, 1.32, 0);
    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.y = -0.35;
    shoulder.add(arm);
    upper.add(shoulder);
    arms.push(shoulder);
  }
  const [rightArm, leftArm] = arms;

  const skiMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24 });
  const skis: THREE.Mesh[] = [];
  for (const sx of [-CONFIG.skiGap / 2, CONFIG.skiGap / 2]) {
    const ski = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, CONFIG.skiLength), skiMat);
    ski.position.set(sx, 0.02, 0);
    skis.push(ski);
  }
  // triks roterer hele kroppen (med ski) rundt midten av kroppen, ikke rundt føttene
  const pivot = new THREE.Group();
  const qRoll = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  pivot.position.y = CONFIG.trickPivotHeight;
  const inner = new THREE.Group();
  inner.position.y = -CONFIG.trickPivotHeight;
  inner.add(upper, ...skis);
  pivot.add(inner);
  root.add(pivot);
  root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });

  // hvor mye hver grab bøyer kroppen. Bøyen glir mykt (tricks/grabs.ts), så figuren hopper aldri.
  let grabDrop = 0, grabPitch = 0, grabLift = 0;

  return {
    root,
    /**
     * Grab fra tricks/grabs.ts: blend er hvor mye hver av de tre grabbene holdes (0–1).
     * tuck er hvor høyt skiene er trukket opp (fra pose.ts); nær snøen senkes skiene igjen før landing.
     * 1 Nordlys: høyre hånd fram til skituppene. 2 Isbit: begge hender ned til midten. 3 Snøugle: venstre hånd bak til hælene.
     */
    setGrab(blend: readonly number[], tuck: number) {
      const [a, b, c] = blend;
      grabPitch = 0.35 * a + 0.45 * b + 0.12 * c;
      grabDrop = 0.12 * a + 0.22 * b + 0.08 * c;
      grabLift = 0.18 * Math.min(1, a + b + c) * Math.min(1, Math.max(0, tuck / 0.3));
      // armene: negativ x-rotasjon er fram, positiv er bak
      rightArm.rotation.set(-0.15 - 1.25 * a - 0.45 * b, 0, -0.12 + 0.1 * b);
      leftArm.rotation.set(-0.15 - 0.45 * b + 1.0 * c, 0, 0.12 - 0.1 * b);
      upper.rotation.y = 0.3 * c - 0.15 * a;
    },
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
     * Kroppens stilling som kvaternion [x, y, z, w] fra tricks/offaxis.ts (brukes også for off-axis),
     * med fallets velt (roll, rad) rundt kroppens egen akse til slutt.
     */
    setTrickQuat(q: readonly [number, number, number, number], roll = 0) {
      pivot.quaternion.set(q[0], q[1], q[2], q[3]).multiply(qRoll.setFromAxisAngle(Z, roll));
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
      upper.position.y = -(p.drop + grabDrop);
      upper.rotation.x = p.pitch + grabPitch;
      for (const ski of skis) ski.position.y = 0.02 + p.skiLift + grabLift;
    },
  };
}
