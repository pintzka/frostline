import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, speedOf, stepSkier } from '../src/physics/skier';
import { heightAt } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;
function run(seconds: number, steer = 0, brake = 0) {
  const s = createSkier();
  for (let i = 0; i < seconds * CONFIG.physicsHz; i++) stepSkier(s, { steer, brake }, dt);
  return s;
}

describe('skiløper-fysikk', () => {
  it('akselererer nedover bakken', () => {
    const s = run(3);
    expect(speedOf(s)).toBeGreaterThan(8);
    expect(s.z).toBeGreaterThan(10);
  });

  it('overstiger aldri toppfarten', () => {
    const s = run(30);
    expect(speedOf(s)).toBeLessThanOrEqual(CONFIG.maxSpeed + 1e-6);
  });

  it('gir aldri NaN, heller ikke med full styring', () => {
    for (const steer of [-1, 0.5, 1]) {
      const s = run(20, steer);
      for (const v of [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.heading]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('holder seg på bakken (fase 0, ingen hopp)', () => {
    const s = run(10, 0.3);
    expect(Math.abs(s.y - heightAt(s.x, s.z))).toBeLessThan(1e-6);
  });

  it('bremsing gir lavere fart', () => {
    expect(speedOf(run(5, 0, 1))).toBeLessThan(speedOf(run(5)));
  });

  it('er deterministisk', () => {
    const a = run(8, 0.4), b = run(8, 0.4);
    expect(a).toEqual(b);
  });
});

/** Skiløper som allerede kjører rett ned med gitt fart. */
function moving(speed: number) {
  const s = createSkier();
  s.vz = speed;
  return s;
}

describe('fart og brems (måltall i DESIGN.md)', () => {
  const kmh60 = 60 / 3.6;

  it('når 60 km/t på 3–4 sekunder fra start', () => {
    const s = createSkier();
    let t = 0;
    while (speedOf(s) < kmh60 && t < 20) { stepSkier(s, { steer: 0, brake: 0 }, dt); t += dt; }
    expect(t).toBeGreaterThanOrEqual(3);
    expect(t).toBeLessThanOrEqual(4);
  });

  it('nærmer seg toppfarten av seg selv, uten å treffe en vegg', () => {
    const s = createSkier();
    for (let i = 0; i < 40 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 0 }, dt);
    expect(speedOf(s)).toBeGreaterThan(CONFIG.maxSpeed * 0.9);
    expect(speedOf(s)).toBeLessThan(CONFIG.maxSpeed);
  });

  it('bremser fra 60 km/t til stopp på under 3 sekunder', () => {
    const s = moving(kmh60);
    let t = 0;
    while (speedOf(s) > 0.01 && t < 20) { stepSkier(s, { steer: 0, brake: 1 }, dt); t += dt; }
    expect(t).toBeLessThan(3);
  });

  it('står helt stille mens man holder bremsen', () => {
    const s = moving(kmh60);
    for (let i = 0; i < 5 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 1 }, dt);
    expect(speedOf(s)).toBeLessThan(1e-6);
  });

  it('begynner å gli igjen når bremsen slippes', () => {
    const s = moving(kmh60);
    for (let i = 0; i < 5 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 1 }, dt);
    for (let i = 0; i < 1 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 0, brake: 0 }, dt);
    expect(speedOf(s)).toBeGreaterThan(1);
  });
});

describe('lening i svinger', () => {
  const kmh60 = 60 / 3.6;
  function lean(steer: number, seconds: number, start = moving(kmh60)) {
    for (let i = 0; i < seconds * CONFIG.physicsHz; i++) stepSkier(start, { steer, brake: 0 }, dt);
    return start;
  }

  it('står rett når den kjører rett fram', () => {
    expect(Math.abs(lean(0, 2).lean)).toBeLessThan(1e-6);
  });

  it('lener seg mot høyre i en høyresving og mot venstre i en venstresving', () => {
    expect(lean(1, 1).lean).toBeGreaterThan(0.3);
    expect(lean(-1, 1).lean).toBeLessThan(-0.3);
  });

  it('lener seg aldri mer enn maks', () => {
    const s = lean(1, 3, moving(CONFIG.maxSpeed));
    expect(Math.abs(s.lean)).toBeLessThanOrEqual(CONFIG.maxLean + 1e-9);
  });

  it('lener seg mindre i lav fart enn i høy fart', () => {
    expect(lean(1, 1, moving(2)).lean).toBeLessThan(lean(1, 1, moving(kmh60)).lean);
  });

  it('snapper ikke over: etter 0,2 s er den mindre enn halvveis', () => {
    const s = lean(1, 0.2);
    expect(s.lean).toBeGreaterThan(0);
    expect(s.lean).toBeLessThan(CONFIG.maxLean * 0.5);
  });

  it('legger seg mykt over, og reiser seg igjen når styringen slippes', () => {
    const s = moving(kmh60);
    stepSkier(s, { steer: 1, brake: 0 }, dt);
    expect(s.lean).toBeLessThan(0.05);
    lean(1, 1, s);
    lean(0, 2, s);
    expect(Math.abs(s.lean)).toBeLessThan(0.05);
  });
});

describe('carving', () => {
  const kmh60 = 60 / 3.6;

  it('bygger opp kanten mykt i stedet for å svinge med en gang', () => {
    const s = moving(kmh60);
    for (let i = 0; i < 0.02 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 1, brake: 0 }, dt);
    expect(Math.abs(s.edge)).toBeLessThan(0.3);
    for (let i = 0; i < 1 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 1, brake: 0 }, dt);
    expect(Math.abs(s.edge)).toBeGreaterThan(0.95);
  });

  it('slipper kanten mykt når styringen slippes', () => {
    const s = moving(kmh60);
    for (let i = 0; i < 1 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 1, brake: 0 }, dt);
    stepSkier(s, { steer: 0, brake: 0 }, dt);
    expect(Math.abs(s.edge)).toBeGreaterThan(0.9);
  });

  it('snur med ca. 15 m radius ved full styring i 60 km/t', () => {
    const s = moving(kmh60);
    // la kanten bygge seg opp, og mål så buen farten faktisk følger
    for (let i = 0; i < 0.5 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 1, brake: 0 }, dt);
    const dir0 = Math.atan2(s.vx, s.vz);
    const v0 = speedOf(s);
    const T = 0.4;
    for (let i = 0; i < T * CONFIG.physicsHz; i++) stepSkier(s, { steer: 1, brake: 0 }, dt);
    const dir1 = Math.atan2(s.vx, s.vz);
    const v = (v0 + speedOf(s)) / 2;
    const radius = v / (Math.abs(dir1 - dir0) / T);
    expect(radius).toBeGreaterThan(12);
    expect(radius).toBeLessThan(19);
  });

  it('beholder farten gjennom slalåmsvinger', () => {
    const s = moving(kmh60);
    for (let turn = 0; turn < 6; turn++) {
      const steer = turn % 2 === 0 ? 0.7 : -0.7;
      for (let i = 0; i < 1 * CONFIG.physicsHz; i++) stepSkier(s, { steer, brake: 0 }, dt);
    }
    expect(speedOf(s)).toBeGreaterThan(kmh60 * 0.9);
  });

  it('holder seg innenfor toppfarten også når den svinger', () => {
    const s = moving(CONFIG.maxSpeed);
    for (let i = 0; i < 4 * CONFIG.physicsHz; i++) stepSkier(s, { steer: 1, brake: 0 }, dt);
    expect(speedOf(s)).toBeLessThanOrEqual(CONFIG.maxSpeed + 1e-6);
  });
});
