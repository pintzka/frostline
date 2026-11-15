import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createTricks, flipCoast, isSwitch, judgeLanding, spinCoast, stepTricks, trickName, type TrickState } from '../src/tricks/rotation';
import { createLatch, resetLatch, splitControls } from '../src/tricks/controls';
import { createSkier, speedOf, stepSkier, type SkierState } from '../src/physics/skier';
import { createCameraRig } from '../src/camera/rig';
import { PARK } from '../src/park/terrain';

const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const spinMax = CONFIG.spinSpeedDeg * DEG;
const flipMax = CONFIG.flipSpeedDeg * DEG;

/** Kjører trikslogikken i lufta med gitt input per steg, og logger største endring i farten per steg. */
function fly(t: TrickState, seconds: number, inp: (time: number) => { spin: number; flip: number }) {
  let biggestSpin = 0, biggestFlip = 0;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const s0 = t.spinRate, f0 = t.flipRate;
    stepTricks(t, { ...inp(i * dt), grounded: false }, dt);
    biggestSpin = Math.max(biggestSpin, Math.abs(t.spinRate - s0));
    biggestFlip = Math.max(biggestFlip, Math.abs(t.flipRate - f0));
  }
  return { biggestSpin, biggestFlip };
}

describe('spinn og flips i lufta', () => {
  it(`spinner ca. ${CONFIG.spinSpeedDeg}°/s når du holder venstre/høyre`, () => {
    const t = createTricks();
    fly(t, 1, () => ({ spin: 1, flip: 0 }));
    expect(t.spinRate / DEG).toBeGreaterThan(530);
    expect(t.spinRate / DEG).toBeLessThan(541);
  });

  it('spinner andre veien med venstre', () => {
    const t = createTricks();
    fly(t, 0.5, () => ({ spin: -1, flip: 0 }));
    expect(t.spin).toBeLessThan(0);
  });

  it('flipper 360° per ca. 0,9 s (full fart)', () => {
    const t = createTricks();
    fly(t, 1, () => ({ spin: 0, flip: 1 }));
    const secondsPerFlip = 360 / (t.flipRate / DEG);
    expect(secondsPerFlip).toBeGreaterThan(0.88);
    expect(secondsPerFlip).toBeLessThan(0.93);
    const back = createTricks();
    fly(back, 1, () => ({ spin: 0, flip: -1 }));
    expect(back.flip).toBeLessThan(0);
  });

  it('en hel flip fra stille (med oppbygging) tar litt over ett sekund', () => {
    const t = createTricks();
    let time = 0;
    while (t.flip < 2 * Math.PI) { stepTricks(t, { spin: 0, flip: 1, grounded: false }, dt); time += dt; }
    expect(time).toBeGreaterThan(0.95);
    expect(time).toBeLessThan(1.1);
  });

  it('bygger seg opp mykt: ingen brå hopp i rotasjonsfarten, heller ikke når du bytter retning', () => {
    const t = createTricks();
    // første steg: nesten ingenting
    stepTricks(t, { spin: 1, flip: 1, grounded: false }, dt);
    expect(t.spinRate).toBeLessThan(spinMax * 0.05);
    expect(t.flipRate).toBeLessThan(flipMax * 0.05);
    // trykk, slipp, bytt retning midt i, kombiner spinn og flip
    const { biggestSpin, biggestFlip } = fly(t, 3, (time) => ({
      spin: time < 0.8 ? 1 : time < 1.2 ? 0 : time < 2 ? -1 : 0,
      flip: time < 0.5 ? 1 : time < 1.5 ? -1 : 0,
    }));
    // full fart én vei til full fart andre veien er den største endringen: maks 10 % av full fart per steg
    expect(biggestSpin).toBeLessThan(spinMax * 0.1);
    expect(biggestFlip).toBeLessThan(flipMax * 0.1);
    // i én retning (fra 0 til full fart) maks 5 % av full fart per steg
    const one = createTricks();
    const r = fly(one, 1.5, (time) => ({ spin: time < 0.7 ? 1 : 0, flip: time < 0.7 ? 1 : 0 }));
    expect(r.biggestSpin).toBeLessThan(spinMax * 0.05);
    expect(r.biggestFlip).toBeLessThan(flipMax * 0.05);
  });

  it(`glir ca. ${CONFIG.spinCoastDeg}° når du slipper i full fart, og stopper så (ingen automatisk fullføring)`, () => {
    const t = createTricks();
    fly(t, 0.6, () => ({ spin: 1, flip: 0 }));
    const atRelease = t.spin;
    fly(t, 1.5, () => ({ spin: 0, flip: 0 }));
    const coast = (t.spin - atRelease) / DEG;
    expect(coast).toBeGreaterThan(20);
    expect(coast).toBeLessThan(30);
    expect(t.spinRate).toBe(0);
    // flip: også kort gli, godt innenfor ±25°
    const f = createTricks();
    fly(f, 1, () => ({ spin: 0, flip: -1 }));
    const flipAt = f.flip;
    fly(f, 1, () => ({ spin: 0, flip: 0 }));
    expect((flipAt - f.flip) / DEG).toBeGreaterThan(12);
    expect((flipAt - f.flip) / DEG).toBeLessThan(22);
  });

  it('du kan rotere for lite og for mye: stillingen blir der du slipper', () => {
    // slipper for tidlig: ca. 230° + glid, langt unna både 180 og 360
    const under = createTricks();
    fly(under, 2, (time) => ({ spin: under.spin < 230 * DEG && time < 1 ? 1 : 0, flip: 0 }));
    expect(under.spin / DEG).toBeGreaterThan(240);
    expect(under.spin / DEG).toBeLessThan(300);
    expect(judgeLanding(under.spin, 0).quality).toBe('fall');
    // holder for lenge: over 400°
    const over = createTricks();
    fly(over, 2, (time) => ({ spin: time < 0.85 ? 1 : 0, flip: 0 }));
    expect(over.spin / DEG).toBeGreaterThan(400);
    expect(judgeLanding(over.spin, 0).quality).not.toBe('ren');
  });

  it('er deterministisk: samme input gir nøyaktig samme rotasjon', () => {
    const run = () => {
      const t = createTricks();
      fly(t, 1.3, (time) => ({ spin: time < 0.7 ? 1 : 0, flip: time > 0.3 && time < 0.9 ? -1 : 0 }));
      stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
      return [t.spin, t.flip, t.spinRate, t.flipRate];
    };
    expect(run()).toEqual(run());
  });
});

