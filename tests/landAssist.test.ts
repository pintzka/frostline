import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame as createCoreGame, stepGame as stepCoreGame, timeToLand } from '../src/core/game';
import { createGame, stepGame, type Game, type GameInput } from '../src/ui/flow';
import { createPlayer, createRecorder, recordStep, stepPlayer } from '../src/ui/replay';
import { assistTarget, createTricks, stepTricks, type Landing } from '../src/tricks/rotation';
import { PARK } from '../src/park/terrain';
import type { RawControls } from '../src/tricks/controls';
import { parseAssist } from '../src/ui/assistUi';

/**
 * Landingshjelp: slipper du nær en ren stilling, fullfører spillet rolig resten.
 * Ekte fysikk på hoppene (core/game.ts), så det er slik det blir i spillet.
 */
const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const spinMax = CONFIG.spinSpeedDeg * DEG;
const flipMax = CONFIG.flipSpeedDeg * DEG;

interface Plan {
  /** spinn: grader å slippe ved (0 = ikke spinn), positiv = høyre */
  spin?: number;
  /** flip: grader å slippe ved, negativ = backflip */
  flip?: number;
}

/**
 * Kjører ned til hoppet og trykker spinn/flip rett etter avsatsen, og slipper når rotasjonen når målet.
 * Gir landingen, og største endring i rotasjonsfarten per steg i lufta etter slipp.
 */
function jump(kicker: number, plan: Plan, assist: boolean) {
  const g = createCoreGame();
  g.landingAssist = assist;
  const k = PARK.kickers[kicker];
  let tookOff = false, spinDone = !plan.spin, flipDone = !plan.flip;
  let worstSpin = 0, worstFlip = 0, fastestAssist = 0, rateAtRelease = 0;
  for (let i = 0; i < 80 * CONFIG.physicsHz; i++) {
    const s = g.skier, t = g.tricks;
    const near = s.z > k.z - 5 && s.z < k.z + 90;
    const raw: RawControls = { steer: 0, brake: 0, flip: 0 };
    if (!s.grounded && near) {
      tookOff = true;
      const ds = t.spin - t.spinStart, df = t.flip - t.flipStart;
      if (!spinDone && Math.abs(ds) >= Math.abs(plan.spin!) * DEG) { spinDone = true; rateAtRelease = Math.abs(t.spinRate); }
      if (!flipDone && Math.abs(df) >= Math.abs(plan.flip!) * DEG) flipDone = true;
      if (!spinDone) raw.steer = Math.sign(plan.spin!);
      if (!flipDone) raw.flip = Math.sign(plan.flip!);
    }
    const s0 = t.spinRate, f0 = t.flipRate, air = !s.grounded;
    stepCoreGame(g, raw, dt);
    if (air && !g.skier.grounded) {
      worstSpin = Math.max(worstSpin, Math.abs(t.spinRate - s0));
      worstFlip = Math.max(worstFlip, Math.abs(t.flipRate - f0));
      if (spinDone && plan.spin) fastestAssist = Math.max(fastestAssist, Math.abs(t.spinRate));
    }
    if (tookOff && g.tricks.justLanded) break;
  }
  return { landing: g.tricks.lastLanding as Landing, worstSpin, worstFlip, fastestAssist, rateAtRelease };
}

const show = (l: Landing) => `${l.name || '–'} ${l.quality} (spinn ${l.spinDeg.toFixed(0)}°, flip ${l.flipDeg.toFixed(0)}°)`;

