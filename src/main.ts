import * as THREE from 'three';
import { CONFIG } from './core/config';
import { createLoop } from './core/loop';
import { createSkier, reachedEnd, speedOf, stepSkier } from './physics/skier';
import { createInput } from './input/input';
import { createChaseCamera } from './camera/chase';
import { createScene } from './render/scene';
import { createHud } from './ui/hud';
import { createPlaceholderSkier } from './character/placeholder';
import { heightAt, normalAt } from './park/terrain';
import { poseFor } from './character/pose';
import { createSkiTrails } from './render/trailMesh';

const root = document.getElementById('app')!;
const { renderer, scene, sun } = createScene(root);
const chase = createChaseCamera(innerWidth / innerHeight);
addEventListener('resize', () => chase.resize(innerWidth / innerHeight));
const input = createInput(renderer.domElement);
const hud = createHud(root);

const skierModel = createPlaceholderSkier();
const mesh = skierModel.root;
scene.add(mesh);
const trails = createSkiTrails(scene);

let skier = createSkier();
let prev = { ...skier };
const startZ = skier.z;

const target = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const wantUp = new THREE.Vector3();
const q = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    // R, eller slutten av bakken: ny runde med en gang
    if (input.pressed('KeyR') || reachedEnd(skier)) { skier = createSkier(); }
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
    // på bakken står skiløperen vinkelrett på snøen; i lufta glir den mykt over til å stå rett opp
    const [nx, ny, nz] = skier.grounded ? normalAt(target.x, target.z) : [0, 1, 0];
    wantUp.set(nx, ny, nz);
    up.lerp(wantUp, 1 - Math.exp(-12 * frameDt)).normalize();
    q.setFromUnitVectors(Y, up);
    qYaw.setFromAxisAngle(Y, skier.heading);
    mesh.quaternion.copy(q).multiply(qYaw);
    skierModel.setLean(prev.lean + (skier.lean - prev.lean) * alpha);
    skierModel.setPose(poseFor({
      grounded: skier.grounded, popCharge: skier.popCharge, airTime: skier.airTime,
      heightAboveSnow: target.y - heightAt(target.x, target.z), sinceLanding: skier.sinceLanding,
    }));
    trails.update(target.x, target.y, target.z, skier.heading, skier.grounded);

    sun.position.set(target.x + 30, target.y + 60, target.z - 20);
    sun.target.position.copy(target);

    const v = speedOf(skier);
    chase.update({ x: target.x, y: target.y, z: target.z, vx: skier.vx, vz: skier.vz, heading: skier.heading, speed: v }, frameDt);
    hud.update({
      speed: v, distance: skier.z - startZ, airTime: skier.airTime, inAir: !skier.grounded,
      popCharge: skier.popCharge, lastPop: skier.lastPop, popAge: skier.popAge,
    });
    renderer.render(scene, chase.camera);
  },
});
loop.start();