describe('landing og triksnavn', () => {
  const at = (spinDeg: number, flipDeg: number) => judgeLanding(spinDeg * DEG, flipDeg * DEG);

  it('gir navn til triksene', () => {
    expect(trickName(360 * DEG, 0)).toBe('360');
    expect(trickName(-180 * DEG, 0)).toBe('180');
    expect(trickName(0, -360 * DEG)).toBe('Backflip');
    expect(trickName(0, 360 * DEG)).toBe('Frontflip');
    expect(trickName(540 * DEG, 360 * DEG)).toBe('540 + Frontflip');
    expect(trickName(0, -720 * DEG)).toBe('Dobbel backflip');
    expect(trickName(10 * DEG, 5 * DEG)).toBe('');
    // halv backflip (fall) er ikke en backflip; bare nesten hele rotasjoner teller
    expect(trickName(0, -200 * DEG)).toBe('');
    expect(trickName(0, -330 * DEG)).toBe('Backflip');
    expect(trickName(100 * DEG, 0)).toBe('');
    expect(trickName(330 * DEG, 0)).toBe('360');
    expect(trickName(395 * DEG, 0)).toBe('360');
  });

  it('ren landing: spinn innenfor ±30° av hel eller halv runde, flip innenfor ±25°', () => {
    expect(at(0, 0).quality).toBe('ren');
    expect(at(360, 0).quality).toBe('ren');
    expect(at(180, 0).quality).toBe('ren'); // switch
    expect(at(-540, 0).quality).toBe('ren');
    expect(at(388, 0).quality).toBe('ren');
    expect(at(0, -340).quality).toBe('ren');
    expect(at(720, 380).quality).toBe('ren');
  });

  it('slurvete litt utenfor, fall langt utenfor', () => {
    expect(at(395, 0).quality).toBe('slurvete');
    expect(at(0, 330).quality).toBe('slurvete');
    expect(at(420, 0).quality).toBe('fall');
    expect(at(90, 0).quality).toBe('fall'); // sidelengs
    expect(at(0, 300).quality).toBe('fall');
    expect(at(0, -180).quality).toBe('fall'); // på hodet
  });

  it('retter seg mykt opp etter landing: ingen snap i vinkel eller fart', () => {
    for (const [spinDeg, flipDeg] of [[385, 0], [0, -335], [200, 20], [100, 150]]) {
      const t = createTricks();
      // et hopp som ender med rotasjon som fortsatt går
      stepTricks(t, { spin: 0, flip: 0, grounded: false }, dt);
      t.spin = spinDeg * DEG; t.flip = flipDeg * DEG; t.spinRate = spinMax * 0.6; t.flipRate = -flipMax * 0.4;
      let biggestAngle = 0, biggestRate = 0;
      for (let i = 0; i < 0.8 * CONFIG.physicsHz; i++) {
        const s0 = t.spin, f0 = t.flip, sr = t.spinRate, fr = t.flipRate;
        stepTricks(t, { spin: 1, flip: 0, grounded: true }, dt);
        biggestAngle = Math.max(biggestAngle, Math.abs(t.spin - s0), Math.abs(t.flip - f0));
        biggestRate = Math.max(biggestRate, Math.abs(t.spinRate - sr), Math.abs(t.flipRate - fr));
      }
      // vinkelen flytter seg aldri mye mer enn full spinnfart tillater på ett steg
      expect(biggestAngle).toBeLessThan(spinMax * dt * 1.2);
      // skiene biter hardt, men farten forsvinner ikke på ett steg (maks 50 % av full spinnfart per steg)
      expect(biggestRate).toBeLessThan(spinMax * 0.5);
      // står rett etter 0,8 s
      expect(Math.abs(t.spin - t.spinTarget) / DEG).toBeLessThan(2);
      expect(Math.abs(t.flip - t.flipTarget) / DEG).toBeLessThan(2);
      expect(Math.abs(Math.sin(t.flipTarget))).toBeLessThan(1e-9);
      expect(Math.abs(Math.sin(t.spinTarget))).toBeLessThan(1e-9);
    }
  });

  it('snurrer ikke forbi ved landing i full spinnfart (maks noen få grader)', () => {
    for (const pastDeg of [0, 15, 30]) {
      const t = createTricks();
      fly(t, 1, () => ({ spin: 1, flip: 0 }));
      // still inn så landingen skjer akkurat pastDeg forbi en hel runde, i full fart
      t.spin = t.spinStart + (360 + pastDeg) * DEG;
      const landedAt = t.spin;
      let most = 0;
      for (let i = 0; i < CONFIG.physicsHz; i++) {
        stepTricks(t, { spin: 1, flip: 0, grounded: true }, dt);
        most = Math.max(most, t.spin - landedAt);
      }
      expect(Math.abs(t.spinRate)).toBeLessThan(0.05);
      expect(most / DEG).toBeLessThan(5);
    }
  });

  it('merker fall (lastLanding) og måler neste hopp fra den nye stillingen', () => {
    const t = createTricks();
    fly(t, 0.3, () => ({ spin: 1, flip: 0 }));
    stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    expect(t.lastLanding?.quality).toBe('fall');
    expect(t.landingAge).toBe(0);
    // står på bakken en stund, så et nytt hopp uten rotasjon: ren
    for (let i = 0; i < 240; i++) stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    fly(t, 0.5, () => ({ spin: 0, flip: 0 }));
    stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    expect(t.lastLanding?.quality).toBe('ren');
    expect(t.lastLanding?.name).toBe('');
  });
});

