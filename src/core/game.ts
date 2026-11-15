import { createSkier, stepSkier, type SkierInput, type SkierState } from '../physics/skier';
import { createTricks, landOnRail, shiftSpin, stepTricks, type TrickState } from '../tricks/rotation';
import { bailOff, createRailRide, findRailHit, railAt, railHeadingShift, RAILS, railStyleName, startGrind, stepGrind, type RailRide } from '../physics/rail';
import { createLatch, resetLatch, splitControls, type ControlLatch, type RawControls } from '../tricks/controls';
import { createFall, fallDone, isFalling, startFall, stepFall, stepSloppy, type FallState } from '../tricks/fall';
import { createScore, scoreLanding, scoreRail, stepScore, type ScoreState } from '../tricks/score';
import { CONFIG } from './config';

/**
 * Ett steg av spillet: taster → fysikk → triks → landing (ren, slurvete eller fall) → poeng.
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
  /** Poeng og kombo i denne runden. Overlever respawn etter fall, nullstilles ved ny runde. */
  score: ScoreState;
  /** Beste poengsum i en tidligere runde (0 = ingen ennå). Overlever både fall og ny runde. */
  best: number;
  /** Rail eller boks du glir på (physics/rail.ts). */
  rail: RailRide;
}

/**
 * Om skiløperen ble flyttet et langt stykke på ett steg:
 * 'restart' = ny runde (R, eller ny runde fra start- eller resultatskjermen), alt starter på nytt og skisporet tømmes.
 * 'respawn' = satt tilbake etter et fall, det gamle sporet blir liggende med et hull.
 */
export type Move = 'none' | 'restart' | 'respawn';

export function createGame(): Game {
  return {
    skier: createSkier(), tricks: createTricks(), fall: createFall(), latch: createLatch(), popLock: false, takeoffZ: -99,
    score: createScore(), best: 0, rail: createRailRide(),
  };
}

/** Ny runde: alt starter på nytt, men beste runde huskes (også poengene fra runden som nettopp sluttet). */
export function restartGame(g: Game): void {
  const best = Math.max(g.best, g.score.total);
  Object.assign(g, createGame(), { best });
}

/** Står skiene i snøen og lager spor? Ikke i lufta, ikke på en rail, og ikke mens du ligger og sklir etter et fall. */
export function skisOnSnow(g: Game): boolean {
  return g.skier.grounded && !g.rail.on && !isFalling(g.fall);
}

/** Skiløperen slik snøsprut og lyd ser den: på en rail er ikke skiene i snøen (ingen snølyd eller snøsprut). */
export function snowSkier(g: Game): SkierState {
  return g.rail.on ? { ...g.skier, grounded: false } : g.skier;
}

/**
 * Kan en ny runde starte nå (R)? Ikke før fallet er helt ferdig, også blekingen inn igjen, så den ikke kuttes brått.
 * Selve den nye runden (restartGame) og når R virker, styres av ui/flow.ts.
 */
export function canRestart(g: Game): boolean {
  return fallDone(g.fall);
}

