import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame, createStats, resumeGame, scoreLines, soundSkier, stepGame, type Game, type GameInput } from '../src/ui/flow';
import { createScore } from '../src/tricks/score';
import { heightAt, PARK } from '../src/park/terrain';
import { isFalling } from '../src/tricks/fall';
import { reachedEnd, speedOf } from '../src/physics/skier';
import { spinCoast } from '../src/tricks/rotation';

/** Flyten (start, resultat) sammen med kjøringen fra core/game.ts: fall, respawn, poeng og beste runde. */
const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const medium = PARK.kickers[1];
const idle = (over: Partial<GameInput> = {}): GameInput => ({ raw: { steer: 0, brake: 0, flip: 0, pop: false }, click: false, restart: false, ...over });

function rideToEnd(g: Game) {
  let t = 0;
  while (g.flow.phase === 'kjorer' && t < 120) { stepGame(g, idle(), dt); t += dt; }
}

describe('flyt og kjøring sammen', () => {
  it('ny runde sier fra med move = restart, ellers none', () => {
    const g = createGame();
    stepGame(g, idle({ click: true }), dt);
    expect(g.flow.move).toBe('restart');
    stepGame(g, idle(), dt);
    expect(g.flow.move).toBe('none');
  });

  it('et fall gir respawn (ikke resultat), 0 poeng, og R under fallet gir ikke ny runde', () => {
    const g = createGame();
    stepGame(g, idle({ click: true }), dt);
    let landed = false, respawned = false, restarts = 0, tookOff = false;
    for (let i = 0; i < 40 * CONFIG.physicsHz && !respawned; i++) {
      const s = g.skier, t = g.tricks;
      const near = s.z > medium.z - 5 && s.z < medium.z + 80;
      if (!s.grounded && near) tookOff = true;
      // spinn 90° over det medium hoppet = sidelengs landing = fall
      const left = 90 * DEG - (t.spin + spinCoast(t.spinRate));
      const steer = !s.grounded && near && !landed && Math.abs(left) > 0.02 ? Math.sign(left) : 0;
      const wasAir = !s.grounded;
      // R trykkes hele tiden etter landingen
      const ev = stepGame(g, idle({ raw: { steer, brake: 0, flip: 0, pop: false }, restart: landed && i % 2 === 0 }), dt);
      if (ev === 'ny-runde') restarts++;
      if (tookOff && wasAir && g.skier.grounded) landed = true;
      if (g.flow.move === 'respawn') respawned = true;
    }
    expect(respawned).toBe(true);
    expect(restarts).toBe(0);
    expect(g.flow.phase).toBe('kjorer');
    expect(g.score.last?.quality).toBe('fall');
    expect(g.score.total).toBe(0);
  });

  it('poengene nullstilles ved ny runde fra resultatskjermen, og beste runde huskes', () => {
    const g = createGame();
    stepGame(g, idle({ click: true }), dt);
    rideToEnd(g);
    expect(g.flow.phase).toBe('resultat');
    g.score.total = 2500;
    for (let i = 0; i < (CONFIG.resultMinTime + 0.1) / dt; i++) stepGame(g, idle(), dt);
    stepGame(g, idle({ click: true }), dt);
    expect(g.flow.phase).toBe('kjorer');
    expect(g.score.total).toBe(0);
    expect(g.best).toBe(2500);
    expect(g.flow.bestBefore).toBe(2500);
  });
});

