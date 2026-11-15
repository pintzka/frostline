import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createTricks, judgeLanding, stepTricks, type JumpExtras, type TrickState } from '../src/tricks/rotation';
import { countedGrab, createGrabs, stepGrabs, type GrabKind } from '../src/tricks/grabs';
import { comboMult, createScore, isRealTrick, scoreLanding, stepScore, trickValue } from '../src/tricks/score';
import { createLatch, splitControls } from '../src/tricks/controls';

const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;

/** En landing med så mange grader spinn og flip (helt rent hvis tallene er hele/halve runder), fra et ekte hopp (1,5 s i lufta). */
const land = (spinDeg: number, flipDeg = 0, extras: JumpExtras = {}) => judgeLanding(spinDeg * DEG, flipDeg * DEG, { airTime: 1.5, ...extras });

/** Flyr ett hopp i trikslogikken: holder grab i så mange sekunder og lander. */
function jumpWithGrab(t: TrickState, grab: GrabKind, holdSeconds: number, airSeconds = 1.2) {
  const n = Math.round(airSeconds / dt);
  const hold = Math.round(holdSeconds / dt);
  for (let i = 0; i < n; i++) stepTricks(t, { spin: 0, flip: 0, grounded: false, grab: i < hold ? grab : 0 }, dt);
  stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
  return t.lastLanding!;
}

describe('grabs', () => {
  it('en grab under 0,3 s teller ikke', () => {
    const l = jumpWithGrab(createTricks(), 1, 0.25);
    expect(l.grab).toBe(0);
    expect(l.name).toBe('');
    expect(isRealTrick(l)).toBe(false);
  });

  it('en grab over 0,3 s teller og får navn', () => {
    const l = jumpWithGrab(createTricks(), 2, 0.5);
    expect(l.grab).toBe(2);
    expect(l.name).toBe('Isbit');
    expect(l.grabTime).toBeCloseTo(0.5, 1);
    expect(isRealTrick(l)).toBe(true);
  });

  it('teller bare i lufta, og den lengste grabben i hoppet vinner', () => {
    const g = createGrabs();
    for (let i = 0; i < 240; i++) stepGrabs(g, 1, false, dt);
    expect(countedGrab(g)).toBe(0);
    for (let i = 0; i < 0.4 * 240; i++) stepGrabs(g, 1, true, dt);
    for (let i = 0; i < 0.6 * 240; i++) stepGrabs(g, 3, true, dt);
    expect(countedGrab(g)).toBe(3);
  });

  it('kroppen bøyer seg mykt: starter rolig og rykker aldri, heller ikke ved landing (60 bilder/s)', () => {
    const t = createTricks();
    const frames: number[][] = [];
    for (let i = 0; i < 480; i++) {
      const grounded = i > 300;
      stepTricks(t, { spin: 0, flip: 0, grounded, grab: i > 20 && i < 200 ? 1 : i >= 200 ? 3 : 0 }, dt);
      if (i % 4 === 0) frames.push([...t.grabs.blend]);
    }
    let biggest = 0, first = 0;
    for (let f = 1; f < frames.length; f++) {
      const d = Math.max(...frames[f].map((b, k) => Math.abs(b - frames[f - 1][k])));
      biggest = Math.max(biggest, d);
      if (f === 6) first = d; // første bilde etter at J trykkes (steg 21–24)
    }
    // første bilde: under 3 % av bøyen. Aldri mer enn 8 % per bilde (armen i Nordlys: 1,25 rad × 8 % ≈ 6°)
    expect(first).toBeLessThan(0.03);
    expect(biggest).toBeLessThan(0.08);
    expect(1.25 * biggest / DEG).toBeLessThan(6);
    expect(Math.max(...t.grabs.blend)).toBeLessThan(0.02);
    expect(Math.min(...t.grabs.blend)).toBeGreaterThan(-0.02); // skyter ikke over
  });

  it('J/K/L går bare til grab i lufta, ikke på bakken', () => {
    const latch = createLatch();
    expect(splitControls({ steer: 0, brake: 0, flip: 0, grab: 2 }, true, latch, dt).grab).toBe(0);
    expect(splitControls({ steer: 0, brake: 0, flip: 0, grab: 2 }, false, latch, dt).grab).toBe(2);
  });

  it('grabben vokser jo lenger du holder', () => {
    const short = trickValue(land(0, 0, { grab: 1, grabTime: 0.4 }));
    const long = trickValue(land(0, 0, { grab: 1, grabTime: 1.2 }));
    expect(long).toBeGreaterThan(short * 1.3);
  });
});

