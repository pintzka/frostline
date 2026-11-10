import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createCameraRig, type CameraPose } from '../src/camera/rig';
import { createSkier, speedOf, stepSkier, type SkierState } from '../src/physics/skier';
import { heightAt } from '../src/park/terrain';

const physicsDt = 1 / CONFIG.physicsHz;

function camInput(s: SkierState) {
  return { x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, heading: s.heading, speed: speedOf(s) };
}

/** Kjør fysikken i 240 Hz og kameraet med gitt bildefrekvens. */
function simulate(seconds: number, fps: number, steerAt: (t: number) => number, onFrame?: (p: CameraPose, s: SkierState) => void) {
  const s = createSkier();
  const rig = createCameraRig();
  const stepsPerFrame = Math.round(CONFIG.physicsHz / fps);
  const frames = Math.round(seconds * fps);
  let pose = rig.update(camInput(s), 0);
  let t = 0;
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < stepsPerFrame; i++) { stepSkier(s, { steer: steerAt(t), brake: 0 }, physicsDt); t += physicsDt; }
    pose = rig.update(camInput(s), stepsPerFrame * physicsDt);
    onFrame?.(pose, s);
  }
  return { pose, s };
}

describe('kamera', () => {
  it('holder fast avstand bak skiløperen, også i toppfart', () => {
    const { pose, s } = simulate(30, 60, () => 0);
    expect(speedOf(s)).toBeGreaterThan(CONFIG.maxSpeed * 0.9);
    expect(Math.hypot(pose.px - s.x, pose.pz - s.z)).toBeCloseTo(CONFIG.camDistance, 0);
    expect(pose.pz).toBeLessThan(s.z);
  });

  it('ligger ca. camHeight over snøen', () => {
    const { pose } = simulate(10, 60, () => 0);
    expect(pose.py - heightAt(pose.px, pose.pz)).toBeCloseTo(CONFIG.camHeight, 0);
  });

  it('gir samme bilde uansett bildefrekvens', () => {
    const steer = (t: number) => Math.sin(t * 1.5);
    const a = simulate(6, 30, steer).pose;
    const b = simulate(6, 240, steer).pose;
    // 30 fps ser skiløperen sjeldnere enn 240 fps, så litt avvik er naturlig; 15 cm syns ikke
    expect(Math.hypot(a.px - b.px, a.py - b.py, a.pz - b.pz)).toBeLessThan(0.15);
  });

  it('følger veien skiløperen faktisk kjører, ikke bare skiene', () => {
    const rig = createCameraRig();
    // skiene peker skrått, men farten går rett ned bakken (skrens)
    const inp = { x: 0, y: 0, z: 0, vx: 0, vz: 20, heading: 0.8, speed: 20 };
    let pose = rig.update(inp, 0);
    for (let i = 0; i < 120; i++) pose = rig.update(inp, 1 / 60);
    expect(Math.abs(pose.px)).toBeLessThan(0.2);
  });

  it('kommer aldri under snøen, heller ikke i krappe svinger', () => {
    let lowest = Infinity;
    simulate(20, 60, (t) => (Math.floor(t / 1.2) % 2 === 0 ? 1 : -1), (p) => {
      lowest = Math.min(lowest, p.py - heightAt(p.px, p.pz));
    });
    expect(lowest).toBeGreaterThan(0.5);
  });

  it('øker synsfeltet med farten', () => {
    const slow = simulate(0.5, 60, () => 0).pose.fov;
    const fast = simulate(30, 60, () => 0).pose.fov;
    expect(slow).toBeLessThan(CONFIG.camFovBase + 2);
    expect(fast).toBeGreaterThan(CONFIG.camFovMax - 3);
    expect(fast).toBeLessThanOrEqual(CONFIG.camFovMax);
  });
});
