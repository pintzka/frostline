import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createTricks, flipCoast, judgeLanding, spinCoast, stepTricks, trickName, type TrickState } from '../src/tricks/rotation';
import { bodyQuat, bodyStance, quatAngle, quatAxisAngle, quatMul, type Quat } from '../src/tricks/offaxis';
import { createLatch, splitControls } from '../src/tricks/controls';
import { createScore, scoreLanding, trickKey, trickValue } from '../src/tricks/score';
import { createSkier, stepSkier } from '../src/physics/skier';
import { PARK } from '../src/park/terrain';

/** Off-axis: spinn + flip innen vinduet etter avsatsen blir cork (W) eller rodeo (S). */
const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;

/** Stillingen kroppen tegnes i (samme som view.ts bruker). */
const bodyOf = (t: TrickState): Quat => bodyQuat(t.spin, t.flip, t.offAxisBlend, t.offAxisSide);

/** Kjører trikslogikken i lufta med input per tidspunkt. */
function fly(t: TrickState, seconds: number, inp: (time: number) => { spin: number; flip: number }) {
  for (let i = 0; i < Math.round(seconds / dt); i++) stepTricks(t, { ...inp(t.airTime), grounded: false }, dt);
}

describe('stillingen til kroppen', () => {
  it('vanlig hopp: samme stilling som før (spinn rundt loddrett, flip rundt kroppens sideakse)', () => {
    for (const [s, f] of [[0, 0], [90, 0], [0, 90], [540, 360], [200, -130]]) {
      const q = bodyQuat(s * DEG, f * DEG);
      const old = quatMul(quatAxisAngle(0, 1, 0, -s * DEG), quatAxisAngle(1, 0, 0, f * DEG));
      expect(quatAngle(q, old)).toBeLessThan(1e-6);
    }
  });

  it('off-axis: én skrå akse, og står rett opp etter en hel flip uansett spinn', () => {
    const q = bodyQuat(720 * DEG, 360 * DEG, 1, 1);
    expect(bodyStance(q).tiltDeg).toBeLessThan(1e-6);
    // halvveis i flipen ligger kroppen på skrå: hodet framover og ut mot spinnsiden (høyre = -x)
    const mid = bodyStance(bodyQuat(0, 90 * DEG, 1, 1));
    expect(mid.tiltDeg).toBeCloseTo(90, 6);
  });
});

describe('avsats-vinduet', () => {
  it(`spinn + W innen ${CONFIG.offAxisWindow} s etter avsats gir cork (off-axis)`, () => {
    const t = createTricks();
    fly(t, 0.5, (time) => ({ spin: 1, flip: time > 0.1 ? 1 : 0 }));
    expect(t.offAxis).toBe(true);
    expect(t.offAxisSide).toBe(1);
    // side = spinnretning × flipretning
    const r = createTricks();
    fly(r, 0.5, () => ({ spin: -1, flip: -1 }));
    expect(r.offAxis).toBe(true);
    expect(r.offAxisSide).toBe(1);
    const l = createTricks();
    fly(l, 0.5, () => ({ spin: -1, flip: 1 }));
    expect(l.offAxisSide).toBe(-1);
  });

  it('flip etter vinduet gir vanlig spinn + flip, og bare én av dem gir ikke off-axis', () => {
    const late = createTricks();
    fly(late, 1, (time) => ({ spin: 1, flip: time > CONFIG.offAxisWindow + 0.05 ? 1 : 0 }));
    expect(late.offAxis).toBe(false);
    const lateSpin = createTricks();
    fly(lateSpin, 1, (time) => ({ spin: time > CONFIG.offAxisWindow + 0.05 ? 1 : 0, flip: 1 }));
    expect(lateSpin.offAxis).toBe(false);
    const spinOnly = createTricks();
    fly(spinOnly, 1, () => ({ spin: 1, flip: 0 }));
    expect(spinOnly.offAxis).toBe(false);
    // svak skjelving på stikka starter ikke off-axis
    const weak = createTricks();
    fly(weak, 1, () => ({ spin: 0.2, flip: 1 }));
    expect(weak.offAxis).toBe(false);
  });

  it('nytt hopp starter som vanlig hopp igjen', () => {
    const t = createTricks();
    fly(t, 0.3, () => ({ spin: 1, flip: 1 }));
    stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    for (let i = 0; i < 240; i++) stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    expect(t.offAxisBlend).toBe(0);
    fly(t, 0.5, () => ({ spin: 1, flip: 0 }));
    expect(t.offAxis).toBe(false);
  });
});

