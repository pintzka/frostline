import { describe, expect, it } from 'vitest';
import { poseFor, smoothPose, type Pose, type PoseInput } from '../src/character/pose';

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
