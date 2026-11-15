import { CONFIG } from '../core/config';
import { countedGrab, createGrabs, grabName, resetGrabJump, stepGrabs, type GrabKind, type GrabState } from './grabs';

/**
 * Spinn og flips i lufta. Ren logikk uten three.js, så den kan testes.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila.
 *
 * Ingen automatisk fullføring: holder du tasten, bygger rotasjonen seg mykt opp. Slipper du,
 * glir den litt videre (ca. 25°) og bremses så. Du kan altså rotere for lite eller for mye.
 * Ved landing sjekkes hvor nær en hel eller halv runde du er, og kroppen retter seg mykt opp.
 */

export type LandingQuality = 'ren' | 'slurvete' | 'fall';

export interface Landing {
  quality: LandingQuality;
  /** Triksnavn, f.eks. «360», «Backflip» eller «540 + Frontflip». Tom hvis det ikke var noe triks. */
  name: string;
  /** Hvor mye du faktisk roterte i hoppet (grader). Spinn positiv = mot høyre, flip positiv = framover. */
  spinDeg: number;
  flipDeg: number;
  /** Hvor langt unna en hel eller halv runde (spinn) og stående (flip) du landet (grader). */
  spinErrDeg: number;
  flipErrDeg: number;
  /** Grabben som telte (0 = ingen), og hvor lenge den ble holdt (s). */
  grab: GrabKind;
  grabTime: number;
  /** Startet hoppet med en perfekt pop? */
  perfectPop: boolean;
  /** Startet hoppet baklengs (switch)? */
  fromSwitch: boolean;
}

/** Det som skjedde i hoppet i tillegg til rotasjonen. */
export interface JumpExtras {
  grab?: GrabKind;
  grabTime?: number;
  perfectPop?: boolean;
  fromSwitch?: boolean;
}

export interface TrickInput {
  /** -1 (venstre) til 1 (høyre) */
  spin: number;
  /** 1 = frontflip, -1 = backflip */
  flip: number;
  /** står skiløperen på snøen etter dette fysikksteget? */
  grounded: boolean;
  /** grabben som holdes (0 = ingen) */
  grab?: GrabKind;
  /** var hoppet en perfekt pop? Leses i steget hoppet starter. */
  perfectPop?: boolean;
}

export interface TrickState {
  /** Hvor mye kroppen er rotert rundt egen akse (rad, positiv = mot høyre). Går ikke tilbake til 0 etter en runde. */
  spin: number;
  spinRate: number;
  /** Hvor mye kroppen er rotert framover (rad, positiv = frontflip). */
  flip: number;
  flipRate: number;
  inAir: boolean;
  /** Stillingen kroppen hadde da hoppet startet (rad). Rotasjonen i hoppet måles fra den. */
  spinStart: number;
  flipStart: number;
  /** Stillingen kroppen retter seg opp mot på bakken (rad). */
  spinTarget: number;
  flipTarget: number;
  lastLanding: Landing | null;
  /** Sekunder siden siste landing. */
  landingAge: number;
  /** Sant bare i steget skiløperen landet. */
  justLanded: boolean;
  grabs: GrabState;
  /** Om hoppet som pågår startet med perfekt pop, og om det startet baklengs. */
  jumpPerfectPop: boolean;
  jumpFromSwitch: boolean;
}

const DEG = Math.PI / 180;
const TURN = 2 * Math.PI;
const HALF = Math.PI;

export function createTricks(): TrickState {
  return {
    spin: 0, spinRate: 0, flip: 0, flipRate: 0, inAir: false,
    spinStart: 0, flipStart: 0, spinTarget: 0, flipTarget: 0,
    lastLanding: null, landingAge: 99, justLanded: false,
    grabs: createGrabs(), jumpPerfectPop: false, jumpFromSwitch: false,
  };
}

/** Hvor langt (grader) en vinkel er fra nærmeste hele «step» (f.eks. halv runde). */
function offBy(angle: number, step: number): number {
  return Math.abs(angle - Math.round(angle / step) * step) / DEG;
}

const FLIP_WORDS = ['', '', 'Dobbel ', 'Trippel '];

/** Lager navnet på trikset ut fra hvor mye du roterte (rad). */
export function trickName(spin: number, flip: number, grab: GrabKind = 0): string {
  const parts: string[] = [];
  // en rotasjon teller bare når den er nesten hel: innenfor det som fortsatt er en slurvete landing
  const spinTol = (CONFIG.landSpinClean + CONFIG.landSloppyExtra) * DEG;
  const flipTol = (CONFIG.landFlipClean + CONFIG.landSloppyExtra) * DEG;
  const halves = Math.floor((Math.abs(spin) + spinTol) / HALF);
  if (halves > 0) parts.push(String(halves * 180));
  const flips = Math.floor((Math.abs(flip) + flipTol) / TURN);
  if (flips > 0) {
    const kind = flip > 0 ? 'frontflip' : 'backflip';
    const word = flips < FLIP_WORDS.length ? FLIP_WORDS[flips] : `${flips}x `;
    const full = word + kind;
    parts.push(full.charAt(0).toUpperCase() + full.slice(1));
  }
  if (grab) parts.push(grabName(grab));
  return parts.join(' + ');
}