describe('tastene i lufta og på bakken', () => {
  it('S bremser på bakken, men er backflip i lufta (på et nytt trykk)', () => {
    const latch = createLatch();
    const ground = splitControls({ steer: 0, brake: 1, flip: -1 }, true, latch, dt);
    expect(ground.skier.brake).toBe(1);
    expect(ground.flip).toBe(0);
    // letter mens S holdes: ingen backflip før du slipper og trykker igjen
    expect(splitControls({ steer: 0, brake: 1, flip: -1 }, false, latch, dt).flip).toBe(0);
    splitControls({ steer: 0, brake: 0, flip: 0 }, false, latch, dt);
    const air = splitControls({ steer: 1, brake: 1, flip: -1 }, false, latch, dt);
    expect(air.skier.brake).toBe(0);
    expect(air.skier.steer).toBe(0);
    expect(air.flip).toBe(-1);
    expect(air.spin).toBe(1);
  });

  it('styring holdt over kanten gir ingen spinn; slipp eller bytt retning for å spinne', () => {
    const latch = createLatch();
    splitControls({ steer: 1, brake: 0, flip: 0 }, true, latch, dt);
    for (let i = 0; i < 100; i++) expect(splitControls({ steer: 1, brake: 0, flip: 0 }, false, latch, dt).spin).toBe(0);
    // bytter retning i lufta: det er et nytt trykk
    expect(splitControls({ steer: -1, brake: 0, flip: 0 }, false, latch, dt).spin).toBe(-1);
    // W holdt over kanten gir heller ingen frontflip
    const l2 = createLatch();
    splitControls({ steer: 0, brake: 0, flip: 1 }, true, l2, dt);
    expect(splitControls({ steer: 0, brake: 0, flip: 1 }, false, l2, dt).flip).toBe(0);
  });

  it(`spinn-tasten holdt ved landing sperrer styringen maks ${CONFIG.landKeyLock} s`, () => {
    const latch = createLatch();
    splitControls({ steer: 0, brake: 0, flip: 0 }, false, latch, dt);
    splitControls({ steer: 1, brake: 1, flip: -1 }, false, latch, dt);
    let blockedSteer = 0, blockedBrake = 0;
    for (let i = 0; i < CONFIG.physicsHz; i++) {
      const c = splitControls({ steer: 1, brake: 1, flip: -1 }, true, latch, dt);
      if (c.skier.steer === 0) blockedSteer++;
      if (c.skier.brake === 0) blockedBrake++;
    }
    expect(blockedSteer * dt).toBeGreaterThan(CONFIG.landKeyLock - 2 * dt);
    expect(blockedSteer * dt).toBeLessThanOrEqual(CONFIG.landKeyLock + dt);
    expect(blockedBrake * dt).toBeLessThanOrEqual(CONFIG.landKeyLock + dt);
    // bytter du retning, styrer du med en gang
    const l2 = createLatch();
    splitControls({ steer: 0, brake: 0, flip: 0 }, false, l2, dt);
    splitControls({ steer: 1, brake: 0, flip: 0 }, false, l2, dt);
    splitControls({ steer: 1, brake: 0, flip: 0 }, true, l2, dt);
    expect(splitControls({ steer: -1, brake: 0, flip: 0 }, true, l2, dt).skier.steer).toBe(-1);
  });

  it('carving over kanten sperrer ikke styringen etter landing', () => {
    const latch = createLatch();
    splitControls({ steer: 1, brake: 0, flip: 0 }, true, latch, dt);
    splitControls({ steer: 1, brake: 0, flip: 0 }, false, latch, dt);
    expect(splitControls({ steer: 1, brake: 0, flip: 0 }, true, latch, dt).skier.steer).toBe(1);
  });

  it('nullstilles helt ved ny runde', () => {
    const latch = createLatch();
    splitControls({ steer: 1, brake: 0, flip: -1 }, false, latch, dt);
    resetLatch(latch);
    expect(latch).toEqual(createLatch());
  });

  it('pop virker som før', () => {
    const out = splitControls({ steer: 0, brake: 0, flip: 0, pop: true }, true, createLatch(), dt);
    expect(out.skier.pop).toBe(true);
  });
});