describe('målet: nærmeste rene stilling i retningen du roterer', () => {
  const t = (deg: number, rateDeg = 0, step = 180) =>
    assistTarget(deg * DEG, rateDeg * DEG, 0, 0, step * DEG, step === 180 ? CONFIG.landAssistSpinAheadDeg : CONFIG.landAssistFlipAheadDeg,
      step === 180 ? CONFIG.spinCoastDeg : CONFIG.flipCoastDeg, step === 180 ? CONFIG.spinSpeedDeg : CONFIG.flipSpeedDeg);
  const deg = (x: number | null) => (x === null ? null : Math.round(x / DEG));
  it(`spinn: mangler du opptil ${CONFIG.landAssistSpinAheadDeg}°, fullføres den; litt forbi trekkes tilbake`, () => {
    expect(deg(t(300))).toBe(360);
    expect(deg(t(640))).toBe(720);
    expect(deg(t(100))).toBe(180); // en halv runde (switch) er også rent
    expect(deg(t(380))).toBe(360);
    expect(deg(t(-300))).toBe(-360);
    // for lite: ingen hjelp
    expect(t(225)).toBeNull();
    expect(t(60 + 180)).toBeNull();
  });
  it('regner med glidet: 300° i full fart glir til ca. 325°, målet er 360', () => {
    expect(deg(t(300, CONFIG.spinSpeedDeg))).toBe(360);
    // aldri flere rotasjoner enn neste rene stilling: 350° i full fart glir til 375°, trekkes tilbake til 360
    expect(deg(t(350, CONFIG.spinSpeedDeg))).toBe(360);
  });
  it(`flip: bare hele runder, opptil ${CONFIG.landAssistFlipAheadDeg}° fram`, () => {
    expect(deg(t(-290, 0, 360))).toBe(-360);
    expect(deg(t(280, 0, 360))).toBe(360);
    expect(t(-200, 0, 360)).toBeNull();
    expect(t(200, 0, 360)).toBeNull();
    expect(deg(t(20, 0, 360))).toBe(0);
  });
});

describe('landingshjelp med ekte fysikk på hoppene', () => {
  it('spinn sluppet ved 270° på det medium hoppet: ren 360 med hjelp, fall uten', () => {
    const on = jump(1, { spin: 270 }, true), off = jump(1, { spin: 270 }, false);
    console.log(`270: med ${show(on.landing)}, uten ${show(off.landing)}`);
    expect(on.landing.name).toBe('360');
    expect(on.landing.quality).toBe('ren');
    expect(off.landing.quality).toBe('fall');
  });

  it('spinn sluppet ved 300°: ren 360 med hjelp, ikke ren uten (alle hopp)', () => {
    for (const k of [0, 1, 2]) {
      const on = jump(k, { spin: 300 }, true), off = jump(k, { spin: 300 }, false);
      console.log(`${PARK.kickers[k].name} 300: med ${show(on.landing)}, uten ${show(off.landing)}`);
      expect(on.landing.name).toBe('360');
      expect(on.landing.quality).toBe('ren');
      expect(off.landing.quality).not.toBe('ren');
    }
  });

  it('spinn sluppet ved 640° gir ren 720 (medium og stort hopp), uten hjelp fall', () => {
    for (const k of [1, 2]) {
      const on = jump(k, { spin: 640 }, true), off = jump(k, { spin: 640 }, false);
      console.log(`${PARK.kickers[k].name} 640: med ${show(on.landing)}, uten ${show(off.landing)}`);
      expect(on.landing.name).toBe('720');
      expect(on.landing.quality).toBe('ren');
      expect(off.landing.quality).toBe('fall');
    }
  });

  it('backflip sluppet ved 290° gir ren backflip med hjelp, fall uten', () => {
    for (const k of [1, 2]) {
      const on = jump(k, { flip: -290 }, true), off = jump(k, { flip: -290 }, false);
      console.log(`${PARK.kickers[k].name} backflip 290: med ${show(on.landing)}, uten ${show(off.landing)}`);
      expect(on.landing.name).toBe('Backflip');
      expect(on.landing.quality).toBe('ren');
      expect(off.landing.quality).toBe('fall');
    }
  });

  it('cork: spinn sluppet ved 640° og flip ved 300° gir ren Cork 720', () => {
    const on = jump(2, { spin: 640, flip: 300 }, true), off = jump(2, { spin: 640, flip: 300 }, false);
    console.log(`cork 640/300: med ${show(on.landing)}, uten ${show(off.landing)}`);
    expect(on.landing.offAxis).toBe(true);
    expect(on.landing.name).toBe('Cork 720');
    expect(on.landing.quality).toBe('ren');
    expect(off.landing.quality).not.toBe('ren');
  });

  it('roterer du altfor lite, redder den deg ikke (200° spinn, 150° flip)', () => {
    for (const k of [1, 2]) {
      const spin = jump(k, { spin: 200 }, true);
      const flip = jump(k, { flip: -150 }, true);
      console.log(`${PARK.kickers[k].name} for lite: spinn ${show(spin.landing)}, flip ${show(flip.landing)}`);
      expect(spin.landing.quality).not.toBe('ren');
      expect(spin.landing.name).not.toBe('360');
      expect(flip.landing.quality).toBe('fall');
    }
  });

  it('legger aldri til rotasjoner, og roterer aldri raskere enn du selv kan', () => {
    const r = jump(1, { spin: 300 }, true);
    // spinner aldri forbi 360 mer enn litt
    expect(r.landing.spinDeg).toBeLessThan(360 + CONFIG.landSpinClean);
    // etter slipp: aldri raskere enn farten du slapp med (og aldri over din egen spinnfart)
    expect(r.fastestAssist).toBeLessThanOrEqual(r.rateAtRelease + 1e-9);
    expect(r.fastestAssist).toBeLessThanOrEqual(spinMax);
  });

  it('ingen brå endring i rotasjonsfarten per steg (maks 5 % av full fart, som når du slipper selv)', () => {
    for (const [k, plan] of [[1, { spin: 300 }], [2, { spin: 640 }], [1, { flip: -290 }], [2, { spin: 640, flip: 300 }], [0, { spin: 100 }]] as const) {
      const r = jump(k, plan, true);
      expect(r.worstSpin).toBeLessThan(spinMax * 0.05);
      expect(r.worstFlip).toBeLessThan(flipMax * 0.05);
    }
  });

  it('er deterministisk', () => {
    const a = jump(2, { spin: 640, flip: 300 }, true), b = jump(2, { spin: 640, flip: 300 }, true);
    expect(a).toEqual(b);
  });
});

