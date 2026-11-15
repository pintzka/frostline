import * as THREE from 'three';
import type { Game, Move } from '../core/game';
import type { SkierState } from '../physics/skier';
import type { TrickState } from '../tricks/rotation';
import { isSwitch } from '../tricks/rotation';
import { fallBody, landingWobble } from '../tricks/fall';
import { heightAt, normalAt } from '../park/terrain';
import { createPlaceholderSkier } from './placeholder';
import { followLeanSign, poseFor, smoothPose } from './pose';
import { createTilt, stepTilt } from './tilt';

/**
 * Tegner skiløperen: posisjon og retning jevnet ut mellom fysikkstegene, tipping mot snøen,
 * kroppsstilling, spinn/flip, grabs, fall og vakling. Arbeidsstrøm 4 (Karakter og animasjon) eier denne fila.
 */
export function createSkierView(scene: THREE.Scene) {
  const model = createPlaceholderSkier();
  scene.add(model.root);

  const target = new THREE.Vector3();
  const up = new THREE.Vector3();
  const tilt = createTilt();
  const q = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  const standingPose = () => {
    const p = poseFor({ grounded: true, popCharge: 0, airTime: 0, heightAboveSnow: 0, sinceLanding: 99 });
    return smoothPose(p, p, 0);
  };
  let pose = standingPose();
  let leanSign = 1;

  return {
    /** Skiløperen ble flyttet: kroppen står rett på snøen med en gang, og ny runde starter i stående stilling. */
    moved(m: Move) {
      if (m === 'none') return;
      Object.assign(tilt, createTilt());
      if (m === 'restart') { pose = standingPose(); leanSign = 1; }
    },

    /** Kalles hvert bilde. Gir hvor skiløperen tegnes og hvilken vei den peker. */
    update(g: Game, prev: SkierState, prevTricks: TrickState, alpha: number, frameDt: number) {
      const { skier, tricks, fall } = g;
      target.set(
        prev.x + (skier.x - prev.x) * alpha,
        prev.y + (skier.y - prev.y) * alpha,
        prev.z + (skier.z - prev.z) * alpha,
      );
      model.root.position.copy(target);
      // vinkelrett på snøen på bakken, rett opp høyt i lufta, og tipper mykt mot snøen før landing
      const snowY = heightAt(target.x, target.z);
      const normal = normalAt(target.x, target.z);
      const [ux, uy, uz] = stepTilt(tilt, { grounded: skier.grounded, heightAboveSnow: target.y - snowY, vy: skier.vy, normal }, frameDt);
      q.setFromUnitVectors(Y, up.set(ux, uy, uz));
      // retningen jevnes ut mellom fysikkstegene, som posisjonen, så svingene ikke rister
      const heading = prev.heading + (skier.heading - prev.heading) * alpha;
      qYaw.setFromAxisAngle(Y, heading);
      model.root.quaternion.copy(q).multiply(qYaw);
      // spinn og flip jevnes ut mellom stegene; kameraet får dem ikke, så det snurrer ikke med
      const spin = prevTricks.spin + (tricks.spin - prevTricks.spin) * alpha;
      // fall: kroppen velter og synker ned i snøen; slurvete landing: kroppen vakler litt
      const body = fallBody(fall), wobble = landingWobble(fall);
      model.setTrick(spin, prevTricks.flip + (tricks.flip - prevTricks.flip) * alpha, body.roll);
      model.setFallDrop(body.drop);
      // leningen er i kroppens retning: kjører du baklengs (switch), må den snus for å lene inn i svingen.
      // Bruker stillingen du sto i (ikke spinnet underveis), så leningen ikke svaier mens du spinner.
      // Fortegnet glir mykt, så leningen ikke rykker når du lander switch
      leanSign = followLeanSign(leanSign, isSwitch(tricks), frameDt);
      model.setLean((prev.lean + (skier.lean - prev.lean) * alpha) * leanSign + wobble.roll);
      // kroppen glir mellom stillingene, så avspark og landing ikke rykker
      pose = smoothPose(pose, poseFor({
        grounded: skier.grounded, popCharge: skier.popCharge, airTime: skier.airTime,
        heightAboveSnow: target.y - snowY, sinceLanding: skier.sinceLanding,
      }), frameDt);
      model.setGrab(tricks.grabs.blend, pose.skiLift);
      model.setPose({ ...pose, pitch: pose.pitch + body.pitch + wobble.pitch });
      return { at: target, heading, normal: { x: normal[0], y: normal[1], z: normal[2] } };
    },
  };
}
