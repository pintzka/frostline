import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame, stepGame, type Game } from '../src/core/game';
import { validatePark } from '../src/park/format';
import testbakke from '../src/park/parks/testbakke.json';
import { placeSkier, speedOf } from '../src/physics/skier';
import { railAt, railDir, railTop, RAILS, type RailShape } from '../src/physics/rail';
import { createCameraRig } from '../src/camera/rig';
import { createScore, scoreRail } from '../src/tricks/score';
import type { RawControls } from '../src/tricks/controls';

/** Rails og bokser: parkformatet, å komme på, gli, balanse, hoppe av, poeng og at ingenting rykker. */
const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const none: RawControls = { steer: 0, brake: 0, flip: 0, pop: false };
const byName = (n: string) => RAILS.find((r) => r.rail.name === n)!;
const box = byName('Boks'), rail = byName('Rail'), longBox = byName('Langboks');

function copy(): any {
  return JSON.parse(JSON.stringify(testbakke));
}

/** Setter skiløperen i lufta rett over railen, u meter fra starten, på vei ned. spinDeg = hvordan kroppen står. */
function aboveRail(g: Game, r: RailShape, u: number, opt: { spinDeg?: number; side?: number; speed?: number } = {}) {
  const s = g.skier;
  const speed = opt.speed ?? 18;
  const side = opt.side ?? 0;
  const [dx, dy, dz] = railDir(r, u);
  s.x = r.x0 + u * r.dx + side * r.dz;
  s.z = r.z0 + u * r.dz - side * r.dx;
  s.y = railTop(r, u) + 0.05;
  s.vx = dx * speed; s.vy = dy * speed - 1; s.vz = dz * speed;
  s.heading = r.yaw;
  s.grounded = false;
  s.airTime = 0.5;
  // et hopp er i gang
  g.tricks.inAir = true;
  g.tricks.spin = g.tricks.spinStart + (opt.spinDeg ?? 0) * DEG;
  g.takeoffZ = s.z - 10;
}

/** Kjører spillet til `until` er sant (eller tiden går ut). Gir antall steg. */
function run(g: Game, until: (g: Game) => boolean, controls: (g: Game, t: number) => RawControls = () => none, maxS = 10) {
  for (let i = 0; i < maxS * CONFIG.physicsHz; i++) {
    stepGame(g, controls(g, i * dt), dt);
    if (until(g)) return i + 1;
  }
  return -1;
}

describe('rails i parkfila', () => {
  it('testbakken med rails er gyldig, og rails kan sløyfes', () => {
    expect(validatePark(testbakke)).toEqual([]);
    const p = copy();
    delete p.rails;
    expect(validatePark(p)).toEqual([]);
    expect(RAILS.map((r) => r.rail.kind)).toEqual(['box', 'rail', 'box']);
  });
  it('sier fra på norsk om feil', () => {
    const bad = (change: (r: any) => void) => {
      const p = copy();
      change(p.rails[1]);
      return validatePark(p).join('\n');
    };
    expect(bad((r) => { r.kind = 'tube'; })).toContain('"rail" eller "box"');
    expect(bad((r) => { r.lenght = 3; })).toContain('ukjent felt "lenght"');
    expect(bad((r) => { delete r.height; })).toContain('mangler feltet "height"');
    expect(bad((r) => { r.length = 10; })).toContain('"length"');
    expect(bad((r) => { r.height = 3; })).toContain('"height"');
    expect(bad((r) => { r.angleDeg = 50; })).toContain('"angleDeg"');
    expect(bad((r) => { r.x = 30; })).toContain('før bollen');
    // midt på det lille hoppet
    expect(bad((r) => { r.x = 0; r.z = 150; })).toContain('står på hoppet «Lite»');
    // ute på siden, men over kanten inn til landingen
    expect(bad((r) => { r.x = -20; r.z = 170; })).toContain('kanten inn til landingen');
    expect(bad((r) => { r.name = 'Boks'; })).toContain('To rails heter «Boks»');
    expect(bad((r) => { r.x = 7; r.z = 50; })).toContain('for nær «Boks»');
  });
  it('står ikke i veien for hoppene: ingen rail nær midten der hoppene er, og ingen ved z der hoppene er', () => {
    for (const r of RAILS) {
      for (let u = 0; u <= r.rail.length; u += 1) {
        const x = r.x0 + u * r.dx, z = r.z0 + u * r.dz;
        expect(Math.abs(x)).toBeGreaterThan(5);
        for (const k of testbakke.kickers as any[]) {
          if (Math.abs(x) < k.width / 2 + k.sideWidth) expect(z < k.z - 35 || z > k.z + 90).toBe(true);
        }
      }
    }
  });
  it('toppen har riktig høyde over snøen, og starter i snøen', () => {
    expect(railTop(rail, 0) - railTop({ ...rail, rail: { ...rail.rail, height: 0 } }, 0)).toBeCloseTo(0, 6);
    const flat = { ...rail, rail: { ...rail.rail, height: 0 } };
    expect(railTop(rail, 20) - railTop(flat, 20)).toBeCloseTo(0.4, 6);
  });
});