describe('hjelpen kjemper aldri imot', () => {
  it('ingen hjelp mens tasten holdes: samme rotasjon med og uten', () => {
    const run = (assist: boolean) => {
      const t = createTricks();
      const out: number[] = [];
      for (let i = 0; i < 240; i++) {
        // spinn holdes hele tiden, flip holdes litt og slippes ved ca. 150° (for langt unna til å få hjelp)
        stepTricks(t, { spin: 1, flip: i < 100 ? -1 : 0, grounded: false, assist, toLand: 0.5 }, dt);
        out.push(t.spin, t.spinRate);
      }
      return out;
    };
    expect(run(true)).toEqual(run(false));
  });

  it('hjelpen virker bare på aksen du har sluppet: flip holdes, spinnet fullføres', () => {
    const t = createTricks();
    for (let i = 0; i < 100; i++) stepTricks(t, { spin: 1, flip: 0, grounded: false }, dt);
    const flips: number[] = [];
    const u = createTricks();
    for (let i = 0; i < 100; i++) stepTricks(u, { spin: 1, flip: 0, grounded: false }, dt);
    for (let i = 0; i < 200; i++) {
      stepTricks(t, { spin: 0, flip: 1, grounded: false, assist: true, toLand: 1 }, dt);
      stepTricks(u, { spin: 0, flip: 1, grounded: false }, dt);
      flips.push(t.flip - u.flip);
    }
    // flipen er lik, spinnet ble hjulpet inn mot nærmeste rene stilling (180)
    expect(flips.every((d) => d === 0)).toBe(true);
    expect(Math.abs(t.spin - Math.PI)).toBeLessThan(Math.abs(u.spin - Math.PI));
    expect(Math.abs(t.spin - Math.PI) / DEG).toBeLessThan(2);
  });

  it('blir litt sterkere jo nærmere landingen er', () => {
    const fast = (toLand: number) => {
      const t = createTricks();
      t.inAir = true;
      t.spin = 300 * DEG;
      for (let i = 0; i < 60; i++) stepTricks(t, { spin: 0, flip: 0, grounded: false, assist: true, toLand }, dt);
      return t.spinRate;
    };
    expect(fast(0.3)).toBeGreaterThan(fast(2));
    expect(fast(0.05) / DEG).toBeLessThanOrEqual(CONFIG.landAssistSpinMaxDeg + 1e-9);
  });

  it('anslått tid til landing: høyde over snøen og fart ned', () => {
    const g = createCoreGame();
    const s = g.skier;
    s.y += 4.9; s.vy = 0; s.vx = 0; s.vz = 0; s.grounded = false;
    expect(timeToLand(s)).toBeCloseTo(Math.sqrt((2 * 4.9) / CONFIG.gravity), 1);
    s.vy = -10;
    expect(timeToLand(s)).toBeLessThan(0.5);
  });
});

