import * as THREE from 'three';
import { CONFIG } from './core/config';
import { createLoop } from './core/loop';
import { createSkier, speedOf, stepSkier } from './physics/skier';
import { createInput } from './input/input';
import { createChaseCamera } from './camera/chase';
import { createScene } from './render/scene';
import { createHud } from './ui/hud';
import { createPlaceholderSkier } from './character/placeholder';
import { normalAt } from './park/terrain';

const root = document.getElementById('app')!;
const { renderer, scene, sun } = createScene(root);
const chase = createChaseCamera(innerWidth / innerHeight);
addEventListener('resize', () => chase.resize(innerWidth / innerHeight));
const input = createInput(renderer.domElement);
const hud = createHud(root);

const mesh = createPlaceholderSkier();
scene.add(mesh);

let skier = createSkier();
let prev = { ...skier };
const startZ = skier.z;

const target = new THREE.Vector3();
const up = new THREE.Vector3();
const q = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    if (input.pressed('KeyR')) { skier = createSkier(); }
    prev = { ...skier };
    stepSkier(skier, input.read(), dt);
  },
  render(alpha, frameDt) {
    target.set(
      prev.x + (skier.x - prev.x) * alpha,
      prev.y + (skier.y - prev.y) * alpha,
      prev.z + (skier.z - prev.z) * alpha,
    );
    mesh.position.copy(target);
    const [nx, ny, nz] = normalAt(target.x, target.z);
    up.set(nx, ny, nz);
    q.setFromUnitVectors(Y, up);
    qYaw.setFromAxisAngle(Y, skier.heading);
    mesh.quaternion.copy(q).multiply(qYaw);

    sun.position.set(target.x + 30, target.y + 60, target.z - 20);
    sun.target.position.copy(target);

    const v = speedOf(skier);
    chase.update(target, skier.heading, v, frameDt);
    hud.update(v, skier.z - startZ);
    renderer.render(scene, chase.camera);
  },
});
loop.start();