describe('poengtabell', () => {
  it('bare ekte triks gir poeng: 540+, en flip eller en grab', () => {
    expect(trickValue(land(0))).toBe(0);
    expect(trickValue(land(180))).toBe(0);
    expect(trickValue(land(360))).toBe(0);
    expect(trickValue(land(540))).toBeGreaterThan(0);
    expect(trickValue(land(0, -360))).toBeGreaterThan(0);
    expect(trickValue(land(360, 0, { grab: 1, grabTime: 0.5 }))).toBeGreaterThan(0);
  });

  it('følger tabellen i config', () => {
    expect(trickValue(land(540))).toBe(CONFIG.spinPoints[3]);
    expect(trickValue(land(720))).toBe(CONFIG.spinPoints[4]);
    expect(trickValue(land(1080))).toBe(CONFIG.spinPoints[6]);
    expect(trickValue(land(0, 360))).toBe(CONFIG.flipPoints[1]);
    expect(trickValue(land(540, -360))).toBe(CONFIG.spinPoints[3] + CONFIG.flipPoints[1]);
    // over tabellen: fortsetter å vokse
    expect(trickValue(land(1980))).toBe(CONFIG.spinPoints[9] + 2 * CONFIG.spinPointsExtra);
  });

  it('store triks gir mye mer enn små (bratt kurve)', () => {
    const v = (deg: number) => trickValue(land(deg));
    expect(v(1080)).toBeGreaterThan(5 * v(540));
    expect(v(720)).toBeGreaterThan(1.8 * v(540));
    expect(v(1080)).toBeGreaterThan(2.5 * v(720));
    // hvert steg opp gir mer ekstra enn steget før
    const steps = [540, 720, 900, 1080, 1260, 1440, 1620, 1800].map(v);
    for (let i = 2; i < steps.length; i++) expect(steps[i] - steps[i - 1]).toBeGreaterThan(steps[i - 1] - steps[i - 2]);
    expect(trickValue(land(0, 720))).toBeGreaterThan(2 * trickValue(land(0, 360)));
  });

  it('grab og perfekt pop ganger opp', () => {
    const plain = trickValue(land(720, -360));
    const grab = trickValue(land(720, -360, { grab: 2, grabTime: 0.3 }));
    expect(grab).toBeCloseTo((plain + CONFIG.grabPoints) * CONFIG.grabStartMult, 6);
    expect(trickValue(land(720, -360, { perfectPop: true }))).toBeCloseTo(plain * CONFIG.popPerfectMult, 6);
  });
});