/** Hele bakken i myk slalåm med ekte fysikk. spinInAir: trykker spinn på nytt i lufta og holder til etter landing. */
function slalom(spinInAir: boolean) {
  const s = createSkier();
  const t = createTricks();
  const latch = createLatch();
  const names: string[] = [];
  let landings = 0, blocked = 0, longestBlock = 0, run = 0, wasAir = false, airSteps = 0, lastGroundSteer = 0, heldOverLip = 0;
  for (let i = 0; i < 60 * CONFIG.physicsHz && s.z < PARK.length - 30; i++) {
    // myk slalåm: skiene skal peke litt til høyre og venstre om hverandre (tastatur: bare -1, 0 eller 1)
    const err = s.heading - 0.25 * Math.sin((2 * Math.PI * i * dt) / 2.4);
    let steer = err > 0.03 ? 1 : err < -0.03 ? -1 : 0;
    // over kanten holdes tasten du hadde, helt til landing
    if (!s.grounded) steer = lastGroundSteer; else lastGroundSteer = steer;
    if (spinInAir && !s.grounded) { airSteps++; steer = airSteps < 20 ? 0 : 1; }
    if (spinInAir && s.grounded && airSteps > 0) { steer = 1; airSteps = airSteps > 400 ? 0 : airSteps + 1; }
    const onSnow = s.grounded;
    const c = splitControls({ steer, brake: 0, flip: 0 }, onSnow, latch, dt);
    stepSkier(s, c.skier, dt);
    stepTricks(t, { spin: c.spin, flip: c.flip, grounded: s.grounded }, dt);
    if (!wasAir && !s.grounded && steer !== 0) heldOverLip++;
    if (wasAir && s.grounded) { landings++; names.push(t.lastLanding!.name); }
    wasAir = !s.grounded;
    // sperret = på bakken (før steget), tasten holdes, men skiene får ingen styring
    if (onSnow && steer !== 0 && c.skier.steer === 0) { blocked++; run++; longestBlock = Math.max(longestBlock, run); } else run = 0;
  }
  return { names, landings, heldOverLip, blockedTime: blocked * dt, longestBlock: longestBlock * dt };
}

