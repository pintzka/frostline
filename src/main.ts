import * as THREE from 'three';
import { CONFIG } from './core/config';
import { createLoop } from './core/loop';
import { speedOf } from './physics/skier';
import { createInput } from './input/input';
import { createChaseCamera } from './camera/chase';
import { createScene } from './render/scene';
import { createHud } from './ui/hud';
import { createMenu } from './ui/menu';
import { createGame, stepGame } from './ui/flow';
import { createPlaceholderSkier } from './character/placeholder';
import { heightAt, normalAt } from './park/terrain';
import { poseFor, smoothPose } from './character/pose';
import { createSkiTrails } from './render/trailMesh';

const root = document.getElementById('app')!;
const { renderer, scene, sun } = createScene(root);
const chase = createChaseCamera(innerWidth / innerHeight);
addEventListener('resize', () => chase.resize(innerWidth / innerHeight));
const input = createInput(renderer.domElement);
const hud = createHud(root);
const menu = createMenu(root);

const skierModel = createPlaceholderSkier();
const mesh = skierModel.root;
scene.add(mesh);
const trails = createSkiTrails(scene);

// startskjerm → kjører → resultat: se ui/flow.ts
const game = createGame();
let skier = game.skier, tricks = game.tricks;
let prev = { ...skier };
let prevTricks = { ...tricks };
const startZ = skier.z;

const target = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const wantUp = new THREE.Vector3();
const q = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
let pose = smoothPose(poseFor({ grounded: true, popCharge: 0, airTime: 0, heightAboveSnow: 0, sinceLanding: 99 }), poseFor({ grounded: true, popCharge: 0, airTime: 0, heightAboveSnow: 0, sinceLanding: 99 }), 0);

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    prev = { ...game.skier };
    prevTricks = { ...game.tricks };
    const ev = stepGame(game, { raw: input.read(), click: menu.takeClick(), restart: input.pressed('KeyR') }, dt);
    // ny runde: start fra toppen uten å gli mellom gammel og ny plass
    if (ev === 'ny-runde') { prev = { ...game.skier }; prevTricks = { ...game.tricks }; }
    if (ev) menu.onEvent(ev, game.flow);
    skier = game.skier; tricks = game.tricks;
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
      heightAboveSnow: target.y - heightAt(target.x, target.z), sinceLanding: skier.sinceLanding,
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
    hud.setOpacity(menu.update(game.flow, frameDt));
    renderer.render(scene, chase.camera);
  },
});
loop.start();