describe('landing, gjentakelse og kombo', () => {
  it('ren landing full sum, slurvete halv, fall null', () => {
    const ren = scoreLanding(createScore(), land(720))!;
    const slurvete = scoreLanding(createScore(), land(720 + 40))!;
    const fall = scoreLanding(createScore(), land(720 + 90))!;
    expect(ren.quality).toBe('ren');
    expect(slurvete.quality).toBe('slurvete');
    expect(fall.quality).toBe('fall');
    expect(ren.points).toBe(CONFIG.spinPoints[4]);
    expect(slurvete.points).toBe(CONFIG.spinPoints[4] / 2);
    expect(fall.points).toBe(0);
  });

  it('et lite hopp uten ekte triks gir ingen poeng og endrer ikke komboen', () => {
    const s = createScore();
    scoreLanding(s, land(540));
    const small = scoreLanding(s, land(360))!;
    expect(small.points).toBe(0);
    expect(small.tooSmall).toBe(true);
    expect(scoreLanding(s, land(0))).toBeNull();
    expect(s.total).toBe(CONFIG.spinPoints[3]);
    expect(s.comboCount).toBe(1);
  });

  it('samme triks igjen gir mindre, et nytt triks gir full verdi', () => {
    const s = createScore();
    // komboen nullstilles hver gang, så vi ser bare gjentakelsen
    const run = (deg: number, flip = 0, extras: JumpExtras = {}) => { s.comboCount = 0; return scoreLanding(s, land(deg, flip, extras))!; };
    const first = run(720), second = run(720), third = run(720);
    expect(second.points).toBeLessThan(first.points * 0.7);
    expect(third.points).toBeLessThan(second.points);
    expect(run(0, -360).repeat).toBe(1); // backflip er et nytt triks
  });

  it('samme 540 seks ganger gir stadig mindre, men aldri under minimum', () => {
    const s = createScore();
    const shares = [0, 1, 2, 3, 4, 5].map(() => { s.comboCount = 0; return scoreLanding(s, land(540))!.repeat; });
    expect(shares[0]).toBe(1);
    for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeLessThan(shares[i - 1] + 1e-9);
    expect(shares[5]).toBeLessThan(0.3);
    expect(shares[5]).toBeGreaterThanOrEqual(CONFIG.repeatMin);
  });

  it('A-B-A-B straffes også (de siste triksene huskes, ikke bare det forrige)', () => {
    const s = createScore();
    const run = (deg: number) => { s.comboCount = 0; return scoreLanding(s, land(deg))!; };
    run(540); run(720);
    expect(run(540).repeat).toBeLessThan(1);
    expect(run(720).repeat).toBeLessThan(1);
  });

  it('andre spinnretning eller switch er ikke et nytt triks, men switch gir en liten bonus', () => {
    const s = createScore();
    const run = (deg: number, extras: JumpExtras = {}) => { s.comboCount = 0; return scoreLanding(s, land(deg, 0, extras))!; };
    run(540);
    expect(run(-540).repeat).toBeLessThan(1);
    expect(run(540, { fromSwitch: true }).repeat).toBeLessThan(1);
    expect(trickValue(land(540, 0, { fromSwitch: true }))).toBeCloseTo(trickValue(land(540)) * CONFIG.switchBonus, 6);
  });

  it('småhopp på flaten gir bare litt og bygger ikke komboen', () => {
    const s = createScore();
    scoreLanding(s, land(540));
    const small = scoreLanding(s, land(0, 0, { grab: 2, grabTime: 0.5, airTime: 0.7 }))!;
    expect(small.smallJump).toBe(true);
    expect(small.points).toBeLessThan(0.1 * trickValue(land(0, 0, { grab: 2, grabTime: 0.5 })));
    expect(comboMult(s)).toBe(1.25);
  });

  it('pop-spam med grabs på flaten lønner seg mye mindre enn ekte hopp', () => {
    // 40 pops på flaten (0,7 s i lufta) med J/K/L om hverandre, mot tre ekte hopp med 540 + Isbit
    const spam = createScore();
    for (let i = 0; i < 40; i++) {
      scoreLanding(spam, land(0, 0, { grab: ((i % 3) + 1) as GrabKind, grabTime: 0.4, airTime: 0.7 }));
      stepScore(spam, true, 0.25);
    }
    const jumps = createScore();
    for (const air of [1.2, 2.0, 2.5]) {
      scoreLanding(jumps, land(540, 0, { grab: 2, grabTime: air - 0.6, airTime: air }));
      stepScore(jumps, true, 5);
    }
    expect(comboMult(spam)).toBe(1);
    expect(jumps.total).toBeGreaterThan(2 * spam.total);
  });

  it('kombo bygges med +0,25x for hvert ekte triks med ren landing', () => {
    const s = createScore();
    const tricks = [540, 720, -540, 900];
    const results = tricks.map((d) => scoreLanding(s, land(d))!);
    expect(results.map((r) => r.combo)).toEqual([1, 1.25, 1.5, 1.75]);
    expect(results[3].points).toBe(Math.round(CONFIG.spinPoints[5] * 1.75 / 10) * 10);
    expect(comboMult(s)).toBe(2);
    expect(s.total).toBe(results.reduce((a, r) => a + r.points, 0));
  });

  it('slurvete beholder komboen, men bygger den ikke', () => {
    const s = createScore();
    scoreLanding(s, land(540));
    scoreLanding(s, land(760));
    expect(comboMult(s)).toBe(1.25);
  });

  it('et fall vises alltid, også uten triksnavn, og sier fra når komboen ble tapt', async () => {
    const { resultText } = await import('../src/ui/hud');
    const s = createScore();
    const plain = scoreLanding(s, land(90))!;
    expect(resultText(plain)).toEqual({ title: 'Fall', sub: '' });
    scoreLanding(s, land(540));
    const lost = scoreLanding(s, land(90))!;
    expect(resultText(lost)).toEqual({ title: 'Fall', sub: 'Kombo tapt' });
  });

  it('lander du mens du holder grabben, blir landingen slurvete (halve poeng)', () => {
    const held = land(720, 0, { grab: 1, grabTime: 1, stillGrabbing: true });
    expect(held.quality).toBe('slurvete');
    expect(held.landedGrabbing).toBe(true);
    expect(land(720, 0, { grab: 1, grabTime: 1 }).quality).toBe('ren');
    // en kort tast-trykk (grab som ikke teller) gir ingen straff
    expect(land(0, 0, { stillGrabbing: true }).quality).toBe('ren');
  });

  it('fall nullstiller komboen, men poengene du har fått beholdes', () => {
    const s = createScore();
    scoreLanding(s, land(540));
    scoreLanding(s, land(720));
    const before = s.total;
    scoreLanding(s, land(990));
    expect(comboMult(s)).toBe(1);
    expect(s.total).toBe(before);
  });

  it('lang tid på snøen uten triks nullstiller komboen, men tid i lufta teller ikke', () => {
    const s = createScore();
    scoreLanding(s, land(540));
    for (let i = 0; i < 20 * 240; i++) stepScore(s, false, dt);
    expect(comboMult(s)).toBe(1.25);
    for (let i = 0; i < (CONFIG.comboTimeout - 0.5) * 240; i++) stepScore(s, true, dt);
    expect(comboMult(s)).toBe(1.25);
    for (let i = 0; i < 1 * 240; i++) stepScore(s, true, dt);
    expect(comboMult(s)).toBe(1);
  });

  it('er deterministisk', () => {
    const play = () => {
      const s = createScore();
      for (const d of [540, 720, 720, 1080, 900, 400, 540]) { scoreLanding(s, land(d, 0, { grab: 1, grabTime: 0.7 })); stepScore(s, true, 2); }
      return s;
    };
    expect(play()).toEqual(play());
  });
});

