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
import { poseFor, smoothPose } from './character/pose';
import { createTilt, stepTilt } from './character/tilt';
import { createSkiTrails } from './render/trailMesh';
import { createTricks, stepTricks } from './tricks/rotation';
import { createLatch, splitControls } from './tricks/controls';

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
let tricks = createTricks();
let prevTricks = { ...tricks };
const latch = createLatch();
const startZ = skier.z;

const target = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const tilt = createTilt();
const q = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
let pose = smoothPose(poseFor({ grounded: true, popCharge: 0, airTime: 0, heightAboveSnow: 0, sinceLanding: 99 }), poseFor({ grounded: true, popCharge: 0, airTime: 0, heightAboveSnow: 0, sinceLanding: 99 }), 0);

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    // R, eller slutten av bakken: ny runde med en gang
    if (input.pressed('KeyR') || reachedEnd(skier)) { skier = createSkier(); tricks = createTricks(); }
    prev = { ...skier };
    prevTricks = { ...tricks };
    // på bakken styrer tastene skiene, i lufta spinner og flipper de
    const c = splitControls(input.read(), skier.grounded, latch);
    stepSkier(skier, c.skier, dt);
    stepTricks(tricks, { spin: c.spin, flip: c.flip, grounded: skier.grounded }, dt);
  },
  render(alpha, frameDt) {
    target.set(
      prev.x + (skier.x - prev.x) * alpha,
      prev.y + (skier.y - prev.y) * alpha,
      prev.z + (skier.z - prev.z) * alpha,
    );
    mesh.position.copy(target);
    // vinkelrett på snøen på bakken, rett opp høyt i lufta, og tipper mykt mot snøen før landing
    const snowY = heightAt(target.x, target.z);
    const [ux, uy, uz] = stepTilt(tilt, { grounded: skier.grounded, heightAboveSnow: target.y - snowY, vy: skier.vy, normal: normalAt(target.x, target.z) }, frameDt);
    q.setFromUnitVectors(Y, up.set(ux, uy, uz));
    // retningen jevnes ut mellom fysikkstegene, som posisjonen, så svingene ikke rister
    const heading = prev.heading + (skier.heading - prev.heading) * alpha;
    qYaw.setFromAxisAngle(Y, heading);
    mesh.quaternion.copy(q).multiply(qYaw);
    // spinn og flip jevnes ut mellom stegene; kameraet får dem ikke, så det snurrer ikke med
    const spin = prevTricks.spin + (tricks.spin - prevTricks.spin) * alpha;
    skierModel.setTrick(spin, prevTricks.flip + (tricks.flip - prevTricks.flip) * alpha);
    // leningen er i kroppens retning: kjører du baklengs (switch), må den snus for å lene inn i svingen
    skierModel.setLean((prev.lean + (skier.lean - prev.lean) * alpha) * Math.cos(spin));
    // kroppen glir mellom stillingene, så avspark og landing ikke rykker
    pose = smoothPose(pose, poseFor({
      grounded: skier.grounded, popCharge: skier.popCharge, airTime: skier.airTime,
      heightAboveSnow: target.y - snowY, sinceLanding: skier.sinceLanding,
    }), frameDt);
    skierModel.setPose(pose);
    trails.update(target.x, target.y, target.z, heading, skier.grounded);

    sun.position.set(target.x + 30, target.y + 60, target.z - 20);
    sun.target.position.copy(target);

    // den ekte farten: landingene følger flybanen, så den holder seg når du lander
    const v = speedOf(skier);
    chase.update({ x: target.x, y: target.y, z: target.z, vx: skier.vx, vz: skier.vz, heading, speed: v }, frameDt);
    hud.update({
      speed: v, distance: skier.z - startZ, airTime: skier.airTime, inAir: !skier.grounded,
      popCharge: skier.popCharge, lastPop: skier.lastPop, popAge: skier.popAge,
      landing: tricks.lastLanding, landingAge: tricks.landingAge,
    });
    renderer.render(scene, chase.camera);
  },
});
loop.start();
