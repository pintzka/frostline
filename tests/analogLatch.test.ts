import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame, stepGame } from '../src/core/game';
import { PARK } from '../src/park/terrain';
import { createLatch, splitControls } from '../src/tricks/controls';

/**
 * Analog styring (gamepad-stikke, tommel på mobil) skjelver litt hele tiden. En stikke som holdes
 * over kanten skal fortsatt ikke gi spinn: sperren slippes først når stikka flyttes tydelig eller bytter retning.
 */
const dt = 1 / CONFIG.physicsHz;

/** Fast frø, så testen er lik hver gang. */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

describe('sperren ved avsats tåler skjelving i analog styring', () => {
  it('holdt stikke med ±0,002 støy gir ikke spinn i lufta', () => {
    const latch = createLatch();
    const r = rng(1);
    splitControls({ steer: 0.6, brake: 0, flip: 0 }, true, latch, dt);
    let spun = 0;
    for (let i = 0; i < 600; i++) {
      const c = splitControls({ steer: 0.6 + (r() - 0.5) * 0.004, brake: 0, flip: 0 }, false, latch, dt);
      spun += Math.abs(c.spin);
    }
    expect(spun).toBe(0);
  });

  it('flytter du stikka tydelig, eller bytter retning, spinner du', () => {
    const a = createLatch();
    splitControls({ steer: 0.6, brake: 0, flip: 0 }, true, a, dt);
    splitControls({ steer: 0.6, brake: 0, flip: 0 }, false, a, dt);
    expect(splitControls({ steer: 1, brake: 0, flip: 0 }, false, a, dt).spin).toBe(1);
    const b = createLatch();
    splitControls({ steer: 0.3, brake: 0, flip: 0 }, true, b, dt);
    splitControls({ steer: 0.3, brake: 0, flip: 0 }, false, b, dt);
    expect(splitControls({ steer: -0.2, brake: 0, flip: 0 }, false, b, dt).spin).toBe(-0.2);
  });

  it('holdt stikke med støy rett etter landing styrer ikke før sperren slippes', () => {
    const latch = createLatch();
    splitControls({ steer: 0, brake: 0, flip: 0 }, true, latch, dt);
    // spinner med 0,8 i lufta og lander mens stikka fortsatt holdes
    splitControls({ steer: 0.8, brake: 0, flip: 0 }, false, latch, dt);
    const c = splitControls({ steer: 0.8005, brake: 0, flip: 0 }, true, latch, dt);
    expect(c.skier.steer).toBe(0);
  });

  for (const held of [0.35, -0.6, 0.9]) {
    it(`hele bakken med støyende stikke (holdt ${held} over hver kant): ingen triks og ingen fall`, () => {
      const g = createGame();
      const r = rng(7);
      let t = 0, v = 0, landings = 0;
      const bad: string[] = [];
      while (g.skier.z < PARK.length - CONFIG.runEndMargin - 2 && t < 90) {
        // på bakken: holder seg midt i løypa, og holder `held` de siste metrene før kanten;
        // i lufta: holder stikka i ro (bare skjelving)
        if (g.skier.grounded) {
          const atLip = PARK.kickers.some((k) => g.skier.z > k.z - 3 && g.skier.z < k.z + 1);
          v = atLip ? held : Math.max(-1, Math.min(1, 2 * g.skier.heading + 0.1 * g.skier.x));
        }
        const noise = (r() - 0.5) * 0.002;
        const wasAir = !g.skier.grounded;
        stepGame(g, { steer: Math.max(-1, Math.min(1, v + noise)), brake: 0, flip: 0, pop: false }, false, dt);
        if (wasAir && g.skier.grounded && g.tricks.lastLanding) {
          landings++;
          const l = g.tricks.lastLanding;
          if (l.quality !== 'ren' || Math.abs(l.spinDeg) > 30) bad.push(`${l.name} ${l.quality} ${l.spinDeg.toFixed(0)}°`);
        }
        t += dt;
      }
      expect(landings).toBeGreaterThanOrEqual(3);
      expect(bad).toEqual([]);
    });
  }
});