describe('innstillingen', () => {
  it('På som standard, Av bare når Av er lagret', () => {
    expect(parseAssist(null)).toBe(true);
    expect(parseAssist('1')).toBe(true);
    expect(parseAssist('0')).toBe(false);
    expect(createCoreGame().landingAssist).toBe(true);
  });
});

describe('landingshjelp Av = som før', () => {
  it('stepTricks uten assist er nøyaktig lik med assist: false', () => {
    const run = (assist?: boolean) => {
      const t = createTricks();
      for (let i = 0; i < 400; i++) {
        const air = i < 330;
        stepTricks(t, { spin: i < 70 ? 1 : 0, flip: i > 20 && i < 90 ? -1 : 0, grounded: !air, assist }, dt);
      }
      return JSON.stringify(t);
    };
    expect(run(false)).toBe(run(undefined));
  });
});

describe('reprise med landingshjelp', () => {
  const none: RawControls = { steer: 0, brake: 0, flip: 0, pop: false, grab: 0 };

  /** En hel runde: slipper spinnet ved 300° på hvert hopp, og bytter landingshjelp underveis (som i pausen). */
  function run(g: Game, r: ReturnType<typeof createRecorder>) {
    let i = 0, helped = 0;
    for (; g.flow.phase === 'kjorer' && i < 200 * CONFIG.physicsHz; i++) {
      const s = g.skier, t = g.tricks;
      const raw: RawControls = { ...none };
      if (!s.grounded && Math.abs(t.spin - t.spinStart) < 300 * DEG && s.airTime < 0.8) raw.steer = 1;
      const inp: GameInput = { raw, click: false, restart: false };
      // av en stund midt i runden, så på igjen
      if (i === 20 * CONFIG.physicsHz) inp.assist = false;
      if (i === 35 * CONFIG.physicsHz) inp.assist = true;
      const ev = stepGame(g, inp, dt);
      recordStep(r, g, inp, ev);
      if (g.tricks.justLanded && g.tricks.lastLanding?.name === '360') helped++;
    }
    return helped;
  }

  it('avspillingen blir identisk, og valget er med i opptaket', () => {
    const g = createGame();
    const r = createRecorder();
    const start: GameInput = { raw: { ...none }, click: true, restart: false, assist: true };
    recordStep(r, g, start, stepGame(g, start, dt));
    expect(r.rec?.start.landingAssist).toBe(true);
    const helped = run(g, r);
    expect(helped).toBeGreaterThan(0);
    expect(r.rec?.finished).toBe(true);
    // bytt valget etterpå: reprisen skal likevel bli lik runden
    g.landingAssist = false;
    const p = createPlayer(r.rec!);
    for (let i = 0; i < r.rec!.steps; i++) stepPlayer(p, dt);
    const strip = (x: Game) => JSON.parse(JSON.stringify({ ...x, landingAssist: 0, best: 0 }));
    expect(strip(p.game).skier).toEqual(strip(g).skier);
    expect(strip(p.game).score).toEqual(strip(g).score);
    expect(p.game.flow.stats).toEqual(g.flow.stats);
  });

  it('runde startet med hjelp Av spilles av med hjelp Av', () => {
    const g = createGame();
    g.landingAssist = false;
    const r = createRecorder();
    const start: GameInput = { raw: { ...none }, click: true, restart: false };
    recordStep(r, g, start, stepGame(g, start, dt));
    expect(r.rec?.start.landingAssist).toBe(false);
  });
});
