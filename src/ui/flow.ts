import { CONFIG } from '../core/config';
import { createSkier, reachedEnd, speedOf, stepSkier, type SkierState } from '../physics/skier';
import { createTricks, stepTricks, type Landing, type TrickState } from '../tricks/rotation';
import { createLatch, splitControls, type ControlLatch, type RawControls } from '../tricks/controls';

/**
 * Flyten i spillet: startskjerm → kjører → resultat → kjører igjen, og statistikken for runden.
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
  /** største landede triks (ren eller slurvete), null hvis ingen */
  bestTrick: Landing | null;
  /** siste landing vi har sett, så samme landing ikke telles flere ganger */
  lastLanding: Landing | null;
}

export interface Flow {
  phase: Phase;
  /** sekunder i denne tilstanden */
  phaseAge: number;
  stats: RunStats;
  /** var mellomrom / R holdt forrige steg (for å se nye trykk) */
  spaceWas: boolean;
  restartWas: boolean;
  /** sant når runden ble startet med mellomrom og tasten ikke er sluppet ennå: da er det ikke pop */
  popBlocked: boolean;
}

export interface Game {
  flow: Flow;
  skier: SkierState;
  tricks: TrickState;
  latch: ControlLatch;
}

export interface GameInput {
  /** tastene (pop = mellomrom) */
  raw: RawControls;
  /** klikket eller trykket på skjermen siden forrige steg */
  click: boolean;
  /** R holdes */
  restart: boolean;
}

export function createStats(): RunStats {
  return { time: 0, topSpeed: 0, longestAir: 0, bestTrick: null, lastLanding: null };
}

/** Hvor mye et triks er verdt, for å finne det beste: grader rotert. Fall og vanlige hopp er 0. */
export function trickValue(l: Landing): number {
  if (l.quality === 'fall' || l.name === '') return 0;
  const halves = Math.round(Math.abs(l.spinDeg) / 180);
  const flips = Math.round(Math.abs(l.flipDeg) / 360);
  return halves * 180 + flips * 360;
}

/** Det beste av to triks. Er de like store, vinner ren landing. */
export function bestOf(a: Landing | null, b: Landing): Landing | null {
  const vb = trickValue(b);
  if (vb === 0) return a;
  if (!a) return b;
  const va = trickValue(a);
  if (vb > va) return b;
  if (vb === va && a.quality !== 'ren' && b.quality === 'ren') return b;
  return a;
}

export function recordStats(st: RunStats, s: { dt: number; speed: number; inAir: boolean; airTime: number; landing: Landing | null }): void {
  st.time += s.dt;
  st.topSpeed = Math.max(st.topSpeed, s.speed);
  if (s.inAir) st.longestAir = Math.max(st.longestAir, s.airTime);
  if (s.landing && s.landing !== st.lastLanding) {
    st.lastLanding = s.landing;
    st.bestTrick = bestOf(st.bestTrick, s.landing);
  }
}

export function createGame(): Game {
  return {
    flow: { phase: 'start', phaseAge: 0, stats: createStats(), spaceWas: false, restartWas: false, popBlocked: false },
    skier: createSkier(),
    tricks: createTricks(),
    latch: createLatch(),
  };
}

const IDLE: RawControls = { steer: 0, brake: 0, flip: 0, pop: false };

function newRun(g: Game, bySpace: boolean): void {
  g.skier = createSkier();
  g.tricks = createTricks();
  g.latch = createLatch();
  g.flow.stats = createStats();
  g.flow.phase = 'kjorer';
  g.flow.phaseAge = 0;
  g.flow.popBlocked = bySpace;
}

/** Etter målet: bremser mykt men bestemt inn, så skiløperen stopper før bakken tar slutt. */
function stopAtFinish(s: SkierState, dt: number): void {
  const v = speedOf(s);
  if (v <= 0) return;
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

  let event: FlowEvent = null;
  if (f.phase === 'start') {
    if (spacePressed || inp.click) { newRun(g, spacePressed); event = 'ny-runde'; }
  } else if (f.phase === 'resultat') {
    // kort pause først, så et trykk rett etter målet ikke hopper over resultatet
    const ready = f.phaseAge >= CONFIG.resultMinTime;
    if (restartPressed || (ready && (spacePressed || inp.click))) { newRun(g, spacePressed); event = 'ny-runde'; }
  } else if (restartPressed) { newRun(g, false); event = 'ny-runde'; }

  // på startskjermen står skiløperen stille
  if (f.phase === 'start') return event;

  // slipper du mellomrom etter at det startet runden, er det ikke en pop
  if (!space) f.popBlocked = false;
  const raw = f.phase === 'kjorer' ? { ...inp.raw, pop: space && !f.popBlocked } : IDLE;
  const c = splitControls(raw, g.skier.grounded, g.latch);
  stepSkier(g.skier, f.phase === 'kjorer' ? c.skier : { steer: 0, brake: 1 }, dt);
  stepTricks(g.tricks, { spin: c.spin, flip: c.flip, grounded: g.skier.grounded }, dt);

  if (f.phase === 'resultat') { stopAtFinish(g.skier, dt); return event; }

  recordStats(f.stats, {
    dt, speed: speedOf(g.skier), inAir: !g.skier.grounded, airTime: g.skier.airTime, landing: g.tricks.lastLanding,
  });
  if (reachedEnd(g.skier)) { f.phase = 'resultat'; f.phaseAge = 0; return 'mål'; }
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
    ['Beste triks', t ? t.name + (t.quality === 'slurvete' ? ' (slurvete)' : '') : 'Ingen ennå'],
  ];
}

/** Flytter en synlighet (0–1) mot målet, jevnt over `time` sekunder. Brukes til myke overganger. */
export function fade(current: number, target: number, dt: number, time: number): number {
  const step = time > 0 ? dt / time : 1;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}
