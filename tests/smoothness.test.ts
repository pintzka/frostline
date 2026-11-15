import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createCameraRig, type CameraPose } from '../src/camera/rig';
import { createSkier, speedOf, stepSkier, type SkierState } from '../src/physics/skier';
import { heightAt, normalAt, PARK } from '../src/park/terrain';
import { createTilt, stepTilt } from '../src/character/tilt';

/**
 * Brå overganger Daniel har sett (eller ville sett): kroppen som nikker ved landing,
 * kameraet som svinger voldsomt i lav fart, kameraet som stiger høyt på landingen, og bremsen som er av/på.
 */
const dt = 1 / CONFIG.physicsHz;
const DEG = 180 / Math.PI;
/** Hodet sitter så høyt over føttene (m). */
const HEAD = 1.75;

function camInput(s: SkierState) {
  return { x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, heading: s.heading, speed: speedOf(s) };
}

/** Kjør hele bakken rett ned (fysikk i 240 Hz) og kall onFrame for hvert bilde med gitt bildefrekvens. */
function rideDown(fps: number, onFrame: (s: SkierState, frameDt: number) => void) {
  const s = createSkier();
  const steps = Math.round(CONFIG.physicsHz / fps);
  for (let i = 1; i < 60 * CONFIG.physicsHz && s.z < PARK.length - 50; i++) {
    stepSkier(s, { steer: 0, brake: 0 }, dt);
    if (i % steps === 0) onFrame(s, steps * dt);
  }
  return s;
}

describe('kroppen ved landing', () => {
  // Før: kroppen snudde 7° på første bilde etter landing på det store hoppet (hodet flyttet seg 21 cm),
  // og 13° (40 cm) ved 30 fps. Nå tipper kroppen mot snøen mens den nærmer seg, og glir på plass.
  for (const [fps, maxDeg] of [[60, 2], [30, 4]] as const) {
    it(`snur maks ${maxDeg}° per bilde gjennom alle hoppene ved ${fps} fps`, () => {
      const tilt = createTilt();
      let last: number[] | null = null;
      let worstDeg = 0, worstHead = 0;
      rideDown(fps, (s, frameDt) => {
        const up = stepTilt(tilt, {
          grounded: s.grounded, heightAboveSnow: s.y - heightAt(s.x, s.z), vy: s.vy, normal: normalAt(s.x, s.z),
        }, frameDt);
        // første bilde: kroppen settes rett på plass
        if (!last) { last = [...up]; return; }
        const dot = Math.min(1, up[0] * last[0] + up[1] * last[1] + up[2] * last[2]);
        worstDeg = Math.max(worstDeg, Math.acos(dot) * DEG);
        worstHead = Math.max(worstHead, HEAD * Math.hypot(up[0] - last[0], up[1] - last[1], up[2] - last[2]));
        last = [...up];
      });
      expect(worstDeg).toBeLessThan(maxDeg);
      // hodet flytter seg i forhold til føttene maks så mye per bilde
      expect(worstHead).toBeLessThan((maxDeg / DEG) * HEAD);
    });
  }

  it('står vinkelrett på snøen på bakken og nesten rett opp høyt i lufta', () => {
    const tilt = createTilt();
    const n = normalAt(0, 100);
    let up: readonly number[] = [0, 1, 0];
    for (let i = 0; i < 120; i++) up = stepTilt(tilt, { grounded: true, heightAboveSnow: 0, vy: 0, normal: n }, 1 / 60);
    expect(up[1]).toBeCloseTo(n[1], 3);
    for (let i = 0; i < 120; i++) up = stepTilt(tilt, { grounded: false, heightAboveSnow: 6, vy: -5, normal: n }, 1 / 60);
    expect(up[1]).toBeGreaterThan(0.999);
  });
});

describe('kameraet i lav fart', () => {
  /** Hvor mye kameraets retning (fra kameraet mot skiløperen) vrir seg på ett bilde, i grader. */
  function yawOf(p: CameraPose, s: SkierState) {
    return Math.atan2(s.x - p.px, s.z - p.pz);
  }

  // Før: opptil 7,4° på ett bilde (målt her) når du starter med styring holdt, snur i lav fart og styrer tilbake;
  // kvalitetskontrollen målte 10,5°. Nå vrir kameraet seg aldri mer enn camMaxYawRate.
  it('vrir seg maks 2,5° per bilde (60 fps) når du starter med styring holdt og snur (60 og 30 fps)', () => {
    let worst = 0;
    for (const fps of [60, 30]) for (let turnBack = 0; turnBack < 4; turnBack += 0.25) {
      const s = createSkier();
      const rig = createCameraRig();
      let last = yawOf(rig.update(camInput(s), 0), s);
      const steps = CONFIG.physicsHz / fps;
      for (let f = 0; f < 5 * fps; f++) {
        const steer = f / fps < turnBack ? 1 : -1;
        for (let i = 0; i < steps; i++) stepSkier(s, { steer, brake: 0 }, dt);
        const yaw = yawOf(rig.update(camInput(s), steps * dt), s);
        // gjort om til grader per bilde ved 60 fps, så 30 fps måles likt
        worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(yaw - last), Math.cos(yaw - last))) * DEG * (fps / 60));
        last = yaw;
      }
    }
    expect(worst).toBeLessThan(2.5);
  });

  it('svinger rolig når skiene og farten peker hver sin vei i lav fart', () => {
    const rig = createCameraRig();
    // farten øker fra 1 til 5 m/s rett ned bakken, mens skiene peker nesten bakover
    let pose = rig.update({ x: 0, y: 0, z: 0, vx: 0, vz: 1, heading: 2.8, speed: 1 }, 0);
    let last = Math.atan2(-pose.px, -pose.pz);
    let worst = 0;
    for (let f = 0; f < 120; f++) {
      const v = 1 + (4 * f) / 120;
      pose = rig.update({ x: 0, y: 0, z: 0, vx: 0, vz: v, heading: 2.8 + 0.01 * f, speed: v }, 1 / 60);
      const yaw = Math.atan2(-pose.px, -pose.pz);
      worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(yaw - last), Math.cos(yaw - last))) * DEG);
      last = yaw;
    }
    expect(worst).toBeLessThanOrEqual(CONFIG.camMaxYawRate * DEG / 60 + 1e-6);
  });
});