describe('å komme på en rail', () => {
  it('kjører rett opp på boksen fra snøen, glir til slutten og lander rent', () => {
    const g = createGame();
    placeSkier(g.skier, box.x0, box.z0 - 15, 12);
    expect(run(g, (g) => g.rail.on)).toBeGreaterThan(0);
    expect(g.rail.style).toBe('5050');
    run(g, (g) => !g.rail.on);
    expect(g.score.last?.name).toMatch(/^50-50 \d,\d s$/);
    expect(g.score.last?.points).toBeGreaterThan(0);
    // lander i snøen etter boksen: ingen fall
    run(g, (g) => g.tricks.justLanded, () => none, 3);
    expect(g.tricks.lastLanding?.quality).toBe('ren');
    run(g, () => false, () => none, 1);
    expect(g.fall.time).toBe(99);
  });

  it('fra lufta langs railen: 50-50; på tvers: boardslide', () => {
    const a = createGame();
    aboveRail(a, rail, 18);
    run(a, (g) => g.rail.on, () => none, 0.1);
    expect(a.rail.style).toBe('5050');
    expect(a.rail.sloppy).toBe(false);
    const b = createGame();
    aboveRail(b, rail, 18, { spinDeg: 90 });
    run(b, (g) => g.rail.on, () => none, 0.1);
    expect(b.rail.style).toBe('boardslide');
    // baklengs er også 50-50
    const c = createGame();
    aboveRail(c, rail, 18, { spinDeg: -180 });
    run(c, (g) => g.rail.on, () => none, 0.1);
    expect(c.rail.style).toBe('5050');
  });

  it('litt skjevt (30°) går, men gir halve poeng; for skjevt (42°) faller du av', () => {
    const a = createGame();
    aboveRail(a, rail, 18, { spinDeg: 30 });
    run(a, (g) => g.rail.on, () => none, 0.1);
    expect(a.rail.on && a.rail.sloppy).toBe(true);
    run(a, (g) => !g.rail.on);
    expect(a.score.last?.quality).toBe('slurvete');
    const b = createGame();
    aboveRail(b, rail, 18, { spinDeg: 42 });
    run(b, (g) => g.tricks.justLanded, () => none, 2);
    expect(b.rail.on).toBe(false);
    expect(b.score.last?.quality).toBe('fall');
  });

  it('bommer du (for langt til siden), skjer ingenting', () => {
    const g = createGame();
    aboveRail(g, rail, 18, { side: 0.8 });
    run(g, (g) => g.tricks.justLanded, () => none, 2);
    expect(g.rail.on).toBe(false);
    expect(g.score.last).toBeNull();
  });
});

