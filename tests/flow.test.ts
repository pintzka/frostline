import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { bestOf, createGame, createStats, fade, recordStats, resultLines, stepGame, trickValue, type Game, type GameInput } from '../src/ui/flow';
import { judgeLanding } from '../src/tricks/rotation';
import { PARK } from '../src/park/terrain';
import type { Landing } from '../src/tricks/rotation';

const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;

/** Input uten noen taster. Overstyr det du trenger. */
function keys(over: Partial<GameInput['raw']> & { click?: boolean; restart?: boolean } = {}): GameInput {
  const { click = false, restart = false, ...raw } = over;
  return { raw: { steer: 0, brake: 0, flip: 0, pop: false, ...raw }, click, restart };
}

/** Kjører spillet et antall sekunder med samme input, og samler hendelsene. */
function run(g: Game, seconds: number, inp: GameInput | ((t: number) => GameInput)) {
  const events: string[] = [];
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const ev = stepGame(g, typeof inp === 'function' ? inp(i * dt) : inp, dt);
    if (ev) events.push(ev);
  }
  return events;
}

/** Kjører fra startskjermen helt til resultatskjermen (rett ned, ingen triks). */
function rideToEnd(g: Game) {
  stepGame(g, keys({ click: true }), dt);
  let t = 0;
  while (g.flow.phase === 'kjorer' && t < 120) { stepGame(g, keys(), dt); t += dt; }
}

describe('tilstander: start → kjører → resultat → kjører', () => {
  it('starter på startskjermen, og skiløperen står stille', () => {
    const g = createGame();
    expect(g.flow.phase).toBe('start');
    const z = g.skier.z;
    run(g, 2, keys({ steer: 1 }));
    expect(g.flow.phase).toBe('start');
    expect(g.skier.z).toBe(z);
  });

  it('mellomrom starter runden', () => {
    const g = createGame();
    const ev = run(g, 0.1, keys({ pop: true }));
    expect(ev).toEqual(['ny-runde']);
    expect(g.flow.phase).toBe('kjorer');
  });

  it('klikk starter runden', () => {
    const g = createGame();
    expect(stepGame(g, keys({ click: true }), dt)).toBe('ny-runde');
    expect(g.flow.phase).toBe('kjorer');
  });

  it('R gjør ingenting på startskjermen', () => {
    const g = createGame();
    run(g, 0.2, keys({ restart: true }));
    expect(g.flow.phase).toBe('start');
  });

  it('slutten av bakken gir resultatskjermen, ikke ny runde med en gang', () => {
    const g = createGame();
    rideToEnd(g);
    expect(g.flow.phase).toBe('resultat');
    expect(g.skier.z).toBeGreaterThan(PARK.length - CONFIG.runEndMargin - 1);
  });

  it('mellomrom på resultatskjermen gir ny runde fra toppen', () => {
    const g = createGame();
    rideToEnd(g);
    run(g, CONFIG.resultMinTime + 0.05, keys());
    const ev = run(g, 0.05, keys({ pop: true }));
    expect(ev).toEqual(['ny-runde']);
    expect(g.flow.phase).toBe('kjorer');
    expect(g.skier.z).toBeLessThan(10);
  });

  it('et trykk rett etter målet hopper ikke over resultatet ved et uhell', () => {
    const g = createGame();
    rideToEnd(g);
    const ev = run(g, CONFIG.resultMinTime * 0.5, (t) => keys({ pop: t > 0.05 && t < 0.1 }));
    expect(ev).toEqual([]);
    expect(g.flow.phase).toBe('resultat');
  });

  it('holder du mellomrom inn i målet, må du slippe og trykke på nytt', () => {
    const g = createGame();
    rideToEnd(g);
    // fortsatt holdt fra før målet: ingen ny runde
    expect(run(g, CONFIG.resultMinTime + 0.5, keys({ pop: true }))).toEqual([]);
    run(g, 0.05, keys());
    expect(run(g, 0.05, keys({ pop: true }))).toEqual(['ny-runde']);
  });

  it('R starter på nytt med en gang mens du kjører, uten resultatskjerm', () => {
    const g = createGame();
    stepGame(g, keys({ click: true }), dt);
    run(g, 3, keys());
    expect(g.skier.z).toBeGreaterThan(20);
    const ev = run(g, 0.05, keys({ restart: true }));
    expect(ev).toEqual(['ny-runde']);
    expect(g.flow.phase).toBe('kjorer');
    expect(g.skier.z).toBeLessThan(10);
  });

  it('R på resultatskjermen starter også med en gang', () => {
    const g = createGame();
    rideToEnd(g);
    expect(run(g, 0.05, keys({ restart: true }))).toEqual(['ny-runde']);
    expect(g.flow.phase).toBe('kjorer');
  });

  it('holder du R inne, starter runden bare én gang (skiløperen kjører videre)', () => {
    const g = createGame();
    stepGame(g, keys({ click: true }), dt);
    run(g, 1, keys());
    const ev = run(g, 2, keys({ restart: true }));
    expect(ev).toEqual(['ny-runde']);
    expect(g.skier.z).toBeGreaterThan(10);
  });

  it('skiløperen bremser mykt inn etter målet og stopper før bakken tar slutt', () => {
    const g = createGame();
    rideToEnd(g);
    const z0 = g.skier.z;
    let biggestJump = 0, last = Math.hypot(g.skier.vx, g.skier.vy, g.skier.vz);
    for (let i = 0; i < 5 * CONFIG.physicsHz; i++) {
      stepGame(g, keys({ steer: 1 }), dt);
      const v = Math.hypot(g.skier.vx, g.skier.vy, g.skier.vz);
      biggestJump = Math.max(biggestJump, last - v);
      last = v;
    }
    expect(last).toBeLessThan(0.5);
    // bakken (det du ser) slutter 20 m etter at runden er ferdig
    expect(g.skier.z - z0).toBeLessThan(18);
    // ingen brå stopp: aldri mer enn ca. 4 g brems i ett steg
    expect(biggestJump / dt).toBeLessThan(4 * CONFIG.gravity);
    // styringen er av etter målet
    expect(Math.abs(g.skier.x)).toBeLessThan(1);
  });
});