describe('navn og landing', () => {
  it('cork med W, rodeo med S, dobbel når to flips teller', () => {
    expect(trickName(720 * DEG, 360 * DEG, 0, true)).toBe('Cork 720');
    expect(trickName(-540 * DEG, 360 * DEG, 0, true)).toBe('Cork 540');
    expect(trickName(1080 * DEG, 720 * DEG, 0, true)).toBe('Dobbel cork 1080');
    expect(trickName(720 * DEG, -360 * DEG, 0, true)).toBe('Rodeo 720');
    expect(trickName(1080 * DEG, -720 * DEG, 0, true)).toBe('Dobbel rodeo 1080');
    expect(trickName(720 * DEG, 360 * DEG, 1, true)).toBe('Cork 720 + Nordlys');
    // vanlige navn som før
    expect(trickName(720 * DEG, 360 * DEG)).toBe('720 + Frontflip');
    // off-axis uten en hel flip eller uten minst 360 spinn heter som vanlig
    expect(trickName(720 * DEG, 20 * DEG, 0, true)).toBe('720');
    expect(trickName(180 * DEG, 360 * DEG, 0, true)).toBe('180 + Frontflip');
  });

  it('landingen vurderes ut fra hvor kroppen faktisk står, med samme grenser', () => {
    const land = (spinDeg: number, flipDeg: number) => {
      const t = createTricks();
      fly(t, 0.3, () => ({ spin: 1, flip: 1 }));
      fly(t, 0.5, () => ({ spin: 0, flip: 0 }));
      t.spin = t.spinStart + spinDeg * DEG; t.flip = t.flipStart + flipDeg * DEG;
      stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
      return t.lastLanding!;
    };
    const clean = land(720, 360);
    expect(clean.quality).toBe('ren');
    expect(clean.offAxis).toBe(true);
    expect(clean.name).toBe('Cork 720');
    expect(land(735, 380).quality).toBe('ren');
    expect(land(720, 360 + CONFIG.landFlipClean + 5).quality).toBe('slurvete');
    expect(land(720 + CONFIG.landSpinClean + 5, 360).quality).toBe('slurvete');
    expect(land(810, 360).quality).toBe('fall'); // sidelengs
    expect(land(720, 180).quality).toBe('fall'); // på hodet
  });
});

describe('poeng', () => {
  it(`off-axis ganger spinnpoengene med ${CONFIG.offAxisSpinMult}, og er et eget triks for gjentakelse`, () => {
    const cork = { ...judgeLanding(720 * DEG, 360 * DEG, { offAxis: true }), airTime: 2 };
    const plain = { ...judgeLanding(720 * DEG, 360 * DEG), airTime: 2 };
    expect(cork.offAxis).toBe(true);
    expect(trickValue(cork)).toBeCloseTo(CONFIG.spinPoints[4] * CONFIG.offAxisSpinMult + CONFIG.flipPoints[1], 6);
    expect(trickValue(plain)).toBe(CONFIG.spinPoints[4] + CONFIG.flipPoints[1]);
    expect(trickKey(cork)).not.toBe(trickKey(plain));
    // gjentakelse som før: andre cork 720 rett etter gir mindre
    const s = createScore();
    const first = scoreLanding(s, cork)!;
    const second = scoreLanding(s, cork)!;
    expect(second.repeat).toBeCloseTo(CONFIG.repeatFactor, 6);
    expect(first.points).toBeGreaterThan(0);
  });
});

/**
 * «Flink spiller» med ekte fysikk: trykker spinn og flip rett etter avsatsen (innen vinduet),
 * og slipper hver tast når rotasjonen (med glidet etter slipp) akkurat når målet.
 */
function rideKicker(kickerIndex: number, spinGoalDeg: number, flipGoalDeg: number, flipDelay = 0) {
  const s = createSkier();
  const t = createTricks();
  const latch = createLatch();
  const kicker = PARK.kickers[kickerIndex];
  let tookOff = false, worstStep = 0, worstTrigger = 0, after = 0;
  let last = bodyOf(t);
  for (let i = 0; i < 80 * CONFIG.physicsHz; i++) {
    const near = s.z > kicker.z - 5 && s.z < kicker.z + 90;
    let steer = 0, flip = 0;
    if (!s.grounded && near && after === 0) {
      tookOff = true;
      const spinLeft = spinGoalDeg * DEG - (t.spin - t.spinStart + spinCoast(t.spinRate));
      const flipLeft = flipGoalDeg * DEG - (t.flip - t.flipStart + flipCoast(t.flipRate));
      steer = Math.abs(spinLeft) > 0.02 ? Math.sign(spinLeft) : 0;
      flip = Math.abs(flipLeft) > 0.02 && t.airTime >= flipDelay ? Math.sign(flipLeft) : 0;
    }
    const wasOff = t.offAxis;
    const c = splitControls({ steer, brake: 0, flip }, s.grounded, latch, dt);
    stepSkier(s, c.skier, dt);
    stepTricks(t, { spin: c.spin, flip: c.flip, grounded: s.grounded }, dt);
    const q = bodyOf(t);
    const step = quatAngle(q, last);
    if (tookOff) worstStep = Math.max(worstStep, step);
    if (!wasOff && t.offAxis) worstTrigger = step;
    last = q;
    if (tookOff && t.justLanded) after = 1e-9;
    if (after > 0) { after += dt; if (after > 1.2) break; }
  }
  return { t, landing: t.lastLanding!, worstStepDeg: worstStep / DEG, worstTriggerDeg: worstTrigger / DEG };
}