describe('ingen triks eller sperrer du ikke mente (ekte fysikk, myk slalåm)', () => {
  it('styring holdt over kantene gir aldri spinn, og styringen sperres aldri', () => {
    const r = slalom(false);
    expect(r.landings).toBeGreaterThan(0);
    expect(r.heldOverLip).toBeGreaterThan(0);
    expect(r.names.filter((n) => n !== '')).toEqual([]);
    expect(r.blockedTime).toBe(0);
  });

  it(`med spinn i lufta er styringen aldri sperret lenger enn ${CONFIG.landKeyLock} s etter landing`, () => {
    const r = slalom(true);
    expect(r.landings).toBeGreaterThan(0);
    expect(r.blockedTime).toBeGreaterThan(0);
    expect(r.longestBlock).toBeLessThanOrEqual(CONFIG.landKeyLock + dt);
    expect(r.blockedTime).toBeLessThanOrEqual(r.landings * (CONFIG.landKeyLock + dt));
  });
});

/**
 * En hel tur ned til det medium hoppet med ekte fysikk. Spilleren holder tasten og slipper
 * når rotasjonen (med glidet etter slipp) akkurat vil nå målet, slik en flink spiller gjør.
 */
function rideMedium(spinGoalDeg: number, flipGoalDeg: number, withCamera = false) {
  const s = createSkier();
  const t = createTricks();
  const latch = createLatch();
  const rig = createCameraRig();
  const kicker = PARK.kickers[1];
  const camYaws: number[] = [];
  let tookOff = false;
  for (let i = 0; i < 60 * CONFIG.physicsHz; i++) {
    const nearMedium = s.z > kicker.z - 5 && s.z < kicker.z + 80;
    let steer = 0, flip = 0;
    if (!s.grounded && nearMedium) {
      tookOff = true;
      const spinLeft = spinGoalDeg * DEG - (t.spin + spinCoast(t.spinRate));
      const flipLeft = flipGoalDeg * DEG - (t.flip + flipCoast(t.flipRate));
      steer = Math.abs(spinLeft) > 0.02 && spinGoalDeg !== 0 ? Math.sign(spinLeft) : 0;
      flip = Math.abs(flipLeft) > 0.02 && flipGoalDeg !== 0 ? Math.sign(flipLeft) : 0;
    }
    const c = splitControls({ steer, brake: 0, flip }, s.grounded, latch, dt);
    stepSkier(s, c.skier, dt);
    stepTricks(t, { spin: c.spin, flip: c.flip, grounded: s.grounded }, dt);
    if (withCamera && i % 4 === 0) {
      const p = rig.update({ x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, heading: s.heading, speed: speedOf(s as SkierState) }, 4 * dt);
      if (!s.grounded && nearMedium) camYaws.push(Math.atan2(p.lx - p.px, p.lz - p.pz));
    }
    if (tookOff && s.grounded) break;
  }
  return { t, s, camYaws };
}