/** Kjører ett fysikksteg: taster, fysikk, triks, fall og poeng. Sier om skiløperen ble satt tilbake etter et fall. */
export function stepGame(g: Game, raw: RawControls, dt: number): Move {
  // under fallet virker ingen taster
  if (isFalling(g.fall)) {
    stepTricks(g.tricks, { spin: 0, flip: 0, grounded: true }, dt);
    stepScore(g.score, true, dt);
    if (!stepFall(g.fall, g.skier, dt)) return 'none';
    // satt tilbake: tastesperrene starter på nytt, og pop må slippes først
    g.popLock = true;
    g.rail = createRailRide();
    resetLatch(g.latch);
    return 'respawn';
  }
  // blekingen inn igjen etter fallet fortsetter, men nå kjører du som vanlig
  stepFall(g.fall, g.skier, dt);

  // sperret pop: ladingen kastes først, så det ikke blir en pop når tasten slippes (f.eks. etter pause)
  if (g.popLock) { g.skier.popHeld = false; g.skier.popCharge = 0; }
  if (g.popLock && !raw.pop) g.popLock = false;
  const c = splitControls(raw, g.skier.grounded, g.latch, dt);
  if (g.popLock) c.skier.pop = false;
  // faller du av en rail, er det ingen triks på vei ned i snøen
  if (g.rail.bail) { c.spin = 0; c.flip = 0; c.grab = 0; }
  const wasGrounded = g.skier.grounded;
  stepRailOrSnow(g, c.skier, dt);
  if (wasGrounded && !g.skier.grounded) g.takeoffZ = g.skier.z;
  const wasInAir = g.tricks.inAir;
  // et hopp som starter rett etter en perfekt pop, regnes som perfekt pop (gir mer poeng)
  const perfectPop = g.skier.lastPop === 'perfekt' && g.skier.popAge < CONFIG.popTakeoffWindow;
  stepTricks(g.tricks, { spin: c.spin, flip: c.flip, grab: c.grab, grounded: g.skier.grounded, perfectPop }, dt);
  // poeng og kombo: regnes ut én gang når du lander (fall gir 0 og nullstiller komboen)
  if (g.tricks.justLanded && g.rail.bail && g.tricks.lastLanding) {
    // falt av railen: landingen i snøen er et fall, med navnet på railtrikset
    g.tricks.lastLanding = { ...g.tricks.lastLanding, quality: 'fall', name: railStyleName(g.rail.bailStyle) };
    g.rail.bail = false;
  }
  if (g.tricks.justLanded && g.tricks.lastLanding) scoreLanding(g.score, g.tricks.lastLanding);
  // på railen går ikke kombo-klokka (den går bare på snøen)
  stepScore(g.score, g.skier.grounded && !g.rail.on, dt);

  if (wasInAir && g.tricks.justLanded) {
    const q = g.tricks.lastLanding?.quality;
    if (q === 'fall') {
      startFall(g.fall, g.skier, g.tricks, g.takeoffZ);
      // ikke sett deg tilbake midt på en rail: da settes du et stykke før starten på den
      const r = railAt(RAILS, g.fall.respawnX, g.fall.respawnZ);
      if (r) g.fall.respawnZ = Math.max(CONFIG.startZ, Math.min(r.z0, r.z0 + r.rail.length * r.dz) - CONFIG.railRespawnBefore);
    }
    else if (q === 'slurvete') g.fall.sloppyAge = 0;
  }
  stepSloppy(g.fall, g.skier, dt);
  return 'none';
}

/**
 * Fysikken for ett steg: på railen glir du langs den, ellers kjører eller flyr du som vanlig.
 * Treffer du en rail i steget, låses du på den (eller faller av hvis du landet for skjevt).
 */
function stepRailOrSnow(g: Game, inp: SkierInput, dt: number): void {
  const s = g.skier;
  if (g.rail.on) {
    const style = g.rail.style;
    const end = stepGrind(g.rail, RAILS, s, inp, dt);
    if (end === 'slutt' || end === 'pop') {
      scoreRail(g.score, {
        name: railStyleName(style), across: style === 'boardslide', time: g.rail.time, sloppy: g.rail.sloppy,
        meters: g.rail.dist, rail: g.rail.index, spinIn: g.rail.spinIn,
      });
      // ut av en boardslide: kroppen vris av seg selv tilbake langs fallinja, til du spinner selv
      g.tricks.turnOut = style === 'boardslide';
    }
    return;
  }
  const prev = { x: s.x, y: s.y, z: s.z };
  stepSkier(s, inp, dt);
  if (g.rail.bail) return;
  const hit = findRailHit(RAILS, prev, s);
  if (!hit) return;
  // skiene vris langs railen; spinnet vris motsatt, så kroppen ikke snur seg brått
  const shift = railHeadingShift(RAILS, s, hit);
  // kvarte runder spunnet i hoppet opp (bare fra lufta)
  const spinIn = hit.fromAir ? Math.round(Math.abs(g.tricks.spin - g.tricks.spinStart) / (Math.PI / 2)) : 0;
  shiftSpin(g.tricks, shift);
  const land = landOnRail(g.tricks);
  const style = land.across ? 'boardslide' : '5050';
  if (land.quality === 'fall') {
    // for skjevt: du treffer railen og dyttes av, og lander i snøen som et fall (skiene vris ikke)
    shiftSpin(g.tricks, -shift);
    bailOff(g.rail, RAILS, s, hit.index, style, hit.side);
    return;
  }
  // skjev landing: du starter ustø, til den siden du var skjev mot
  // fra snøen (rampen): ingen startbalanse og ikke skjevt; kroppen retter seg mykt inn langs railen
  const fromAir = hit.fromAir;
  startGrind(g.rail, RAILS, s, hit, style, fromAir ? land.errDeg / CONFIG.railLandFall : 0, fromAir && land.quality === 'slurvete');
  g.rail.spinIn = spinIn;
}
