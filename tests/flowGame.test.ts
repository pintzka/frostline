import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame, createStats, scoreLines, stepGame, type Game, type GameInput } from '../src/ui/flow';
import { createScore } from '../src/tricks/score';
import { PARK } from '../src/park/terrain';
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