describe('triks på det medium hoppet (ekte fysikk)', () => {
  it('en 720 går an og lander rent', () => {
    const { t } = rideMedium(720, 0);
    expect(t.lastLanding?.name).toBe('720');
    expect(t.lastLanding?.quality).toBe('ren');
  });

  it('backflip lander rent', () => {
    const { t } = rideMedium(0, -360);
    expect(t.lastLanding?.name).toBe('Backflip');
    expect(t.lastLanding?.quality).toBe('ren');
  });

  it('540 + frontflip går an', () => {
    const { t } = rideMedium(540, 360);
    expect(t.lastLanding?.name).toBe('540 + Frontflip');
    expect(t.lastLanding?.quality).not.toBe('fall');
  });

  it('kameraet snurrer ikke med: følger fartsretningen, likt med og uten spinn', () => {
    const plain = rideMedium(0, 0, true);
    const spun = rideMedium(720, 0, true);
    expect(spun.camYaws.length).toBeGreaterThan(50);
    expect(spun.camYaws).toEqual(plain.camYaws);
    const turned = Math.max(...spun.camYaws) - Math.min(...spun.camYaws);
    expect(turned / DEG).toBeLessThan(3);
  });
});

describe('visning i HUD', () => {
  it('viser triksnavn og landing, men ikke et vanlig hopp uten triks', async () => {
    const { landingText } = await import('../src/ui/hud');
    expect(landingText(judgeLanding(0, 0)).sub).toBe('');
    expect(landingText(judgeLanding(540 * DEG, 360 * DEG))).toEqual({ title: '540 + Frontflip', sub: 'Ren landing' });
    expect(landingText(judgeLanding(395 * DEG, 0)).sub).toBe('Slurvete landing');
    expect(landingText(judgeLanding(90 * DEG, 0)).sub).toBe('Fall');
  });
});

describe('switch (lening)', () => {
  it('switch følger stillingen du landet i, ikke spinnet underveis', () => {
    const t = createTricks();
    stepTricks(t, { spin: 0, flip: 0, grounded: false }, dt);
    t.spin = 90 * DEG; // midt i et spinn: fortsatt ikke switch
    expect(isSwitch(t)).toBe(false);
    t.spin = 185 * DEG;
    stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    expect(isSwitch(t)).toBe(true);
  });
});

/**
 * Ekte fysikk på et hopp: spilleren trykker spinn (eller backflip) rett etter avsats og slipper
 * nøyaktig når rotasjonen når releaseDeg, slik Daniel gjør når han ser at han er rundt.
 */
function releaseAt(kickerIndex: number, releaseDeg: number, axis: 'spin' | 'flip') {
  const s = createSkier();
  const t = createTricks();
  const latch = createLatch();
  const kicker = PARK.kickers[kickerIndex];
  let tookOff = false, released = false;
  for (let i = 0; i < 80 * CONFIG.physicsHz; i++) {
    const near = s.z > kicker.z - 5 && s.z < kicker.z + 90;
    let steer = 0, flip = 0;
    if (!s.grounded && near) {
      tookOff = true;
      const done = axis === 'spin' ? t.spin - t.spinStart : -(t.flip - t.flipStart);
      if (done >= releaseDeg * DEG) released = true;
      if (!released) { if (axis === 'spin') steer = 1; else flip = -1; }
    }
    const onSnow = s.grounded;
    const c = splitControls({ steer, brake: 0, flip }, onSnow, latch, dt);
    stepSkier(s, c.skier, dt);
    stepTricks(t, { spin: c.spin, flip: c.flip, grounded: s.grounded }, dt);
    if (tookOff && s.grounded) break;
  }
  return { landing: t.lastLanding!, released };
}

describe('slipp når trikset er nådd = ren landing (ekte fysikk på hoppene)', () => {
  const cases: [number, number][] = [[0, 360], [1, 360], [1, 540], [1, 720], [2, 360], [2, 540], [2, 720]];
  for (const [k, deg] of cases) {
    const name = PARK.kickers[k].name;
    it(`${name} hopp: slipp ved ${deg} gir ren ${deg}`, () => {
      const r = releaseAt(k, deg, 'spin');
      expect(r.released).toBe(true);
      expect(r.landing.name).toBe(String(deg));
      expect(r.landing.quality).toBe('ren');
    });
    it(`${name} hopp: slipp 90° for tidlig eller hold 90° for lenge er ikke ren`, () => {
      expect(releaseAt(k, deg - 90, 'spin').landing.quality).not.toBe('ren');
      const long = releaseAt(k, deg + 90, 'spin');
      expect(long.released).toBe(true);
      expect(long.landing.quality).not.toBe('ren');
    });
  }
  it('backflip: slipp ved 360 gir ren backflip (medium og stort hopp)', () => {
    for (const k of [1, 2]) {
      const r = releaseAt(k, 360, 'flip');
      expect(r.landing.name).toBe('Backflip');
      expect(r.landing.quality).toBe('ren');
    }
  });
});
