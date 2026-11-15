import { createSkier, reachedEnd, stepSkier, type SkierState } from '../physics/skier';
import { createTricks, stepTricks, type TrickState } from '../tricks/rotation';
import { createLatch, resetLatch, splitControls, type ControlLatch, type RawControls } from '../tricks/controls';
import { createFall, isFalling, startFall, stepFall, stepSloppy, type FallState } from '../tricks/fall';

/**
 * Ett steg av spillet: taster → fysikk → triks → landing (ren, slurvete eller fall).
 * Ren logikk uten three.js, så hele runden kan testes. main.ts tegner bare det som skjer her.
 */
export interface Game {
  skier: SkierState;
  tricks: TrickState;
  fall: FallState;
  latch: ControlLatch;
  /** Pop-knappen holdt fra før du ble satt tilbake teller ikke før du slipper den. */
  popLock: boolean;
}

export function createGame(): Game {
  return { skier: createSkier(), tricks: createTricks(), fall: createFall(), latch: createLatch(), popLock: false };
}

/** Står skiene i snøen og lager spor? Ikke i lufta, og ikke mens du ligger og sklir etter et fall. */
export function skisOnSnow(g: Game): boolean {
  return g.skier.grounded && !isFalling(g.fall);
}

/**
 * Kjører ett fysikksteg. restart = R-tasten.
 * Gir true når skiløperen ble flyttet et langt stykke på ett steg (restart eller satt tilbake etter fall),
 * så kamera og spor skal hoppe rett dit i stedet for å gli.
 */
export function stepGame(g: Game, raw: RawControls, restart: boolean, dt: number): boolean {
  // under fallet virker ingen taster, heller ikke R
  if (isFalling(g.fall)) {
    stepTricks(g.tricks, { spin: 0, flip: 0, grounded: true }, dt);
    const moved = stepFall(g.fall, g.skier, dt);
    if (moved) { g.popLock = true; resetLatch(g.latch); }
    return moved;
  }
  if (restart || reachedEnd(g.skier)) {
    Object.assign(g, createGame());
    return true;
  }
  // blekingen inn igjen etter fallet fortsetter, men nå kjører du som vanlig
  stepFall(g.fall, g.skier, dt);

  if (g.popLock && !raw.pop) g.popLock = false;
  const c = splitControls(raw, g.skier.grounded, g.latch, dt);
  if (g.popLock) c.skier.pop = false;
  stepSkier(g.skier, c.skier, dt);
  const wasInAir = g.tricks.inAir;
  stepTricks(g.tricks, { spin: c.spin, flip: c.flip, grounded: g.skier.grounded }, dt);

  if (wasInAir && !g.tricks.inAir) {
    const q = g.tricks.lastLanding?.quality;
    if (q === 'fall') startFall(g.fall, g.skier, g.tricks);
    else if (q === 'slurvete') g.fall.sloppyAge = 0;
  }
  stepSloppy(g.fall, g.skier, dt);
  return false;
}
