import { CONFIG } from '../core/config';
import { canRestart, snowSkier, createGame as createCoreGame, restartGame, stepGame as stepCoreGame, type Game as CoreGame, type Move } from '../core/game';
import { reachedEnd, speedOf, type SkierState } from '../physics/skier';
import type { RawControls } from '../tricks/controls';
import { isFalling } from '../tricks/fall';
import type { ScoreState, TrickResult } from '../tricks/score';

/**
 * Flyten i spillet: startskjerm → kjører → resultat → kjører igjen, og statistikken for runden.
 * Selve kjøringen (fysikk, triks, fall og poeng) er core/game.ts; her ligger bare når den går, og runden rundt.
 * Ren logikk uten DOM og three.js, så den kan testes. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 */

export type Phase = 'start' | 'kjorer' | 'resultat';

/** Det som skjedde i et steg: en ny runde startet, eller du kom i mål. */
export type FlowEvent = 'ny-runde' | 'mål' | null;

export interface RunStats {
  /** sekunder fra start til mål */
  time: number;
  /** m/s */
  topSpeed: number;
  /** sekunder, lengste hopp i runden */
  longestAir: number;
  /** trikset som ga flest poeng i runden (fra poeng-systemet), null hvis ingen ga poeng */
  bestTrick: TrickResult | null;
}

export interface Flow {
  phase: Phase;
  /** sekunder i denne tilstanden */
  phaseAge: number;
  stats: RunStats;
  /** var mellomrom / R holdt forrige steg (for å se nye trykk) */
  spaceWas: boolean;
  restartWas: boolean;
  /** Ble skiløperen flyttet i siste steg ('restart' = ny runde, 'respawn' = satt tilbake etter fall)? */
  move: Move;
  /** Beste runde før denne runden startet, så resultatskjermen kan si «ny rekord». */
  bestBefore: number;
  /** Resultatskjermen: mellomrom er sluppet etter at resultatet har vist seg lenge nok, så neste trykk teller. */
  resultArmed: boolean;
}

/** Hele spillet: kjøringen fra core/game.ts pluss flyten rundt. */
export interface Game extends CoreGame {
  flow: Flow;
}

export interface GameInput {
  /** tastene (pop = mellomrom) */
  raw: RawControls;
  /** klikket eller trykket på skjermen siden forrige steg */
  click: boolean;
  /** R holdes (eller ble trykket nå) */
  restart: boolean;
}

export function createStats(): RunStats {
  return { time: 0, topSpeed: 0, longestAir: 0, bestTrick: null };
}

/**
 * Teller med i rundestatistikken. scored = siste triks fra poeng-systemet (tricks/score.ts):
 * beste triks er det som ga flest poeng, så fall og triks uten poeng teller ikke.
 */
export function recordStats(st: RunStats, s: { dt: number; speed: number; inAir: boolean; airTime: number; scored: TrickResult | null }): void {
  if (s.scored && s.scored.points > (st.bestTrick?.points ?? 0)) st.bestTrick = s.scored;
  st.time += s.dt;
  st.topSpeed = Math.max(st.topSpeed, s.speed);
  if (s.inAir) st.longestAir = Math.max(st.longestAir, s.airTime);
}

export function createGame(): Game {
  const flow: Flow = { phase: 'start', phaseAge: 0, stats: createStats(), spaceWas: false, restartWas: false, move: 'none', bestBefore: 0, resultArmed: false };
  return Object.assign(createCoreGame(), { flow });
}

/** Etter målet: ingen styring, full brems. */
const STOP: RawControls = { steer: 0, brake: 1, flip: 0, pop: false };

/** Ny runde: alt i kjøringen starter på nytt (poengene også), beste runde huskes. */
function newRun(g: Game, bySpace: boolean): void {
  restartGame(g);
  // startet du med mellomrom (eller A/POP), er ikke det samme trykket en pop
  g.popLock = bySpace;
  g.flow.bestBefore = g.best;
  g.flow.stats = createStats();
  g.flow.phase = 'kjorer';
  g.flow.phaseAge = 0;
  g.flow.move = 'restart';
}

/**
 * Skiløperen slik lyden skal høre den: på startskjermen står den stille (ingen vind eller snø-sus),
 * og på en rail er ikke skiene i snøen (core/game.ts snowSkier).
 */
export function soundSkier(g: Game): SkierState {
  return g.flow.phase === 'start' ? { ...g.skier, vx: 0, vy: 0, vz: 0, edge: 0, brake: 0 } : snowSkier(g);
}

/**
 * Fortsetter etter pause (eller fanebytte): pop som ble holdt eller ladet før pausen kastes,
 * og mellomrom som fortsatt holdes, må slippes før det starter en runde eller gir pop.
 */
export function resumeGame(g: Game): void {
  g.popLock = true;
  g.flow.spaceWas = true;
}