describe('på railen', () => {
  it('farten bremses litt: mer i boardslide enn i 50-50', () => {
    const loss = (spinDeg: number) => {
      const g = createGame();
      aboveRail(g, rail, 15, { spinDeg, speed: 20 });
      run(g, (g) => g.rail.on, () => none, 0.1);
      const v0 = g.rail.speed;
      run(g, (g) => !g.rail.on || g.rail.time >= 0.5);
      return v0 - g.rail.speed;
    };
    const l5050 = loss(0), lBoard = loss(90);
    expect(l5050).toBeGreaterThan(0.2);
    expect(l5050).toBeLessThan(2.5);
    expect(lBoard).toBeGreaterThan(l5050);
  });

  it('holder du styring til én side, faller du av etter ca. 0,7 s, og det er et vanlig fall', () => {
    const g = createGame();
    g.score.comboCount = 2;
    aboveRail(g, longBox, 15, { speed: 22 });
    run(g, (g) => g.rail.on, () => none, 0.1);
    const t0 = g.rail.time;
    run(g, (g) => !g.rail.on, () => ({ ...none, steer: 1 }));
    expect(g.rail.time - t0).toBeGreaterThan(0.6);
    expect(g.rail.time - t0).toBeLessThan(0.8);
    expect(g.rail.bail).toBe(true);
    // lener seg tydelig før fallet
    expect(Math.abs(g.skier.lean)).toBeGreaterThan(0.3);
    run(g, (g) => g.tricks.justLanded, () => none, 2);
    expect(g.score.last?.quality).toBe('fall');
    expect(g.score.last?.name).toBe('50-50');
    expect(g.score.last?.comboLost).toBe(true);
    // settes tilbake før starten på boksen, ikke midt på den
    expect(railAt(RAILS, g.fall.respawnX, g.fall.respawnZ)).toBeNull();
    expect(g.fall.respawnZ).toBeLessThan(longBox.z0);
  });

  it('korte styretrykk (0,3 s) går fint: balansen går tilbake mot midten', () => {
    const g = createGame();
    aboveRail(g, longBox, 15, { speed: 22 });
    run(g, (g) => g.rail.on, () => none, 0.1);
    run(g, (g) => !g.rail.on, (_, t) => ({ ...none, steer: t % 0.8 < 0.3 ? 1 : 0 }));
    expect(g.rail.bail).toBe(false);
    expect(g.score.last?.points).toBeGreaterThan(0);
  });

  it('pop på railen hopper av med fart opp, og du kan spinne', () => {
    const g = createGame();
    aboveRail(g, longBox, 15, { speed: 20 });
    run(g, (g) => g.rail.on, () => none, 0.1);
    run(g, (g) => !g.rail.on, (_, t) => ({ ...none, pop: t < 0.4 }));
    expect(g.skier.lastPop).toBe('pop');
    expect(g.rail.u).toBeLessThan(longBox.rail.length);
    const [, dy] = railDir(longBox, g.rail.u);
    expect(g.skier.vy - dy * speedOf(g.skier)).toBeGreaterThan(2);
    // spinn av railen (nytt trykk i lufta)
    const spin0 = g.tricks.spin;
    run(g, (g) => g.tricks.justLanded, () => ({ ...none, steer: 1 }), 2);
    expect(Math.abs(g.tricks.spin - spin0)).toBeGreaterThan(90 * DEG);
  });

  it('ut av en boardslide uten å spinne: kroppen vris tilbake, og landingen er ren', () => {
    const g = createGame();
    aboveRail(g, rail, 18, { spinDeg: 90 });
    run(g, (g) => g.rail.on, () => none, 0.1);
    run(g, (g) => !g.rail.on);
    expect(g.score.last?.name).toMatch(/^Boardslide /);
    run(g, (g) => g.tricks.justLanded, () => none, 2);
    expect(g.tricks.lastLanding?.quality).toBe('ren');
  });

  it('er deterministisk', () => {
    const go = () => {
      const g = createGame();
      placeSkier(g.skier, box.x0, box.z0 - 15, 12);
      run(g, () => false, (_, t) => ({ ...none, steer: t > 1.5 && t < 1.8 ? -1 : 0, pop: t > 2 && t < 2.3 }), 4);
      return [g.skier.x, g.skier.y, g.skier.z, g.score.total];
    };
    expect(go()).toEqual(go());
  });
});

describe('ingen rykk på og av railen', () => {
  /** Måler endring per steg gjennom en hel tur: opp på boksen, langs den, av og ned i snøen. */
  function measure(setup: (g: Game) => void, controls: (g: Game, t: number) => RawControls = () => none) {
    const g = createGame();
    setup(g);
    const rig = createCameraRig();
    let p = { ...g.skier }, yaw = g.skier.heading - g.tricks.spin, camYaw = 0, camY = 0;
    let first = true, sawRail = false, airCatch = false;
    const worst = { pos: 0, speed: 0, body: 0, cam: 0, camY: 0 };
    for (let i = 0; i < 4 * CONFIG.physicsHz; i++) {
      stepGame(g, controls(g, i * dt), dt);
      const s = g.skier;
      if (g.rail.on && !sawRail && !p.grounded) airCatch = true;
      sawRail ||= g.rail.on;
      // posisjonen: ingen hopp utover det farten sier
      worst.pos = Math.max(worst.pos, Math.hypot(s.x - p.x - p.vx * dt, s.y - p.y - p.vy * dt, s.z - p.z - p.vz * dt));
      worst.speed = Math.max(worst.speed, Math.abs(speedOf(s) - speedOf(p)));
      const by = s.heading - g.tricks.spin;
      worst.body = Math.max(worst.body, Math.abs(by - yaw) / DEG);
      yaw = by;
      if (i % 4 === 0) {
        const c = rig.update({ x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, heading: s.heading, speed: speedOf(s) }, first ? 0 : 4 * dt);
        const cy = Math.atan2(s.x - c.px, s.z - c.pz);
        if (!first) {
          worst.cam = Math.max(worst.cam, Math.abs(cy - camYaw) / DEG);
          worst.camY = Math.max(worst.camY, Math.abs(c.py - camY));
        }
        camYaw = cy; camY = c.py; first = false;
      }
      p = { ...s };
      if (g.fall.time < 99) throw new Error('falt');
    }
    expect(sawRail).toBe(true);
    return { ...worst, airCatch };
  }

  it('kjøre opp på boksen og av enden: ingen hopp i posisjon, fart, kropp eller kamera', () => {
    const w = measure((g) => placeSkier(g.skier, box.x0, box.z0 - 15, 12));
    expect(w.pos).toBeLessThan(0.01); // 1 cm per steg
    // m/s per steg. Det meste er landingen i snøen etter boksen (0,35 m fall), som en pop på flaten
    expect(w.speed).toBeLessThan(0.25);
    expect(w.body).toBeLessThan(1); // grader per steg (4° per bilde i 60 fps)
    expect(w.cam).toBeLessThan(2.5); // grader per bilde
    expect(w.camY).toBeLessThan(0.2); // m per bilde
  });

  it('poppe opp på railen fra snøen litt på skrå, gli og poppe av: ingen hopp', () => {
    const w = measure(
      (g) => { placeSkier(g.skier, rail.x0 + 0.3, rail.z0 - 6, 14); g.skier.heading = -0.03; },
      // lad på snøen, slipp så du flyr inn på railen; på railen: lad og hopp av
      (g, t) => ({ ...none, pop: (t < 0.25) || (g.rail.on && g.rail.time > 0.4 && g.rail.time < 0.8) }),
    );
    // landingen tar opp farten inn i railen (som i snøen), så farten kan endre seg litt mer akkurat da
    expect(w.airCatch).toBe(true);
    expect(w.pos).toBeLessThan(0.02);
    expect(w.speed).toBeLessThan(0.5);
    expect(w.body).toBeLessThan(1);
    expect(w.cam).toBeLessThan(2.5);
    expect(w.camY).toBeLessThan(0.2);
  });
});

