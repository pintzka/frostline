import { CONFIG } from '../core/config';
import { countFlips, countHalves, type Landing } from './rotation';

/**
 * Poeng og kombo. Ren logikk uten three.js og DOM, og helt deterministisk.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila. Tallene står i src/core/config.ts.
 *
 * Poeng for ett triks = (spinn + flip + grab) × grab-gangetall × perfekt pop × switch
 *   × landing (ren 1, slurvete 0,5, fall 0) × gjentakelse × kombo.
 * Bare ekte triks gir poeng: 540 eller mer, minst én flip, eller en grab som teller.
 * Småhopp (en pop på flaten) gir bare litt, og bygger ikke komboen.
 */

const DEG = Math.PI / 180;

/** Tall i tabellen, og tabellens siste verdi pluss «extra» for hvert steg over. */
function fromTable(table: readonly number[], n: number, extra: number): number {
  if (n < table.length) return table[n];
  return table[table.length - 1] + (n - table.length + 1) * extra;
}

/** Samme telling som triksnavnet, så navn og poeng alltid stemmer. */
export function spinHalves(l: Landing): number { return countHalves(l.spinDeg * DEG); }
export function flipCount(l: Landing): number { return countFlips(l.flipDeg * DEG); }

/** Er dette et ekte triks som gir poeng (540+, en flip eller en grab)? */
export function isRealTrick(l: Landing): boolean {
  return spinHalves(l) >= 3 || flipCount(l) >= 1 || l.grab !== 0;
}

/** Et småhopp er for kort i lufta til å være et ekte hopp, f.eks. en pop på flaten. */
export function isSmallJump(l: Landing): boolean {
  return l.airTime < CONFIG.trickMinAir;
}

/** Grab-gangetallet: starter på 1,25 når grabben teller og vokser jo lenger du holder. */
export function grabMult(l: Landing): number {
  if (!l.grab) return 1;
  const extra = Math.max(0, l.grabTime - CONFIG.grabMinHold) * CONFIG.grabMultPerSec;
  return Math.min(CONFIG.grabMaxMult, CONFIG.grabStartMult + extra);
}

/** Hva trikset er verdt før landing, småhopp, gjentakelse og kombo. Gir 0 hvis det ikke er et ekte triks. */
export function trickValue(l: Landing): number {
  if (!isRealTrick(l)) return 0;
  const base = fromTable(CONFIG.spinPoints, spinHalves(l), CONFIG.spinPointsExtra)
    + fromTable(CONFIG.flipPoints, flipCount(l), CONFIG.flipPointsExtra)
    + (l.grab ? CONFIG.grabPoints : 0);
  return base * grabMult(l) * (l.perfectPop ? CONFIG.popPerfectMult : 1) * (l.fromSwitch ? CONFIG.switchBonus : 1);
}

/**
 * Hva som teller som «samme triks»: like mange halve runder, samme flip og samme grab.
 * Spinnretning og switch gjør det ikke til et nytt triks (switch gir i stedet en liten bonus).
 */
export function trickKey(l: Landing): string {
  const flipDir = flipCount(l) === 0 ? 0 : Math.sign(l.flipDeg);
  return `${spinHalves(l)}|${flipCount(l)}:${flipDir}|${l.grab}`;
}

/** Det som vises på skjermen etter et triks. */
export interface TrickResult {
  name: string;
  quality: Landing['quality'];
  /** Poengene du fikk (allerede ganget med kombo). */
  points: number;
  /** Kombo-gangetallet som ble brukt. */
  combo: number;
  /** Andelen du fikk fordi trikset var gjort nylig (1 = full verdi). */
  repeat: number;
  perfectPop: boolean;
  /** Sant når trikset var for lite til å gi poeng (f.eks. et 360 uten grab). */
  tooSmall: boolean;
  /** Sant når hoppet var et småhopp (pop på flaten). */
  smallJump: boolean;
  /** Sant når du falt og mistet en kombo over x1. */
  comboLost: boolean;
  /** Sant når du landet mens du fortsatt holdt grabben. */
  landedGrabbing: boolean;
}

export interface ScoreState {
  total: number;
  /** Hvor mange ekte triks med ren landing du har i rekke nå. */
  comboCount: number;
  /** Sekunder på snøen siden siste ekte triks. */
  comboIdle: number;
  /** De siste ekte triksene (nyeste sist), for å gi mindre for gjentakelse. */
  recent: string[];
  /** Siste triks som skal vises, og hvor mange sekunder siden. */
  last: TrickResult | null;
  lastAge: number;
}

export function createScore(): ScoreState {
  return { total: 0, comboCount: 0, comboIdle: 0, recent: [], last: null, lastAge: 99 };
}

/** Kombo-gangetallet neste triks får: 1, 1,25, 1,5 ... opp til maks. */
export function comboMult(s: ScoreState): number {
  return Math.min(CONFIG.comboMax, 1 + CONFIG.comboStep * s.comboCount);
}