/** Etter målet: bremser mykt men bestemt inn, så skiløperen stopper før bakken tar slutt. Bare på snøen, ikke i lufta. */
function stopAtFinish(s: SkierState, dt: number): void {
  const v = speedOf(s);
  if (v <= 0 || !s.grounded) return;
  const k = Math.max(0, v - CONFIG.finishStopDecel * dt) / v;
  s.vx *= k; s.vy *= k; s.vz *= k;
}

/** Ett fysikksteg for hele spillet: flyten, skiløperen og triksene. */
export function stepGame(g: Game, inp: GameInput, dt: number): FlowEvent {
  const f = g.flow;
  const space = !!inp.raw.pop;
  const spacePressed = space && !f.spaceWas;
  const restartPressed = inp.restart && !f.restartWas;
  f.spaceWas = space;
  f.restartWas = inp.restart;
  f.phaseAge += dt;
  f.move = 'none';

  let event: FlowEvent = null;
  if (f.phase === 'start') {
    if (spacePressed || inp.click) { newRun(g, spacePressed); event = 'ny-runde'; }
  } else if (f.phase === 'resultat') {
    // kort pause først, så et trykk rett etter målet ikke hopper over resultatet. Mellomrom må i tillegg
    // slippes etter pausen og trykkes på nytt, så tapping på pop inn i mål ikke hopper over det.
    const ready = f.phaseAge >= CONFIG.resultMinTime;
    if (ready && !space) f.resultArmed = true;
    // R virker med en gang, men ikke mens skjermen fortsatt blekes etter et fall
    const go = (restartPressed && canRestart(g)) || (ready && ((f.resultArmed && spacePressed) || inp.click));
    if (go) { newRun(g, spacePressed); event = 'ny-runde'; }
  } else if (restartPressed && canRestart(g)) {
    // R virker først når skjermen er helt klar igjen etter et fall (som i core/game.ts)
    newRun(g, false); event = 'ny-runde';
  }

  // på startskjermen står skiløperen stille
  if (f.phase === 'start') return event;

  // kjøringen: fysikk, triks, fall og poeng. Slutten av bakken gir resultat her, ikke ny runde.
  const move = stepCoreGame(g, f.phase === 'kjorer' ? inp.raw : STOP, dt);
  if (f.move === 'none') f.move = move;

  if (f.phase === 'resultat') { stopAtFinish(g.skier, dt); return event; }

  recordStats(f.stats, {
    dt, speed: speedOf(g.skier), inAir: !g.skier.grounded, airTime: g.skier.airTime, scored: g.score.last,
  });
  // i mål først når du står på snøen og ikke faller: krysser du mållinja i lufta eller på en rail, teller
  // landingen (med poeng, eller fall og respawn) før resultatet, så tabellen stemmer med det som skjedde
  if (reachedEnd(g.skier) && g.skier.grounded && !g.rail.on && !isFalling(g.fall)) {
    f.phase = 'resultat'; f.phaseAge = 0; f.resultArmed = false;
    return 'mål';
  }
  return event;
}

/** Tall med komma, som på norsk: 2.5 → «2,5». */
function comma(x: number, digits: number): string {
  return x.toFixed(digits).replace('.', ',');
}

/** Linjene på resultatskjermen: [hva, verdi]. */
export function resultLines(st: RunStats): [string, string][] {
  const min = Math.floor(st.time / 60);
  const sec = st.time - min * 60;
  const time = min > 0 ? `${min}:${sec < 10 ? '0' : ''}${comma(sec, 1)}` : `${comma(sec, 1)} s`;
  const t = st.bestTrick;
  return [
    ['Tid', time],
    ['Toppfart', `${Math.round(st.topSpeed * 3.6)} km/t`],
    ['Lengste lufttid', `${comma(st.longestAir, 1)} s`],
    ['Beste triks', t ? `${t.name}${t.quality === 'slurvete' ? ' (slurvete)' : ''} · ${points(t.points)}` : 'Ingen ennå'],
  ];
}

/** 4200 → «4 200». */
function points(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Poeng-linjene på resultatskjermen: poengene i runden og beste runde (beste triks står i resultLines). */
export function scoreLines(score: ScoreState, bestBefore: number): [string, string][] {
  const record = score.total > 0 && score.total > bestBefore;
  const lines: [string, string][] = [['Poeng', points(score.total) + (record && bestBefore > 0 ? ' · ny rekord!' : '')]];
  if (bestBefore > 0) lines.push(['Beste runde', points(Math.max(bestBefore, score.total))]);
  return lines;
}

/** Flytter en synlighet (0–1) mot målet, jevnt over `time` sekunder. Brukes til myke overganger. */
export function fade(current: number, target: number, dt: number, time: number): number {
  const step = time > 0 ? dt / time : 1;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}