describe('mållinja', () => {
  /** Skiløperen i lufta rett før mållinja, snurret 90° (lander sidelengs = fall). */
  function airborneAtFinish(): Game {
    const g = createGame();
    stepGame(g, idle({ click: true }), dt);
    const z = PARK.length - CONFIG.runEndMargin - 1;
    Object.assign(g.skier, { z, x: 0, y: heightAt(0, z) + 2.5, vx: 0, vy: 2, vz: 14, grounded: false, airTime: 1 });
    g.tricks.inAir = true;
    g.tricks.spin = Math.PI / 2;
    return g;
  }

  it('krysser du mållinja i lufta, kommer resultatet først når du står på snøen, og et fall teller', () => {
    const g = airborneAtFinish();
    const events: string[] = [];
    let crossedInAir = false;
    for (let i = 0; i < 20 * CONFIG.physicsHz && g.flow.phase === 'kjorer'; i++) {
      const ev = stepGame(g, idle(), dt);
      if (reachedEnd(g.skier) && !g.skier.grounded) crossedInAir = true;
      if (g.flow.move === 'respawn') events.push('respawn');
      if (ev) events.push(ev);
      if (ev === 'mål') {
        expect(g.skier.grounded).toBe(true);
        expect(isFalling(g.fall)).toBe(false);
      }
    }
    expect(crossedInAir).toBe(true);
    // landingen ble et fall: du ble satt tilbake og kom i mål på nytt, ingen respawn bak resultatskjermen
    expect(events[0]).toBe('respawn');
    expect(events[events.length - 1]).toBe('mål');
    for (let i = 0; i < 3 * CONFIG.physicsHz; i++) stepGame(g, idle(), dt);
    expect(g.flow.phase).toBe('resultat');
    expect(g.score.last?.quality).toBe('fall');
  });

  it('bremsen etter målet tar bare på snøen, ikke i lufta', () => {
    const g = airborneAtFinish();
    g.flow.phase = 'resultat';
    const v0 = speedOf(g.skier);
    stepGame(g, idle(), dt);
    // bare tyngden og luftmotstand: langt under finishStopDecel
    expect(Math.abs(speedOf(g.skier) - v0) / dt).toBeLessThan(CONFIG.finishStopDecel / 2);
  });

  it('tapping på mellomrom inn i mål hopper ikke over resultatet; slipp og trykk etter pausen gjør', () => {
    const g = createGame();
    stepGame(g, idle({ click: true }), dt);
    rideToEnd(g);
    let ev: string | null = null;
    // tapper pop hver 0,1 s like til pausen er over
    for (let t = 0; t < CONFIG.resultMinTime - dt; t += dt) {
      ev = stepGame(g, idle({ raw: { steer: 0, brake: 0, flip: 0, pop: Math.floor(t / 0.05) % 2 === 1 } }), dt) ?? ev;
    }
    expect(ev).toBeNull();
    expect(CONFIG.resultMinTime).toBeGreaterThanOrEqual(0.9);
    // holdt inn over pausen: fortsatt ingen ny runde
    for (let i = 0; i < 0.2 / dt; i++) ev = stepGame(g, idle({ raw: { steer: 0, brake: 0, flip: 0, pop: true } }), dt) ?? ev;
    expect(ev).toBeNull();
    stepGame(g, idle(), dt);
    expect(stepGame(g, idle({ raw: { steer: 0, brake: 0, flip: 0, pop: true } }), dt)).toBe('ny-runde');
  });

  it('R på resultatskjermen venter til blekingen etter et fall er ferdig', () => {
    const g = createGame();
    stepGame(g, idle({ click: true }), dt);
    rideToEnd(g);
    // blekingen inn igjen etter et fall pågår fortsatt
    g.fall.time = CONFIG.fallRespawnAt + 0.05;
    expect(stepGame(g, idle({ restart: true }), dt)).toBeNull();
    stepGame(g, idle(), dt);
    for (let i = 0; i < CONFIG.fallFadeTime / dt; i++) stepGame(g, idle(), dt);
    expect(stepGame(g, idle({ restart: true }), dt)).toBe('ny-runde');
  });
});

describe('poeng på resultatskjermen', () => {
  it('viser poeng, beste runde, ny rekord og trikset med flest poeng', () => {
    const score = createScore();
    const st = createStats();
    expect(scoreLines(score, 0, st)).toEqual([['Poeng', '0'], ['Flest poeng', 'Ingen ennå']]);
    score.total = 4200;
    st.bestScored = { name: '720 + Backflip', quality: 'ren', points: 1500, combo: 1, repeat: 1, perfectPop: false, tooSmall: false, smallJump: false, comboLost: false, landedGrabbing: false };
    expect(scoreLines(score, 3000, st)).toEqual([
      ['Poeng', '4 200 · ny rekord!'],
      ['Beste runde', '4 200'],
      ['Flest poeng', '720 + Backflip · 1 500'],
    ]);
    expect(scoreLines(score, 5000, st)[0]).toEqual(['Poeng', '4 200']);
  });
});

describe('fortsett etter pause', () => {
  const pop = (on: boolean) => idle({ raw: { steer: 0, brake: 0, flip: 0, pop: on } });

  it('pop som ble ladet før pausen, gir ikke pop når du fortsetter', () => {
    const g = createGame();
    stepGame(g, idle({ click: true }), dt);
    for (let i = 0; i < 0.5 / dt; i++) stepGame(g, idle(), dt);
    // lader pop, så kommer pausen (tastene slippes)
    for (let i = 0; i < 0.3 / dt; i++) stepGame(g, pop(true), dt);
    expect(g.skier.popCharge).toBeGreaterThan(0);
    resumeGame(g);
    for (let i = 0; i < 0.5 / dt; i++) stepGame(g, pop(false), dt);
    expect(g.skier.lastPop).toBe('');
    // neste ekte trykk er en vanlig pop
    for (let i = 0; i < 0.3 / dt; i++) stepGame(g, pop(true), dt);
    stepGame(g, pop(false), dt);
    expect(g.skier.lastPop).not.toBe('');
  });

  it('mellomrom holdt over pausen på startskjermen starter ikke runden', () => {
    const g = createGame();
    resumeGame(g);
    for (let i = 0; i < 0.3 / dt; i++) expect(stepGame(g, pop(true), dt)).toBeNull();
    stepGame(g, pop(false), dt);
    expect(stepGame(g, pop(true), dt)).toBe('ny-runde');
  });
});

describe('lyd på startskjermen', () => {
  it('skiløperen er stille for lyden til runden starter', () => {
    const g = createGame();
    // createSkier gir 2 m/s, men på startskjermen skal det ikke suse
    expect(speedOf(g.skier)).toBeGreaterThan(0);
    expect(speedOf(soundSkier(g))).toBe(0);
    stepGame(g, idle({ click: true }), dt);
    expect(soundSkier(g)).toBe(g.skier);
  });
});
