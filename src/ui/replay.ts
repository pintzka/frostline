import { CONFIG } from '../core/config';
import { stepGame, type FlowEvent, type Game, type GameInput } from './flow';

/**
 * Reprise av siste runde: opptak av inputen som går inn i spillsteget, og avspilling.
 * Fysikken er deterministisk (fast steg), så samme starttilstand + samme input gir nøyaktig samme runde.
 * Ren logikk uten DOM og three.js. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 *
 * Opptaket starter når en ny runde starter (en kopi av hele spillet tas da), og stopper i mål.
 * Bare stegene der inputen endrer seg lagres, så en runde tar lite plass.
 */

/** Inputen fra et bestemt steg og videre, til neste endring. */
export interface InputChange {
  step: number;
  inp: GameInput;
}

export interface Recording {
  /** Hele spillet rett etter steget som startet runden. */
  start: Game;
  changes: InputChange[];
  /** Antall steg som er tatt opp (fra start til og med målet). */
  steps: number;
  /** Runden kom i mål, så den kan spilles av. */
  finished: boolean;
}

export interface Recorder {
  rec: Recording | null;
}

/** Ingen taster: brukes etter målet i reprisen, så ingenting i halen kan starte en ny runde. */
const IDLE: GameInput = { raw: { steer: 0, brake: 0, flip: 0, pop: false, grab: 0 }, click: false, restart: false };

/** Dyp kopi som beholder delte objekter (f.eks. samme landing i triks og statistikk), så kopien oppfører seg likt. */
export function cloneGame(g: Game): Game {
  return structuredClone(g);
}

function copyInput(i: GameInput): GameInput {
  return { raw: { ...i.raw }, click: i.click, restart: i.restart };
}

function sameInput(a: GameInput, b: GameInput): boolean {
  const x = a.raw, y = b.raw;
  return x.steer === y.steer && x.brake === y.brake && x.flip === y.flip && !!x.pop === !!y.pop
    && (x.grab ?? 0) === (y.grab ?? 0) && !!x.flipByThumb === !!y.flipByThumb && a.click === b.click && a.restart === b.restart;
}

export function createRecorder(): Recorder {
  return { rec: null };
}

/**
 * Kalles etter hvert ekte steg med inputen steget fikk og hendelsen det ga.
 * Ny runde starter et nytt opptak (det gamle glemmes), målet avslutter det.
 */
export function recordStep(r: Recorder, g: Game, inp: GameInput, ev: FlowEvent): void {
  if (ev === 'ny-runde') {
    r.rec = { start: cloneGame(g), changes: [], steps: 0, finished: false };
    return;
  }
  const rec = r.rec;
  if (!rec || rec.finished) return;
  const last = rec.changes[rec.changes.length - 1];
  if (!last || !sameInput(last.inp, inp)) rec.changes.push({ step: rec.steps, inp: copyInput(inp) });
  rec.steps++;
  if (ev === 'mål') rec.finished = true;
  // for lang runde: dropp opptaket i stedet for å fylle minnet
  else if (rec.steps > CONFIG.replayMaxTime * CONFIG.physicsHz) r.rec = null;
}

/** Kan siste runde spilles av nå? Bare på resultatskjermen, og bare hvis runden kom i mål. */
export function canReplay(r: Recorder, g: Game): boolean {
  return g.flow.phase === 'resultat' && !!r.rec?.finished;
}

export interface Player {
  /** Egen kopi av spillet. Den ekte runden røres aldri. */
  game: Game;
  rec: Recording;
  step: number;
  next: number;
  cur: GameInput;
  /** Hele reprisen (med halen etter målet) er spilt. */
  done: boolean;
}

export function createPlayer(rec: Recording): Player {
  return { game: cloneGame(rec.start), rec, step: 0, next: 0, cur: IDLE, done: false };
}

/** Ett steg av reprisen: samme input som i runden, så samme steg i spillet. */
export function stepPlayer(p: Player, dt: number): FlowEvent {
  if (p.done) return null;
  const { rec } = p;
  if (p.step < rec.steps) {
    while (p.next < rec.changes.length && rec.changes[p.next].step <= p.step) p.cur = rec.changes[p.next++].inp;
  } else p.cur = IDLE;
  const ev = stepGame(p.game, p.cur, dt);
  p.step++;
  if (p.step >= rec.steps + Math.round(CONFIG.replayTail * CONFIG.physicsHz)) p.done = true;
  return ev;
}

/** Hvor langt reprisen har kommet (0–1), med halen etter målet. */
export function playerProgress(p: Player): number {
  const total = p.rec.steps + Math.round(CONFIG.replayTail * CONFIG.physicsHz);
  return Math.min(1, p.step / total);
}

/** Avspilling + kameravalg + om mellomrom var holdt (så bare et nytt trykk går ut). */
export interface ReplaySession {
  player: Player;
  cam: number;
  popWas: boolean;
}

export function createSession(rec: Recording, camCount: number, startCam = 0): ReplaySession {
  // mellomrom regnes som holdt fra starten, så det må slippes før det kan avslutte
  return { player: createPlayer(rec), cam: Math.max(0, Math.min(camCount - 1, startCam)), popWas: true };
}

/** Ekte mellomrom/A/POP under reprisen: gir true på et nytt trykk (= tilbake til resultatet). */
export function exitPressed(s: ReplaySession, pop: boolean): boolean {
  const pressed = pop && !s.popWas;
  s.popWas = pop;
  return pressed;
}

export function nextCam(s: ReplaySession, camCount: number): void {
  s.cam = (s.cam + 1) % camCount;
}

export function setCam(s: ReplaySession, i: number, camCount: number): void {
  if (i >= 0 && i < camCount) s.cam = i;
}

/**
 * Tilbake til resultatskjermen: mellomrom som holdes nå, skal ikke starte en ny runde.
 * (Flyten ser bare nye trykk, så vi later som om det var holdt forrige steg.)
 */
export function backToResult(g: Game): void {
  g.flow.spaceWas = true;
}