describe('mellomrom som starter runden gir ikke pop', () => {
  it('ingen pop når du slipper mellomrom etter å ha startet med det', () => {
    const g = createGame();
    run(g, 0.4, keys({ pop: true }));
    run(g, 0.5, keys());
    expect(g.skier.lastPop).toBe('');
    expect(g.skier.popCharge).toBe(0);
  });

  it('neste trykk etterpå er en vanlig pop', () => {
    const g = createGame();
    run(g, 0.2, keys({ pop: true }));
    run(g, 0.3, keys());
    run(g, 0.3, keys({ pop: true }));
    run(g, 0.1, keys());
    expect(g.skier.lastPop).not.toBe('');
  });

  it('heller ikke når du starter en ny runde fra resultatskjermen med mellomrom', () => {
    const g = createGame();
    rideToEnd(g);
    run(g, CONFIG.resultMinTime + 0.05, keys());
    run(g, 0.4, keys({ pop: true }));
    run(g, 0.3, keys());
    expect(g.flow.phase).toBe('kjorer');
    expect(g.skier.lastPop).toBe('');
  });
});

describe('rundestatistikk', () => {
  it('teller tid, toppfart og lengste lufttid i en hel runde', () => {
    const g = createGame();
    rideToEnd(g);
    const s = g.flow.stats;
    // hele bakken rett ned tar en stund, men ikke et minutt
    expect(s.time).toBeGreaterThan(15);
    expect(s.time).toBeLessThan(60);
    // over toppfarten etter de store hoppene, men ikke helt vilt
    expect(s.topSpeed).toBeGreaterThan(CONFIG.maxSpeed - 1);
    expect(s.topSpeed).toBeLessThan(40);
    // det store hoppet gir ca. 2,5 s
    expect(s.longestAir).toBeGreaterThan(2);
    expect(s.longestAir).toBeLessThan(3.5);
    // ingen triks
    expect(s.bestTrick).toBeNull();
  });

  it('tiden står stille på resultatskjermen', () => {
    const g = createGame();
    rideToEnd(g);
    const t = g.flow.stats.time;
    run(g, 2, keys());
    expect(g.flow.stats.time).toBe(t);
  });

  it('nullstilles ved ny runde (med mellomrom og med R)', () => {
    const g = createGame();
    rideToEnd(g);
    run(g, CONFIG.resultMinTime + 0.05, keys());
    run(g, 0.05, keys({ pop: true }));
    expect(g.flow.stats.time).toBeLessThan(0.1);
    expect(g.flow.stats.longestAir).toBe(0);
    expect(g.flow.stats.bestTrick).toBeNull();
    run(g, 3, keys());
    run(g, 0.05, keys({ restart: true }));
    expect(g.flow.stats.time).toBeLessThan(0.1);
    expect(g.flow.stats.topSpeed).toBeLessThan(5);
  });

  it('beste triks er det største landede trikset, og fall teller ikke', () => {
    const st = createStats();
    const land = (spin: number, flip: number) => judgeLanding(spin * DEG, flip * DEG);
    const sample = (l: Landing | null) => recordStats(st, { dt, speed: 10, inAir: false, airTime: 0, landing: l });
    sample(land(360, 0));
    expect(st.bestTrick?.name).toBe('360');
    sample(land(180, 0));
    expect(st.bestTrick?.name).toBe('360');
    sample(land(720, -360));
    expect(st.bestTrick?.name).toBe('720 + Backflip');
    // et større triks som endte i fall, teller ikke
    const fall = land(1080 + 90, 0);
    expect(fall.quality).toBe('fall');
    sample(fall);
    expect(st.bestTrick?.name).toBe('720 + Backflip');
  });

  it('samme landing telles bare én gang, og et vanlig hopp er ikke et triks', () => {
    const st = createStats();
    const l = judgeLanding(0, 0);
    recordStats(st, { dt, speed: 10, inAir: false, airTime: 0, landing: l });
    expect(st.bestTrick).toBeNull();
    expect(trickValue(l)).toBe(0);
  });

  it('ved likt triks vinner ren landing over slurvete', () => {
    const ren = judgeLanding(360 * DEG, 0);
    const slurvete = judgeLanding((360 + 40) * DEG, 0);
    expect(slurvete.quality).toBe('slurvete');
    expect(bestOf(slurvete, ren)).toBe(ren);
    expect(bestOf(ren, slurvete)).toBe(ren);
  });

  it('lengste lufttid og toppfart er de største verdiene i runden', () => {
    const st = createStats();
    const steps = [
      { speed: 10, inAir: true, airTime: 0.8 },
      { speed: 22, inAir: false, airTime: 0.8 },
      { speed: 15, inAir: true, airTime: 1.4 },
      { speed: 12, inAir: true, airTime: 0.2 },
    ];
    for (const s of steps) recordStats(st, { dt: 0.5, landing: null, ...s });
    expect(st.topSpeed).toBe(22);
    expect(st.longestAir).toBe(1.4);
    expect(st.time).toBe(2);
  });
});

describe('resultatskjermen og overganger', () => {
  it('viser tid, toppfart, lufttid og beste triks på norsk', () => {
    const st = createStats();
    st.time = 27.08; st.topSpeed = 31; st.longestAir = 2.53;
    st.bestTrick = judgeLanding((540 + 40) * DEG, 0);
    expect(resultLines(st)).toEqual([
      ['Tid', '27,1 s'],
      ['Toppfart', '112 km/t'],
      ['Lengste lufttid', '2,5 s'],
      ['Beste triks', '540 (slurvete)'],
    ]);
    st.time = 65.3; st.bestTrick = null;
    expect(resultLines(st)[0][1]).toBe('1:05,3');
    expect(resultLines(st)[3][1]).toBe('Ingen ennå');
  });

  it('fade går jevnt mot målet og stopper der', () => {
    expect(fade(0, 1, 0.1, 0.4)).toBeCloseTo(0.25);
    expect(fade(0.9, 1, 0.1, 0.4)).toBe(1);
    expect(fade(1, 0, 0.1, 0.2)).toBeCloseTo(0.5);
    expect(fade(0.5, 0.5, 0.1, 0.2)).toBe(0.5);
  });
});
