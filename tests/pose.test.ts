import { describe, expect, it } from 'vitest';
import { followLeanSign, poseFor, smoothPose, type Pose, type PoseInput } from '../src/character/pose';
import { CONFIG } from '../src/core/config';
import { createGame, stepGame } from '../src/core/game';
import { isSwitch, spinCoast } from '../src/tricks/rotation';

const standing: PoseInput = { grounded: true, popCharge: 0, airTime: 0, heightAboveSnow: 0, sinceLanding: 10 };

describe('hopp-bevegelse', () => {
  it('står vanlig når ingenting skjer', () => {
    const p = poseFor(standing);
    expect(p.drop).toBeCloseTo(0, 6);
    expect(p.skiLift).toBeCloseTo(0, 6);
  });

  it('tar sats (går ned) mens pop lades', () => {
    expect(poseFor({ ...standing, popCharge: 1 }).drop).toBeGreaterThan(0.15);
  });

  it('strekker seg opp rett etter avspark', () => {
    const p = poseFor({ ...standing, grounded: false, airTime: 0.05, heightAboveSnow: 0.1 });
    expect(p.drop).toBeLessThan(-0.05);
  });

  it('trekker skiene opp midt i lufta', () => {
    const p = poseFor({ ...standing, grounded: false, airTime: 0.4, heightAboveSnow: 1.5 });
    expect(p.skiLift).toBeGreaterThan(0.2);
  });

  it('senker skiene igjen rett før landing', () => {
    const p = poseFor({ ...standing, grounded: false, airTime: 1.2, heightAboveSnow: 0.05 });
    expect(p.skiLift).toBeLessThan(0.05);
  });

  // Før glattingen flyttet kroppen seg 36 cm på ett bilde i avsparket. Et raskt, men jevnt avspark
  // tar ca. 10 bilder; 5 cm per bilde er grensen mellom «raskt» og «rykk».
  it('rykker aldri: kroppen flytter seg maks 5 cm på ett bilde (60 fps), også i avspark og landing', () => {
    // sats fullt ladet, så avspark, en tur i lufta og en landing
    const frames: PoseInput[] = [];
    for (let i = 0; i < 30; i++) frames.push({ ...standing, popCharge: Math.min(1, i / 30) });
    for (let i = 0; i < 40; i++) frames.push({ ...standing, grounded: false, popCharge: 0, airTime: i / 60, heightAboveSnow: Math.max(0, 0.6 - 0.6 * ((i - 20) / 20) ** 2) });
    for (let i = 0; i < 30; i++) frames.push({ ...standing, sinceLanding: i / 60 });
    let p: Pose = poseFor(frames[0]);
    let biggest = 0;
    for (const f of frames) {
      const next = smoothPose(p, poseFor(f), 1 / 60);
      biggest = Math.max(biggest, Math.abs(next.drop - p.drop), Math.abs(next.skiLift - p.skiLift));
      p = next;
    }
    expect(biggest).toBeLessThan(0.05);
  });

  it('henger likevel godt med: når sats-stillingen på under 0,2 s', () => {
    let p = poseFor(standing);
    const want = poseFor({ ...standing, popCharge: 1 });
    for (let i = 0; i < 12; i++) p = smoothPose(p, want, 1 / 60);
    expect(p.drop).toBeGreaterThan(want.drop * 0.9);
  });

  it('fjærer ned rett etter landing, og er tilbake etter et halvt sekund', () => {
    expect(poseFor({ ...standing, sinceLanding: 0.05 }).drop).toBeGreaterThan(0.1);
    expect(poseFor({ ...standing, sinceLanding: 0.5 }).drop).toBeCloseTo(0, 6);
  });
});

describe('leningen ved switch-landing', () => {
  /** Carver hardt, popper på flaten mens du lener, spinner 180 og lander baklengs. Gir største endring i vist lening per steg. */
  function biggestLeanStep(follow: (sign: number, sw: boolean, dt: number) => number) {
    const dt = 1 / CONFIG.physicsHz;
    const g = createGame();
    let sign = 1, last = 0, biggest = 0, time = 0, landedSwitch = false, leanAtLanding = 0, popped = false;
    for (let i = 0; i < 12 * CONFIG.physicsHz; i++) {
      const s = g.skier, t = g.tricks;
      let steer = 0.8, pop = false;
      // pop: hold 0,4 s etter 3 s carving, og slipp
      if (time > 3 && time < 3.4 && !popped) pop = true;
      if (time >= 3.4) popped = true;
      if (!s.grounded) {
        const left = Math.PI - (t.spin + spinCoast(t.spinRate));
        // slipper stikka et øyeblikk etter avsatsen, så sperren slippes, og spinner så
        steer = s.airTime < 0.03 ? 0 : Math.abs(left) > 0.02 ? Math.sign(left) : 0;
      }
      const wasAir = !s.grounded;
      stepGame(g, { steer, brake: 0, flip: 0, pop }, dt);
      time += dt;
      if (wasAir && g.skier.grounded && isSwitch(g.tricks)) { landedSwitch = true; leanAtLanding = g.skier.lean; }
      sign = follow(sign, isSwitch(g.tricks), dt);
      const shown = g.skier.lean * sign;
      if (i > 0) biggest = Math.max(biggest, Math.abs(shown - last));
      last = shown;
      if (landedSwitch && time > 7) break;
    }
    return { landedSwitch, leanAtLanding, biggestDeg: biggest / (Math.PI / 180) };
  }

  it('rykker ikke når du lander baklengs mens du fortsatt lener (fortegnet glir mykt)', () => {
    const hard = biggestLeanStep((_, sw) => (sw ? -1 : 1));
    const soft = biggestLeanStep(followLeanSign);
    expect(soft.landedSwitch).toBe(true);
    expect(Math.abs(soft.leanAtLanding)).toBeGreaterThan(0.02);
    // uten myk overgang hopper leningen flere grader på ett steg
    expect(hard.biggestDeg).toBeGreaterThan(3);
    // med myk overgang: under 1° per fysikksteg (ca. 4° per bilde i 60 fps)
    expect(soft.biggestDeg).toBeLessThan(1);
  });
});
