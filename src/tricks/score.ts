import { CONFIG } from '../core/config';
import type { Landing } from './rotation';

/**
 * Poeng og kombo. Ren logikk uten three.js og DOM, og helt deterministisk.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila. Tallene står i src/core/config.ts.
 *
 * Poeng for ett triks = (spinn + flip + grab) × grab-gangetall × perfekt pop
 *   × landing (ren 1, slurvete 0,5, fall 0) × gjentakelse (samme triks på rad gir mindre) × kombo.
 * Bare ekte triks gir poeng: 540 eller mer, minst én flip, eller en grab som teller.
 */

/** Tall i tabellen, og tabellens siste verdi pluss «extra» for hvert steg over. */
function fromTable(table: readonly number[], n: number, extra: number): number {
  if (n < table.length) return table[n];
  return table[table.length - 1] + (n - table.length + 1) * extra;
}

export function spinHalves(l: Landing): number { return Math.round(Math.abs(l.spinDeg) / 180); }
export function flipCount(l: Landing): number { return Math.round(Math.abs(l.flipDeg) / 360); }

/** Er dette et ekte triks som gir poeng (540+, en flip eller en grab)? */
export function isRealTrick(l: Landing): boolean {
  return spinHalves(l) >= 3 || flipCount(l) >= 1 || l.grab !== 0;
}

/** Grab-gangetallet: starter på 1,25 når grabben teller og vokser jo lenger du holder. */
export function grabMult(l: Landing): number {
  if (!l.grab) return 1;
  const extra = Math.max(0, l.grabTime - CONFIG.grabMinHold) * CONFIG.grabMultPerSec;
  return Math.min(CONFIG.grabMaxMult, CONFIG.grabStartMult + extra);
}

/** Hva trikset er verdt før landing, gjentakelse og kombo. Gir 0 hvis det ikke er et ekte triks. */
export function trickValue(l: Landing): number {
  if (!isRealTrick(l)) return 0;
  const base = fromTable(CONFIG.spinPoints, spinHalves(l), CONFIG.spinPointsExtra)
    + fromTable(CONFIG.flipPoints, flipCount(l), CONFIG.flipPointsExtra)
    + (l.grab ? CONFIG.grabPoints : 0);
  return base * grabMult(l) * (l.perfectPop ? CONFIG.popPerfectMult : 1);
}

/** Hva som teller som «samme triks»: like mange runder samme vei, samme flip, samme grab og samme stilling (switch). */
export function trickKey(l: Landing): string {
  const spinDir = spinHalves(l) === 0 ? 0 : Math.sign(l.spinDeg);
  const flipDir = flipCount(l) === 0 ? 0 : Math.sign(l.flipDeg);
  return `${spinHalves(l)}:${spinDir}|${flipCount(l)}:${flipDir}|${l.grab}|${l.fromSwitch ? 's' : 'n'}`;
}

/** Det som vises på skjermen etter et triks. */
export interface TrickResult {
  name: string;
  quality: Landing['quality'];
  /** Poengene du fikk (allerede ganget med kombo). */
  points: number;
  /** Kombo-gangetallet som ble brukt. */
  combo: number;
  /** Andelen du fikk fordi trikset var likt det forrige (1 = full verdi). */
  repeat: number;
  perfectPop: boolean;
  /** Sant når trikset var for lite til å gi poeng (f.eks. et 360 uten grab). */
  tooSmall: boolean;
}

export interface ScoreState {
  total: number;
  /** Hvor mange ekte triks med ren landing du har i rekke nå. */
  comboCount: number;
  /** Sekunder på snøen siden siste ekte triks. */
  comboIdle: number;
  /** Forrige ekte triks, og hvor mange ganger på rad det er gjentatt. */
  lastKey: string;
  repeatStreak: number;
  /** Siste triks som skal vises, og hvor mange sekunder siden. */
  last: TrickResult | null;
  lastAge: number;
}

export function createScore(): ScoreState {
  return { total: 0, comboCount: 0, comboIdle: 0, lastKey: '', repeatStreak: 0, last: null, lastAge: 99 };
}

/** Kombo-gangetallet neste triks får: 1, 1,25, 1,5 ... opp til maks. */
export function comboMult(s: ScoreState): number {
  return Math.min(CONFIG.comboMax, 1 + CONFIG.comboStep * s.comboCount);
}

/** Runder av til nærmeste 10, så tallene blir lette å lese. */
const round10 = (x: number) => Math.round(x / 10) * 10;

/** Kalles én gang når skiløperen lander. Gir poeng og oppdaterer komboen. */
export function scoreLanding(s: ScoreState, l: Landing): TrickResult | null {
  const real = isRealTrick(l);

  if (l.quality === 'fall') {
    // fall: null poeng og komboen er borte
    s.comboCount = 0;
    s.comboIdle = 0;
    if (!real && l.name === '') return null;
    s.last = { name: l.name, quality: 'fall', points: 0, combo: 1, repeat: 1, perfectPop: l.perfectPop, tooSmall: false };
    s.lastAge = 0;
    return s.last;
  }
  // et lite hopp uten ekte triks endrer ingenting (heller ikke komboen). Har det et navn (180, 360), vises det uten poeng.
  if (!real) {
    if (l.name === '') return null;
    s.last = { name: l.name, quality: l.quality, points: 0, combo: 1, repeat: 1, perfectPop: l.perfectPop, tooSmall: true };
    s.lastAge = 0;
    return s.last;
  }

  const key = trickKey(l);
  s.repeatStreak = key === s.lastKey ? s.repeatStreak + 1 : 0;
  s.lastKey = key;
  const repeat = Math.max(CONFIG.repeatMin, CONFIG.repeatFactor ** s.repeatStreak);
  const combo = comboMult(s);
  const share = l.quality === 'ren' ? 1 : CONFIG.sloppyShare;
  const points = round10(trickValue(l) * share * repeat * combo);

  s.total += points;
  s.comboIdle = 0;
  // bare ren landing bygger komboen videre; slurvete beholder den som den er
  if (l.quality === 'ren') s.comboCount++;
  s.last = { name: l.name, quality: l.quality, points, combo, repeat, perfectPop: l.perfectPop, tooSmall: false };
  s.lastAge = 0;
  return s.last;
}

/** Ett steg. Lang tid på snøen uten nytt ekte triks nullstiller komboen. */
export function stepScore(s: ScoreState, grounded: boolean, dt: number): void {
  s.lastAge += dt;
  if (grounded && s.comboCount > 0) {
    s.comboIdle += dt;
    if (s.comboIdle > CONFIG.comboTimeout) { s.comboCount = 0; s.comboIdle = 0; }
  }
}