describe('kamerahøyden gjennom hoppene', () => {
  // Før: kameraet endte 6,8 m over skiløperen på landingen av det store hoppet (2 m over snøen bak,
  // som der er 4,9 m høyere enn skiløperen), og en klamp mot snøen tok over midt i lufta og ga en knekk.
  it('holder seg 1,5–3,5 m over skiløperen, og bare så høyt som snøen bak krever', () => {
    const rig = createCameraRig();
    let first = true;
    let lowest = Infinity, worstExtra = -Infinity, lowestClear = Infinity;
    rideDown(60, (s, frameDt) => {
      const p = rig.update(camInput(s), first ? 0 : frameDt);
      first = false;
      const above = p.py - s.y;
      const snowBehind = heightAt(p.px, p.pz) - s.y;
      lowest = Math.min(lowest, above);
      // over 3,5 m bare der snøen bak tvinger kameraet opp (bratt landing), og da ikke mer enn nødvendig
      worstExtra = Math.max(worstExtra, above - Math.max(3.5, snowBehind + CONFIG.camSnowClearance + 0.5));
      lowestClear = Math.min(lowestClear, p.py - heightAt(p.px, p.pz));
    });
    expect(lowest).toBeGreaterThan(1.5);
    expect(worstExtra).toBeLessThanOrEqual(0);
    expect(lowestClear).toBeGreaterThan(CONFIG.camSnowClearance - 0.05);
  });

  // Selve skiløperen får en knekk i farten når den letter og lander (det skal den), så de bildene telles ikke.
  it('stiger og synker jevnt i forhold til skiløperen: ingen knekk i farten opp og ned (60 og 30 fps)', () => {
    for (const fps of [60, 30]) {
      const rig = createCameraRig();
      let first = true;
      const h: number[] = [];
      const grounded: boolean[] = [];
      rideDown(fps, (s, frameDt) => {
        h.push(rig.update(camInput(s), first ? 0 : frameDt).py - s.y);
        grounded.push(s.grounded);
        first = false;
      });
      // endringen i fart opp/ned fra ett bilde til det neste
      let worst = 0;
      for (let i = 3; i < h.length; i++) {
        if (grounded[i] !== grounded[i - 3]) continue;
        const v1 = (h[i] - h[i - 1]) * fps, v0 = (h[i - 1] - h[i - 2]) * fps;
        worst = Math.max(worst, Math.abs(v1 - v0));
      }
      // som akselerasjon (m/s²). Før: 221 (klampen som knakk). Litt må det være: snøen bak stiger
      // stadig fortere mot deg når du faller ned mot en bratt landing
      expect(worst * fps).toBeLessThan(100);
    }
  });
});

describe('bremsen', () => {
  /** Akselerasjonen langs farten (m/s²) på hvert steg. */
  function accelSteps(brakeAt: (t: number) => number, seconds: number) {
    const s = createSkier();
    while (speedOf(s) < 60 / 3.6) stepSkier(s, { steer: 0, brake: 0 }, dt);
    const out: number[] = [];
    let v = speedOf(s);
    for (let i = 0; i < seconds * CONFIG.physicsHz; i++) {
      stepSkier(s, { steer: 0, brake: brakeAt(i * dt) }, dt);
      const nv = speedOf(s);
      out.push((nv - v) / dt);
      v = nv;
    }
    return out;
  }

  // Før: i 60 km/t gikk akselerasjonen fra +2,7 til −8,4 m/s² på ett steg.
  it('tar i mykt: akselerasjonen endrer seg maks 0,5 m/s² per steg når bremsen trykkes og slippes', () => {
    const a = accelSteps((t) => (t > 0.2 && t < 0.8 ? 1 : 0), 1.2);
    let worst = 0;
    for (let i = 1; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - a[i - 1]));
    expect(worst).toBeLessThan(0.5);
  });

  it('er likevel fort full: over 90 % bremsekraft etter 0,3 s, og helt av 0,3 s etter at du slipper', () => {
    const s = createSkier();
    for (let i = 0; i < 0.3 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 1 }, dt);
    expect(s.brake).toBeGreaterThan(0.9);
    for (let i = 0; i < 0.3 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 0 }, dt);
    expect(s.brake).toBeLessThan(0.1);
  });
});
