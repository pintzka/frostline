import { describe, expect, it } from 'vitest';
import { poseFor, type PoseInput } from '../src/character/pose';

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

  it('fjærer ned rett etter landing, og er tilbake etter et halvt sekund', () => {
    expect(poseFor({ ...standing, sinceLanding: 0.05 }).drop).toBeGreaterThan(0.1);
    expect(poseFor({ ...standing, sinceLanding: 0.5 }).drop).toBeCloseTo(0, 6);
  });
});