/** Ren, slurvete eller fall, ut fra hvor mye du roterte i hoppet (rad). */
export function judgeLanding(spin: number, flip: number, extras: JumpExtras = {}): Landing {
  const spinErrDeg = offBy(spin, HALF);
  const flipErrDeg = offBy(flip, TURN);
  const extra = CONFIG.landSloppyExtra;
  let quality: LandingQuality = 'fall';
  if (spinErrDeg <= CONFIG.landSpinClean && flipErrDeg <= CONFIG.landFlipClean) quality = 'ren';
  else if (spinErrDeg <= CONFIG.landSpinClean + extra && flipErrDeg <= CONFIG.landFlipClean + extra) quality = 'slurvete';
  const grab = extras.grab ?? 0;
  return {
    quality, name: trickName(spin, flip, grab), spinDeg: spin / DEG, flipDeg: flip / DEG, spinErrDeg, flipErrDeg,
    grab, grabTime: extras.grabTime ?? 0, perfectPop: !!extras.perfectPop, fromSwitch: !!extras.fromSwitch,
  };
}

/** Jevn brems (rad/s²) som gjør at full fart glir akkurat coastDeg grader etter slipp. */
function stopDecel(maxRate: number, coastDeg: number): number {
  return (maxRate * maxRate) / (2 * coastDeg * DEG);
}

/**
 * Farten følger målet mykt: holder du, bygges den opp. Slipper du, bremses den jevnt ned til null,
 * så den stopper kort etter der du slapp. Aldri et hopp i farten.
 */
function approach(rate: number, held: number, maxRate: number, build: number, coastDeg: number, dt: number): number {
  const h = Math.max(-1, Math.min(1, held));
  if (h !== 0) return rate + (h * maxRate - rate) * (1 - Math.exp(-build * dt));
  const slow = stopDecel(maxRate, coastDeg) * dt;
  return Math.abs(rate) <= slow ? 0 : rate - Math.sign(rate) * slow;
}

/** Hvor langt (rad) spinnet eller flipen glir videre hvis du slipper nå. */
export function spinCoast(rate: number): number {
  return (Math.sign(rate) * rate * rate) / (2 * stopDecel(CONFIG.spinSpeedDeg * DEG, CONFIG.spinCoastDeg));
}
export function flipCoast(rate: number): number {
  return (Math.sign(rate) * rate * rate) / (2 * stopDecel(CONFIG.flipSpeedDeg * DEG, CONFIG.flipCoastDeg));
}

/**
 * Myk fjær (kritisk dempet), løst nøyaktig for ett steg: glir mot målet uten å riste.
 * Starter med farten kroppen hadde, så landingen ikke stopper rotasjonen brått.
 */
function settle(x: number, v: number, target: number, w: number, dt: number): [number, number] {
  const x0 = x - target;
  const e = Math.exp(-w * dt);
  const nx = (x0 + (v + w * x0) * dt) * e;
  const nv = (v - (v + w * x0) * w * dt) * e;
  return [target + nx, nv];
}

export function stepTricks(t: TrickState, inp: TrickInput, dt: number): void {
  t.landingAge += dt;
  t.justLanded = false;

  // avsats: hoppet starter, rotasjonen måles fra stillingen kroppen skulle stå i
  if (!inp.grounded && !t.inAir) {
    t.inAir = true;
    t.spinStart = t.spinTarget;
    t.flipStart = t.flipTarget;
    t.jumpPerfectPop = !!inp.perfectPop;
    t.jumpFromSwitch = isSwitch(t);
    resetGrabJump(t.grabs);
  }

  if (t.inAir && inp.grounded) {
    // landing: sjekk hvor nær du er, og velg nærmeste stilling å rette seg opp mot
    t.inAir = false;
    const ds = t.spin - t.spinStart;
    const df = t.flip - t.flipStart;
    const g = countedGrab(t.grabs);
    t.lastLanding = judgeLanding(ds, df, {
      grab: g, grabTime: g ? t.grabs.bestTime : 0, perfectPop: t.jumpPerfectPop, fromSwitch: t.jumpFromSwitch,
    });
    t.landingAge = 0;
    t.justLanded = true;
    // spinn: nærmeste halve runde (en halv runde = du kjører baklengs, switch). Flip: nærmeste hele runde.
    t.spinTarget = t.spinStart + Math.round(ds / HALF) * HALF;
    t.flipTarget = t.flipStart + Math.round(df / TURN) * TURN;
  }

  // grab: teller bare i lufta; på bakken slipper kroppen mykt
  stepGrabs(t.grabs, inp.grab ?? 0, t.inAir, dt);

  if (t.inAir) {
    t.spinRate = approach(t.spinRate, inp.spin, CONFIG.spinSpeedDeg * DEG, CONFIG.spinBuild, CONFIG.spinCoastDeg, dt);
    t.flipRate = approach(t.flipRate, inp.flip, CONFIG.flipSpeedDeg * DEG, CONFIG.flipBuild, CONFIG.flipCoastDeg, dt);
    t.spin += t.spinRate * dt;
    t.flip += t.flipRate * dt;
  } else {
    // skiene biter i snøen: rotasjonsfarten tas hardt ned rett etter landing (mykt avtagende),
    // så kroppen ikke snurrer forbi stillingen den landet i
    const grip = CONFIG.landGrip * Math.max(0, 1 - t.landingAge / CONFIG.landGripTime);
    const keep = Math.exp(-grip * dt);
    t.spinRate *= keep; t.flipRate *= keep;
    // på bakken retter kroppen seg mykt opp (ingen snap), også etter et fall (selve fallet kommer senere)
    [t.spin, t.spinRate] = settle(t.spin, t.spinRate, t.spinTarget, CONFIG.landSettle, dt);
    [t.flip, t.flipRate] = settle(t.flip, t.flipRate, t.flipTarget, CONFIG.landSettle, dt);
  }
}

/** Kjører skiløperen baklengs (switch)? Sant når kroppen står en halv runde rotert. */
export function isSwitch(t: TrickState): boolean {
  return Math.cos(t.spinTarget) < 0;
}
