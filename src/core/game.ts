import { createSkier, reachedEnd, stepSkier, type SkierState } from '../physics/skier';
import { createTricks, stepTricks, type TrickState } from '../tricks/rotation';
import { createLatch, resetLatch, splitControls, type ControlLatch, type RawControls } from '../tricks/controls';
import { createFall, fallDone, isFalling, startFall, stepFall, stepSloppy, type FallState } from '../tricks/fall';

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
  /** Hvor (z) du lettet sist. Brukes for å vite om et fall var på landingen til et hopp. */
  takeoffZ: number;
}

/**
 * Om skiløperen ble flyttet et langt stykke på ett steg:
 * 'restart' = ny runde (R eller slutten av bakken), alt starter på nytt og skisporet tømmes.
 * 'respawn' = satt tilbake etter et fall, det gamle sporet blir liggende med et hull.
 */
export type Move = 'none' | 'restart' | 'respawn';

export function createGame(): Game {
  return { skier: createSkier(), tricks: createTricks(), fall: createFall(), latch: createLatch(), popLock: false, takeoffZ: -99 };
}

/** Står skiene i snøen og lager spor? Ikke i lufta, og ikke mens du ligger og sklir etter et fall. */
export function skisOnSnow(g: Game): boolean {
  return g.skier.grounded && !isFalling(g.fall);
}

/** Kjører ett fysikksteg. restart = R-tasten. Sier om skiløperen ble flyttet (se Move). */
export function stepGame(g: Game, raw: RawControls, restart: boolean, dt: number): Move {
  // under fallet virker ingen taster
  if (isFalling(g.fall)) {
    stepTricks(g.tricks, { spin: 0, flip: 0, grounded: true }, dt);
    if (!stepFall(g.fall, g.skier, dt)) return 'none';
    // satt tilbake: tastesperrene starter på nytt, og pop må slippes først
    g.popLock = true;
    resetLatch(g.latch);
    return 'respawn';
  }
  // R virker først når skjermen er helt klar igjen etter et fall, så blekingen ikke kuttes brått
  if ((restart && fallDone(g.fall)) || reachedEnd(g.skier)) {
    Object.assign(g, createGame());
    return 'restart';
  }
  // blekingen inn igjen etter fallet fortsetter, men nå kjører du som vanlig
  stepFall(g.fall, g.skier, dt);

  if (g.popLock && !raw.pop) g.popLock = false;
  const c = splitControls(raw, g.skier.grounded, g.latch, dt);
  if (g.popLock) c.skier.pop = false;
  const wasGrounded = g.skier.grounded;
  stepSkier(g.skier, c.skier, dt);
  if (wasGrounded && !g.skier.grounded) g.takeoffZ = g.skier.z;
  const wasInAir = g.tricks.inAir;
  stepTricks(g.tricks, { spin: c.spin, flip: c.flip, grounded: g.skier.grounded }, dt);

  if (wasInAir && !g.tricks.inAir) {
    const q = g.tricks.lastLanding?.quality;
    if (q === 'fall') startFall(g.fall, g.skier, g.tricks, g.takeoffZ);
    else if (q === 'slurvete') g.fall.sloppyAge = 0;
  }
  stepSloppy(g.fall, g.skier, dt);
  return 'none';
}