describe('poeng for rails', () => {
  it('poeng per sekund, boardslide mer enn 50-50, og railen bygger komboen', () => {
    const s = createScore();
    const a = scoreRail(s, { name: '50-50', across: false, time: 1, sloppy: false });
    expect(a.points).toBe(CONFIG.railPoints5050);
    expect(s.comboCount).toBe(1);
    const b = scoreRail(s, { name: 'Boardslide', across: true, time: 1, sloppy: false });
    expect(b.points).toBe(Math.round((CONFIG.railPointsBoard * 1.25) / 10) * 10);
    expect(b.name).toBe('Boardslide 1,0 s');
  });
  it('skjev: halve poeng og ingen ekstra kombo; for kort: ingen poeng; gjentatt: mindre', () => {
    const s = createScore();
    expect(scoreRail(s, { name: '50-50', across: false, time: 1, sloppy: true }).points).toBe(CONFIG.railPoints5050 / 2);
    expect(s.comboCount).toBe(0);
    const short = scoreRail(s, { name: '50-50', across: false, time: 0.1, sloppy: false });
    expect(short.points).toBe(0);
    expect(short.tooSmall).toBe(true);
    const again = scoreRail(s, { name: '50-50', across: false, time: 1, sloppy: false });
    expect(again.repeat).toBeLessThan(1);
  });
});

describe('rails sammen med sperrene (analog spinnsperre og pop-sperre)', () => {
  it('analog styring holdt (med skjelving) over avhoppet fra railen gir ikke spinn i lufta', () => {
    const g = createGame();
    aboveRail(g, longBox, 10, { speed: 20 });
    run(g, (g) => g.rail.on, () => none, 0.1);
    const jitter = (t: number) => 0.3 + 0.03 * Math.sin(t * 90);
    // styr litt på railen mens pop lades, slipp pop: du hopper av med stikka fortsatt holdt
    run(g, (g) => !g.rail.on, (_, t) => ({ ...none, steer: jitter(t), pop: t < 0.25 }));
    expect(g.skier.lastPop).toBe('pop');
    const spin0 = g.tricks.spin;
    run(g, (g) => g.tricks.justLanded, (_, t) => ({ ...none, steer: jitter(t) }), 2);
    expect(Math.abs(g.tricks.spin - spin0)).toBeLessThan(5 * DEG);
  });

  it('pop ladet før pause gir ikke avhopp når den slippes etterpå (popLock gjelder på railen)', () => {
    const g = createGame();
    aboveRail(g, longBox, 5, { speed: 20 });
    run(g, (g) => g.rail.on, () => none, 0.1);
    run(g, () => false, () => ({ ...none, pop: true }), 0.2);
    expect(g.skier.popCharge).toBeGreaterThan(0);
    // pause og fortsett: pop sperres til den slippes
    g.popLock = true;
    run(g, () => false, () => ({ ...none, pop: true }), 0.05);
    run(g, () => false, () => none, 0.1);
    expect(g.rail.on).toBe(true);
    expect(g.skier.lastPop).not.toBe('pop');
    // et nytt trykk virker som vanlig
    run(g, (g) => !g.rail.on, (_, t) => ({ ...none, pop: t < 0.15 }), 1);
    expect(g.skier.lastPop).toBe('pop');
  });
});