/** Andelen et triks får når det finnes så mange ganger blant de siste triksene. */
export function repeatShare(s: ScoreState, key: string): number {
  const times = s.recent.filter((k) => k === key).length;
  return Math.max(CONFIG.repeatMin, CONFIG.repeatFactor ** times);
}

/** Runder av til nærmeste 10, så tallene blir lette å lese. */
const round10 = (x: number) => Math.round(x / 10) * 10;

function show(s: ScoreState, l: Landing, r: Partial<TrickResult>): TrickResult {
  s.last = {
    name: l.name, quality: l.quality, points: 0, combo: 1, repeat: 1, perfectPop: l.perfectPop,
    tooSmall: false, smallJump: false, comboLost: false, landedGrabbing: l.landedGrabbing, ...r,
  };
  s.lastAge = 0;
  return s.last;
}

/** Kalles én gang når skiløperen lander. Gir poeng og oppdaterer komboen. */
export function scoreLanding(s: ScoreState, l: Landing): TrickResult | null {
  const real = isRealTrick(l);

  if (l.quality === 'fall') {
    // fall: null poeng og komboen er borte. Vises alltid, så du ser hvorfor komboen forsvant.
    const comboLost = s.comboCount > 0;
    s.comboCount = 0;
    s.comboIdle = 0;
    return show(s, l, { comboLost });
  }
  // et hopp uten ekte triks endrer ingenting (heller ikke komboen). Har det et navn (180, 360), vises det uten poeng.
  if (!real) return l.name === '' ? null : show(s, l, { tooSmall: true });

  const share = l.quality === 'ren' ? 1 : CONFIG.sloppyShare;

  if (isSmallJump(l)) {
    // småhopp: litt poeng, men ingen kombo, og det huskes ikke som et triks
    const points = round10(trickValue(l) * share * CONFIG.smallJumpShare);
    s.total += points;
    return show(s, l, { points, smallJump: true });
  }

  const key = trickKey(l);
  const repeat = repeatShare(s, key);
  s.recent.push(key);
  if (s.recent.length > CONFIG.repeatMemory) s.recent.shift();
  const combo = comboMult(s);
  const points = round10(trickValue(l) * share * repeat * combo);

  s.total += points;
  s.comboIdle = 0;
  // bare ren landing bygger komboen videre; slurvete beholder den som den er
  if (l.quality === 'ren') s.comboCount++;
  return show(s, l, { points, combo, repeat });
}

/** Ett steg. Lang tid på snøen uten nytt ekte triks nullstiller komboen. */
export function stepScore(s: ScoreState, grounded: boolean, dt: number): void {
  s.lastAge += dt;
  if (grounded && s.comboCount > 0) {
    s.comboIdle += dt;
    if (s.comboIdle > CONFIG.comboTimeout) { s.comboCount = 0; s.comboIdle = 0; }
  }
}

/** Et ferdig stykke på en rail eller boks. */
export interface RailRun {
  /** «50-50» eller «Boardslide». */
  name: string;
  /** Boardslide (på tvers) gir mer poeng per sekund. */
  across: boolean;
  /** Sekunder på railen. */
  time: number;
  /** Landet du skjevt på railen? Da gir den halve poeng og bygger ikke komboen. */
  sloppy: boolean;
}

/** 1.25 → «1,3 s» */
export function railTimeText(time: number): string {
  return `${time.toFixed(1).replace('.', ',')} s`;
}

/**
 * Kalles når du er ferdig med en rail (hoppet av eller kom til slutten). Railen er et ekte triks i komboen:
 * poeng per sekund × landing × gjentakelse × kombo. Faller du av railen, er det et vanlig fall i stedet.
 */
export function scoreRail(s: ScoreState, r: RailRun): TrickResult {
  const name = `${r.name} ${railTimeText(r.time)}`;
  const quality = r.sloppy ? 'slurvete' : 'ren';
  const base = { name, quality, points: 0, combo: 1, repeat: 1, perfectPop: false, tooSmall: false, smallJump: false, comboLost: false, landedGrabbing: false } as const;
  if (r.time < CONFIG.railMinTime) {
    s.last = { ...base, tooSmall: true };
    s.lastAge = 0;
    return s.last;
  }
  const key = `rail|${r.across ? 'board' : '5050'}`;
  const repeat = repeatShare(s, key);
  s.recent.push(key);
  if (s.recent.length > CONFIG.repeatMemory) s.recent.shift();
  const combo = comboMult(s);
  const perSec = r.across ? CONFIG.railPointsBoard : CONFIG.railPoints5050;
  const points = round10(perSec * r.time * (r.sloppy ? CONFIG.sloppyShare : 1) * repeat * combo);
  s.total += points;
  s.comboIdle = 0;
  if (!r.sloppy) s.comboCount++;
  s.last = { ...base, points, combo, repeat };
  s.lastAge = 0;
  return s.last;
}