// største rotasjonsfart: spinn og flip samtidig i full fart, pluss litt for blandingen
const maxStepDeg = (CONFIG.spinSpeedDeg + CONFIG.flipSpeedDeg) * dt * 1.25;

describe('cork og rodeo med ekte fysikk', () => {
  for (const k of [1, 2]) {
    const name = PARK.kickers[k].name;
    it(`${name} hopp: cork 720 lander rent`, () => {
      const r = rideKicker(k, 720, 360);
      expect(r.landing.name).toBe('Cork 720');
      expect(r.landing.offAxis).toBe(true);
      expect(r.landing.quality).toBe('ren');
      console.log(`${name} cork 720: spinn ${r.landing.spinDeg.toFixed(0)}°, flip ${r.landing.flipDeg.toFixed(0)}°, feil ${r.landing.spinErrDeg.toFixed(1)}°/${r.landing.flipErrDeg.toFixed(1)}°, luft ${r.landing.airTime.toFixed(2)} s, verste steg ${r.worstStepDeg.toFixed(2)}°`);
    });
    it(`${name} hopp: rodeo 720 lander rent`, () => {
      const r = rideKicker(k, 720, -360);
      expect(r.landing.name).toBe('Rodeo 720');
      expect(r.landing.quality).toBe('ren');
    });
  }

  it('flip etter vinduet på samme hopp gir vanlig 720 + Frontflip', () => {
    const r = rideKicker(2, 720, 360, CONFIG.offAxisWindow + 0.05);
    expect(r.landing.offAxis).toBe(false);
    expect(r.landing.name).toBe('720 + Frontflip');
  });

  it('ingen brå hopp i kroppens retning per steg: gjennom hoppet, når off-axis starter og etter landing', () => {
    for (const [k, sp, fl] of [[1, 720, 360], [2, 720, -360], [2, 540, 360]]) {
      const r = rideKicker(k, sp, fl);
      expect(r.t.offAxis).toBe(true);
      expect(r.worstStepDeg).toBeLessThan(maxStepDeg);
      expect(r.worstTriggerDeg).toBeLessThan(1);
    }
  });

  it('etter landing retter kroppen seg mykt opp, og står rett etter ett sekund', () => {
    const r = rideKicker(1, 720, 360);
    const st = bodyStance(bodyOf(r.t));
    expect(st.tiltDeg).toBeLessThan(1);
    expect(r.t.offAxisBlend).toBe(0);
  });

  it('er deterministisk', () => {
    const a = rideKicker(1, 720, 360).t, b = rideKicker(1, 720, 360).t;
    expect([a.spin, a.flip, a.offAxisBlend]).toEqual([b.spin, b.flip, b.offAxisBlend]);
  });
});

/** Hele bakken: styring (og W) holdt over hver kant, med litt skjelving som en analog stikke. */
function heldOverLips(noise: number, holdFlip: boolean) {
  const s = createSkier();
  const t = createTricks();
  const latch = createLatch();
  let offAxisJumps = 0, landings = 0, lastGround = 0, heldOverLip = 0, wasAir = false;
  for (let i = 0; i < 70 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
    const wobble = noise * Math.sin(i * 1.7);
    // myk slalåm som i tricks.test.ts: skiene peker litt til høyre og venstre om hverandre
    const err = s.heading - 0.25 * Math.sin((2 * Math.PI * i * dt) / 2.4);
    let steer = err > 0.03 ? 0.8 : err < -0.03 ? -0.8 : 0;
    if (!s.grounded) steer = lastGround; else lastGround = steer;
    const c = splitControls({ steer: steer + wobble, brake: 0, flip: holdFlip ? 1 : 0 }, s.grounded, latch, dt);
    stepSkier(s, c.skier, dt);
    stepTricks(t, { spin: c.spin, flip: c.flip, grounded: s.grounded }, dt);
    if (!wasAir && !s.grounded && steer !== 0) heldOverLip++;
    wasAir = !s.grounded;
    // off-axis-merket står fortsatt på i steget du lander
    if (t.justLanded) { landings++; if (t.offAxis) offAxisJumps++; }
  }
  return { offAxisJumps, landings, heldOverLip };
}

describe('ingen off-axis du ikke mente', () => {
  for (const [noise, holdFlip] of [[0, false], [0.002, false], [0.002, true], [0.02, true]] as const) {
    it(`styring${holdFlip ? ' og W' : ''} holdt over kantene (skjelving ${noise}) gir aldri off-axis`, () => {
      const r = heldOverLips(noise, holdFlip);
      expect(r.landings).toBeGreaterThan(0);
      expect(r.heldOverLip).toBeGreaterThan(0);
      expect(r.offAxisJumps).toBe(0);
    });
  }
});
