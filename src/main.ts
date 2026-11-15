import * as THREE from 'three';
import { CONFIG } from './core/config';
import { createLoop } from './core/loop';
import { speedOf } from './physics/skier';
import { createInput } from './input/input';
import { createChaseCamera } from './camera/chase';
import { createScene } from './render/scene';
import { createHud } from './ui/hud';
import { createPlaceholderSkier } from './character/placeholder';
import { heightAt, normalAt } from './park/terrain';
import { poseFor, smoothPose } from './character/pose';
import { createSkiTrails } from './render/trailMesh';
import { createGame, skisOnSnow, stepGame, type Move } from './core/game';
import { fadeAmount, fallBody, landingWobble } from './tricks/fall';
import { isSwitch } from './tricks/rotation';

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

const game = createGame();
let prev = { ...game.skier };
let prevTricks = { ...game.tricks };
// om skiløperen ble flyttet siden forrige bilde: 'restart' (ny runde) eller 'respawn' (satt tilbake etter fall)
let moved: Move = 'restart';
const startZ = game.skier.z;

const target = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const wantUp = new THREE.Vector3();
const q = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const standingPose = () => {
  const p = poseFor({ grounded: true, popCharge: 0, airTime: 0, heightAboveSnow: 0, sinceLanding: 99 });
  return smoothPose(p, p, 0);
};
let pose = standingPose();

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    prev = { ...game.skier };
    prevTricks = { ...game.tricks };
    // taster, fysikk, triks og fall (se core/game.ts). Flyttet skiløperen seg langt, jevnes det ikke ut.
    const m = stepGame(game, input.read(), input.pressed('KeyR'), dt);
    if (m !== 'none') {
      // ny runde viktigst: den nullstiller også kroppsstillingen
      if (moved !== 'restart') moved = m;
      prev = { ...game.skier };
      prevTricks = { ...game.tricks };
    }
    if (m === 'restart') { pose = standingPose(); up.copy(Y); }
  },
  render(alpha, frameDt) {
    const { skier, tricks, fall } = game;
    target.set(
      prev.x + (skier.x - prev.x) * alpha,
      prev.y + (skier.y - prev.y) * alpha,
      prev.z + (skier.z - prev.z) * alpha,
    );
    mesh.position.copy(target);
    // på bakken står skiløperen vinkelrett på snøen; i lufta glir den mykt over til å stå rett opp
    const [nx, ny, nz] = skier.grounded ? normalAt(target.x, target.z) : [0, 1, 0];
    wantUp.set(nx, ny, nz);
    up.lerp(wantUp, 1 - Math.exp(-CONFIG.bodyUpFollow * frameDt)).normalize();
    q.setFromUnitVectors(Y, up);
    // retningen jevnes ut mellom fysikkstegene, som posisjonen, så svingene ikke rister
    const heading = prev.heading + (skier.heading - prev.heading) * alpha;
    qYaw.setFromAxisAngle(Y, heading);
    mesh.quaternion.copy(q).multiply(qYaw);
    // spinn og flip jevnes ut mellom stegene; kameraet får dem ikke, så det snurrer ikke med
    const spin = prevTricks.spin + (tricks.spin - prevTricks.spin) * alpha;
    // fall: kroppen velter og synker ned i snøen; slurvete landing: kroppen vakler litt
    const body = fallBody(fall), wobble = landingWobble(fall);
    skierModel.setTrick(spin, prevTricks.flip + (tricks.flip - prevTricks.flip) * alpha, body.roll);
    skierModel.setFallDrop(body.drop);
    // leningen er i kroppens retning: kjører du baklengs (switch), må den snus for å lene inn i svingen
    // Bruker stillingen du sto i (ikke spinnet underveis), så leningen ikke svaier mens du spinner
    skierModel.setLean((prev.lean + (skier.lean - prev.lean) * alpha) * (isSwitch(tricks) ? -1 : 1) + wobble.roll);
    // kroppen glir mellom stillingene, så avspark og landing ikke rykker
    pose = smoothPose(pose, poseFor({
      grounded: skier.grounded, popCharge: skier.popCharge, airTime: skier.airTime,
      heightAboveSnow: target.y - heightAt(target.x, target.z), sinceLanding: skier.sinceLanding,
    }), frameDt);
    skierModel.setGrab(tricks.grabs.blend, pose.skiLift);
    skierModel.setPose({ ...pose, pitch: pose.pitch + body.pitch + wobble.pitch });
    trails.update(target.x, target.y, target.z, heading, skisOnSnow(game), moved);

    sun.position.set(target.x + 30, target.y + 60, target.z - 20);
    sun.target.position.copy(target);

    // den ekte farten: landingene følger flybanen, så den holder seg når du lander
    const v = speedOf(skier);
    chase.update({ x: target.x, y: target.y, z: target.z, vx: skier.vx, vz: skier.vz, heading, speed: v, cut: moved !== 'none' }, frameDt);
    hud.update({
      speed: v, distance: skier.z - startZ, airTime: skier.airTime, inAir: !skier.grounded,
      popCharge: skier.popCharge, lastPop: skier.lastPop, popAge: skier.popAge,
      landing: tricks.lastLanding, landingAge: tricks.landingAge, fade: fadeAmount(fall),
      score: game.score, best: game.best, grab: tricks.grabs.held, grabTime: tricks.grabs.holdTime,
    }, frameDt);
    moved = 'none';
    renderer.render(scene, chase.camera);
  },
});
loop.start();
