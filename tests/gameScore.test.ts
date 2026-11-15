import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame, restartGame, stepGame, type Game } from '../src/core/game';
import { spinCoast } from '../src/tricks/rotation';
import { PARK } from '../src/park/terrain';
import type { RawControls } from '../src/tricks/controls';
import { resultText } from '../src/ui/hud';

/** Poeng og kombo kjøres gjennom spillsteget (core/game.ts), sammen med fall, respawn og ny runde. */
const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const medium = PARK.kickers[1];
const none: RawControls = { steer: 0, brake: 0, flip: 0, pop: false };

/** Spinner over det medium hoppet til målet (grader), og holder eventuelt en grab. */
function spinTo(g: Game, goalDeg: number, grab: 0 | 1 = 0): RawControls {
  const s = g.skier, t = g.tricks;
  const near = s.z > medium.z - 5 && s.z < medium.z + 80;
  if (s.grounded || !near) return none;
  const left = goalDeg * DEG - (t.spin + spinCoast(t.spinRate));
  // grabben slippes når du er på vei ned og nær snøen, så landingen ikke blir slurvete
  const holdGrab = grab && s.airTime < 0.9;
  return { ...none, steer: Math.abs(left) > 0.02 ? Math.sign(left) : 0, grab: holdGrab ? 1 : 0 };
}

/** Kjører fra start over det medium hoppet og videre i `after` sekunder etter landingen. */
function ride(g: Game, goalDeg: number, after: number, grab: 0 | 1 = 0, onTakeoff: () => void = () => {}) {
  let landedAt = -1, time = 0, tookOff = false, respawned = false;
  for (let i = 0; i < 60 * CONFIG.physicsHz; i++) {
    const wasAir = !g.skier.grounded;
    const move = stepGame(g, landedAt < 0 ? spinTo(g, goalDeg, grab) : none, dt);
    if (move === 'respawn') respawned = true;
    time += dt;
    if (!tookOff && !g.skier.grounded && g.skier.z > medium.z - 5) { tookOff = true; onTakeoff(); }
    if (tookOff && landedAt < 0 && wasAir && g.skier.grounded) landedAt = time;
    if (landedAt >= 0 && time - landedAt >= after) break;
  }
  return { landedAt, respawned };
}

describe('poeng i spillsteget', () => {
  it('et ekte triks gir poeng når du lander', () => {
    const g = createGame();
    ride(g, 540, 0.5);
    expect(g.tricks.lastLanding?.quality).toBe('ren');
    expect(g.score.total).toBeGreaterThan(0);
    expect(g.score.last?.points).toBe(g.score.total);
  });

  it('fall gir 0 poeng, komboen er tapt, og poengene og beste runde overlever respawn', () => {
    const g = createGame();
    g.score.total = 1000;
    g.best = 500;
    // en kombo på x1,5 rett før hoppet (komboen ville ellers gått ut på veien ned)
    const { respawned } = ride(g, 90, 2.5, 0, () => { g.score.comboCount = 2; g.score.comboIdle = 0; });
    expect(respawned).toBe(true);
    expect(g.score.last?.quality).toBe('fall');
    expect(g.score.last?.points).toBe(0);
    expect(g.score.last?.comboLost).toBe(true);
    expect(g.score.comboCount).toBe(0);
    expect(g.score.total).toBe(1000);
    expect(g.best).toBe(500);
    expect(resultText(g.score.last!).sub.toLowerCase()).toContain('kombo tapt');
  });

  it('R starter poengene på nytt og husker beste runde', () => {
    const g = createGame();
    g.score.total = 1200;
    g.best = 800;
    restartGame(g);
    expect(g.score.total).toBe(0);
    expect(g.score.last).toBeNull();
    expect(g.best).toBe(1200);
    // en dårligere runde senker ikke beste runde
    g.score.total = 300;
    restartGame(g);
    expect(g.best).toBe(1200);
  });
});