describe('poeng i lufta (trikslogikken)', () => {
  it('husker perfekt pop fra avsatsen til landingen', () => {
    const t = createTricks();
    stepTricks(t, { spin: 0, flip: 0, grounded: false, perfectPop: true }, dt);
    for (let i = 0; i < 200; i++) stepTricks(t, { spin: 0, flip: -1, grounded: false }, dt);
    stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    expect(t.justLanded).toBe(true);
    expect(t.lastLanding!.perfectPop).toBe(true);
    stepTricks(t, { spin: 0, flip: 0, grounded: true }, dt);
    expect(t.justLanded).toBe(false);
  });
});

describe('poeng i HUD', () => {
  it('viser triksnavn, poeng og kombo', async () => {
    const { resultText, formatPoints, formatMult } = await import('../src/ui/hud');
    expect(formatPoints(4200)).toBe('4 200');
    expect(formatPoints(1234567)).toBe('1 234 567');
    expect(formatMult(1.5)).toBe('x1,5');
    const s = createScore();
    scoreLanding(s, land(540));
    const r = scoreLanding(s, land(720, -360, { grab: 1, grabTime: 1.0 }))!;
    const t = resultText(r);
    expect(t.title).toBe(`720 + Backflip + Nordlys · ${formatPoints(r.points)}`);
    expect(t.sub).toBe('Ren landing · kombo x1,25');
    expect(resultText(scoreLanding(createScore(), land(360))!).sub).toBe('Ren landing · for lite for poeng');
  });

  it('totalen teller mykt opp, men hopper rett til 0 ved ny runde', async () => {
    const { countUp } = await import('../src/ui/hud');
    let shown = 0;
    shown = countUp(shown, 4200, 1 / 60);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(1000);
    for (let i = 0; i < 120; i++) shown = countUp(shown, 4200, 1 / 60);
    expect(shown).toBe(4200);
    expect(countUp(19000, 0, 1 / 60)).toBe(0);
  });

  it('teksten kommer inn og blekner mykt, uten hopp', async () => {
    const { fadeInOut } = await import('../src/ui/hud');
    const show = CONFIG.trickShowTime;
    expect(fadeInOut(0, show)).toBe(0);
    expect(fadeInOut(0.5, show)).toBe(1);
    expect(fadeInOut(show, show)).toBe(0);
    let biggest = 0;
    for (let a = 0; a < show + 0.1; a += 1 / 60) biggest = Math.max(biggest, Math.abs(fadeInOut(a + 1 / 60, show) - fadeInOut(a, show)));
    expect(biggest).toBeLessThan(0.15);
  });
});

describe('grab på det medium hoppet (ekte fysikk)', () => {
  it('holder K hele hoppet: grabben teller, landingen er ren og gir poeng', async () => {
    const { createSkier, stepSkier } = await import('../src/physics/skier');
    const { PARK } = await import('../src/park/terrain');
    const s = createSkier();
    const t = createTricks();
    const score = createScore();
    const latch = createLatch();
    const k = PARK.kickers[1];
    let result = null;
    for (let i = 0; i < 60 * CONFIG.physicsHz && !result; i++) {
      const near = s.z > k.z - 5 && s.z < k.z + 80;
      // hold K de første 0,8 s i lufta, slipp før landing
      const c = splitControls({ steer: 0, brake: 0, flip: 0, grab: near && s.airTime < 0.8 ? 2 : 0 }, s.grounded, latch, dt);
      stepSkier(s, c.skier, dt);
      stepTricks(t, { spin: c.spin, flip: c.flip, grab: c.grab, grounded: s.grounded }, dt);
      if (t.justLanded && t.lastLanding && near && t.lastLanding.grab) result = scoreLanding(score, t.lastLanding);
    }
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Isbit');
    expect(result!.quality).toBe('ren');
    expect(result!.points).toBeGreaterThan(CONFIG.grabPoints * CONFIG.grabStartMult);
  });
});

describe('hele runden med ekte fysikk: pop-spam mot ekte hopp', () => {
  /** Kjører hele bakken. spam = pop hvert 0,95 s på bakken; grab J/K/L om hverandre i lufta, sluppet før landing. */
  async function ride(spam: boolean) {
    const { createSkier, stepSkier, reachedEnd } = await import('../src/physics/skier');
    const s = createSkier();
    const t = createTricks();
    const score = createScore();
    const latch = createLatch();
    let jumps = 0, time = 0;
    for (let i = 0; i < 120 * CONFIG.physicsHz && !reachedEnd(s); i++) {
      time += dt;
      const pop = spam && time % 0.95 < 0.5;
      const grab = (!s.grounded && s.airTime > 0.05 && s.airTime < 0.8 ? (jumps % 3) + 1 : 0) as GrabKind;
      const c = splitControls({ steer: 0, brake: 0, flip: 0, pop, grab }, s.grounded, latch, dt);
      stepSkier(s, c.skier, dt);
      stepTricks(t, { spin: c.spin, flip: c.flip, grab: c.grab, grounded: s.grounded, perfectPop: s.lastPop === 'perfekt' && s.popAge < CONFIG.popTakeoffWindow }, dt);
      if (t.justLanded && t.lastLanding) { scoreLanding(score, t.lastLanding); jumps++; }
      stepScore(score, s.grounded, dt);
    }
    return score;
  }

  it('spam på flaten gir lite ekstra: hoppene er det som teller', async () => {
    const jumpsOnly = await ride(false);
    const spam = await ride(true);
    expect(jumpsOnly.total).toBeGreaterThan(0);
    // spam-boten tar også grabs på hoppene, så den får litt mer, men ikke mye
    expect(spam.total).toBeLessThan(jumpsOnly.total * 1.5);
  });
});
