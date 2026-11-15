import { CONFIG } from '../core/config';
import { bodyQuat, bodyStance } from './offaxis';
import { countedGrab, createGrabs, grabName, resetGrabJump, stepGrabs, type GrabKind, type GrabState } from './grabs';

/**
 * Spinn og flips i lufta. Ren logikk uten three.js, så den kan testes.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila.
 *
 * Holder du tasten, bygger rotasjonen seg mykt opp. Slipper du, glir den litt videre (ca. 25°) og bremses så.
 * Uten landingshjelp kan du altså rotere for lite eller for mye.
 * Med landingshjelp (assist): slipper du nær en ren stilling, fullfører spillet rolig resten (se assistRate).
 * Ved landing sjekkes hvor nær en hel eller halv runde du er, og kroppen retter seg mykt opp.
 *
 * Off-axis (cork og rodeo): trykker du spinn og flip begge innen offAxisWindow sekunder etter avsatsen,
 * tipper kroppen over på skrå mens den snurrer (se offaxis.ts). W gir cork, S gir rodeo.
 * Tastene og farten er de samme, bare stillingen og navnet endres. Landingen vurderes da ut fra hvor kroppen faktisk står.
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
  /** Sekunder i lufta i hoppet. */
  airTime: number;
  /** Holdt du fortsatt grabben da du landet? Da blir landingen slurvete. */
  landedGrabbing: boolean;
  /** Var det et off-axis-triks (cork eller rodeo) som teller? Gir bonus på spinnpoengene. */
  offAxis?: boolean;
}

/** Det som skjedde i hoppet i tillegg til rotasjonen. */
export interface JumpExtras {
  grab?: GrabKind;
  grabTime?: number;
  perfectPop?: boolean;
  fromSwitch?: boolean;
  airTime?: number;
  /** grabben holdes fortsatt idet skiene treffer snøen */
  stillGrabbing?: boolean;
  /**
   * Hvor skjevt kroppen sto da hoppet startet (rad), f.eks. en kvart runde etter en boardslide.
   * Landingen sjekkes ut fra hvordan kroppen faktisk står, så 90° ut av en boardslide er rent.
   */
  spinOffset?: number;
  /** hoppet var off-axis (cork eller rodeo) */
  offAxis?: boolean;
  /** hvor langt unna stående (flip) og en hel eller halv runde (spinn) kroppen faktisk står (grader). Regnes ellers fra vinklene. */
  stance?: { spinErrDeg: number; flipErrDeg: number };
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
  /** Landingshjelp på? Uten den (eller false) virker alt nøyaktig som før. */
  assist?: boolean;
  /** Anslått tid (s) til skiene treffer snøen. Hjelpen blir litt sterkere jo nærmere landingen er. */
  toLand?: number;
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
  /** Sekunder i lufta i hoppet som pågår (eller det siste). */
  airTime: number;
  /** Etter en boardslide: kroppen vris av seg selv tilbake langs fallinja i lufta, til du spinner selv. */
  turnOut: boolean;
  /** Er hoppet som pågår (eller det siste) off-axis? Bestemmes innen offAxisWindow etter avsatsen. */
  offAxis: boolean;
  /** Spinnretning × flipretning da off-axis startet (±1). Gjør at hodet tipper ut mot spinnsiden. */
  offAxisSide: number;
  /** Hvor mye stillingen er off-axis (0 = vanlig, 1 = helt). Glir mykt, så kroppen aldri hopper. */
  offAxisBlend: number;
}

const DEG = Math.PI / 180;
const TURN = 2 * Math.PI;
const HALF = Math.PI;

export function createTricks(): TrickState {
  return {
    spin: 0, spinRate: 0, flip: 0, flipRate: 0, inAir: false,
    spinStart: 0, flipStart: 0, spinTarget: 0, flipTarget: 0,
    lastLanding: null, landingAge: 99, justLanded: false,
    grabs: createGrabs(), jumpPerfectPop: false, jumpFromSwitch: false, airTime: 0, turnOut: false,
    offAxis: false, offAxisSide: 1, offAxisBlend: 0,
  };
}

/** Hvor langt (grader) en vinkel er fra nærmeste hele «step» (f.eks. halv runde). */
function offBy(angle: number, step: number): number {
  return Math.abs(angle - Math.round(angle / step) * step) / DEG;
}

const FLIP_WORDS = ['', '', 'Dobbel ', 'Trippel '];

// en rotasjon teller bare når den er nesten hel: innenfor det som fortsatt er en slurvete landing
/** Hvor mange halve runder spinn som teller (spin i rad). Brukes både til navn og poeng. */
export function countHalves(spin: number): number {
  return Math.floor((Math.abs(spin) + (CONFIG.landSpinClean + CONFIG.landSloppyExtra) * DEG) / HALF);
}
/** Hvor mange hele flips som teller (flip i rad). */
export function countFlips(flip: number): number {
  return Math.floor((Math.abs(flip) + (CONFIG.landFlipClean + CONFIG.landSloppyExtra) * DEG) / TURN);
}

/** Teller off-axis som et eget triks? Minst 360 spinn og én hel flip. */
export function countsAsOffAxis(spin: number, flip: number): boolean {
  return countHalves(spin) >= 2 && countFlips(flip) >= 1;
}

/** Lager navnet på trikset ut fra hvor mye du roterte (rad). Off-axis: «Cork 720», «Dobbel rodeo 1080». */
export function trickName(spin: number, flip: number, grab: GrabKind = 0, offAxis = false): string {
  const parts: string[] = [];
  const halves = countHalves(spin);
  if (offAxis && countsAsOffAxis(spin, flip)) {
    const flips = countFlips(flip);
    const word = flips < FLIP_WORDS.length ? FLIP_WORDS[flips] : `${flips}x `;
    const full = `${word}${flip > 0 ? 'cork' : 'rodeo'} ${halves * 180}`;
    parts.push(full.charAt(0).toUpperCase() + full.slice(1));
    if (grab) parts.push(grabName(grab));
    return parts.join(' + ');
  }
  if (halves > 0) parts.push(String(halves * 180));
  const flips = countFlips(flip);
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
  const spinErrDeg = extras.stance?.spinErrDeg ?? offBy(spin + (extras.spinOffset ?? 0), HALF);
  const flipErrDeg = extras.stance?.flipErrDeg ?? offBy(flip, TURN);
  const extra = CONFIG.landSloppyExtra;
  let quality: LandingQuality = 'fall';
  if (spinErrDeg <= CONFIG.landSpinClean && flipErrDeg <= CONFIG.landFlipClean) quality = 'ren';
  else if (spinErrDeg <= CONFIG.landSpinClean + extra && flipErrDeg <= CONFIG.landFlipClean + extra) quality = 'slurvete';
  const grab = extras.grab ?? 0;
  // lander du mens du fortsatt holder en grab som teller, blir landingen slurvete (du rakk ikke å slippe)
  const landedGrabbing = !!extras.stillGrabbing && grab !== 0 && quality !== 'fall';
  if (landedGrabbing) quality = 'slurvete';
  return {
    quality, name: trickName(spin, flip, grab, !!extras.offAxis), spinDeg: spin / DEG, flipDeg: flip / DEG, spinErrDeg, flipErrDeg,
    grab, grabTime: extras.grabTime ?? 0, perfectPop: !!extras.perfectPop, fromSwitch: !!extras.fromSwitch,
    airTime: extras.airTime ?? 0, landedGrabbing, offAxis: !!extras.offAxis && countsAsOffAxis(spin, flip),
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

/** Tallene for landingshjelpen på én akse (spinn eller flip). Leses fra CONFIG hver gang, så tester kan endre dem. */
interface AssistAxis {
  ahead: () => number; maxDeg: () => number; accelDeg: () => number; playerDeg: () => number; coastDeg: () => number;
}
const SPIN_AXIS: AssistAxis = {
  ahead: () => CONFIG.landAssistSpinAheadDeg, maxDeg: () => CONFIG.landAssistSpinMaxDeg, accelDeg: () => CONFIG.landAssistSpinAccelDeg,
  playerDeg: () => CONFIG.spinSpeedDeg, coastDeg: () => CONFIG.spinCoastDeg,
};
const FLIP_AXIS: AssistAxis = {
  ahead: () => CONFIG.landAssistFlipAheadDeg, maxDeg: () => CONFIG.landAssistFlipMaxDeg, accelDeg: () => CONFIG.landAssistFlipAccelDeg,
  playerDeg: () => CONFIG.flipSpeedDeg, coastDeg: () => CONFIG.flipCoastDeg,
};

/**
 * Hvilken ren stilling hjelpen sikter mot (rad), eller null hvis du er for langt unna til å få hjelp.
 * Ser på hvor rotasjonen ville stoppet av seg selv (med glidet), i retningen du roterer:
 * mangler den opptil «ahead» grader til neste rene stilling, er målet den. Er den opptil landAssistBackDeg forbi
 * en ren stilling, er målet den du er forbi (tilbake). Aldri mer enn én stilling fram, så den legger aldri til rotasjoner.
 */
export function assistTarget(pos: number, rate: number, origin: number, jumpStart: number, step: number, aheadDeg: number, coastDeg: number, playerDeg: number): number | null {
  const stop = pos + (Math.sign(rate) * rate * rate) / (2 * stopDecel(playerDeg * DEG, coastDeg));
  // retningen du roterer; står rotasjonen stille, retningen du har rotert i dette hoppet
  const dir = Math.abs(rate) > 1e-9 ? Math.sign(rate) : Math.sign(pos - jumpStart);
  if (dir === 0) return null;
  const a = dir * (stop - origin);
  const lower = Math.floor(a / step) * step;
  if (a - lower <= CONFIG.landAssistBackDeg * DEG) return origin + dir * lower;
  if (lower + step - a <= aheadDeg * DEG) return origin + dir * (lower + step);
  return null;
}

/**
 * Landingshjelp for én akse: ny rotasjonsfart (rad/s), eller null når hjelpen ikke gjelder (da virker alt som før).
 * Farten går mot målet med begrenset fart (landAssist...MaxDeg, aldri raskere enn spilleren kan selv),
 * bygger seg opp mykt (landAssist...AccelDeg) og bremser som glidet når du slipper, så det aldri blir et hopp i farten.
 * Jo mindre tid det er igjen til landing, jo nærmere største fart går den.
 */
function assistRate(pos: number, rate: number, origin: number, jumpStart: number, step: number, ax: AssistAxis, toLand: number | undefined, dt: number): number | null {
  const target = assistTarget(pos, rate, origin, jumpStart, step, ax.ahead(), ax.coastDeg(), ax.playerDeg());
  if (target === null) return null;
  const rem = target - pos;
  const dist = Math.abs(rem);
  const maxRate = Math.min(ax.maxDeg(), ax.playerDeg()) * DEG;
  const accel = ax.accelDeg() * DEG;
  // fart som trengs for å være framme litt før landing, mellom minst-andelen og største fart
  const left = Math.max(0.05, (toLand ?? Infinity) - CONFIG.landAssistMargin);
  const cap = Math.max(maxRate * CONFIG.landAssistMinShare, Math.min(maxRate, dist / left));
  // nær målet: bremser mykt inn (rekker å stoppe med accel), og de siste gradene glir den inn
  const want = Math.sign(rem) * Math.min(cap, Math.sqrt(2 * accel * dist), CONFIG.landAssistSettle * dist);
  // senke farten (bremse) går like fort som glidet når du slipper; øke farten går saktere
  const braking = rate !== 0 && Math.sign(want - rate) === -Math.sign(rate);
  const lim = (braking ? Math.max(accel, stopDecel(ax.playerDeg() * DEG, ax.coastDeg())) : accel) * dt;
  return rate + Math.max(-lim, Math.min(lim, want - rate));
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
    t.airTime = 0;
    t.offAxis = false;
    resetGrabJump(t.grabs);
  }

  if (t.inAir && inp.grounded) {
    // landing: sjekk hvor nær du er, og velg nærmeste stilling å rette seg opp mot
    t.inAir = false;
    const ds = t.spin - t.spinStart;
    const df = t.flip - t.flipStart;
    const g = countedGrab(t.grabs);
    // vanligvis 0; etter en boardslide startet hoppet med kroppen en kvart runde på tvers
    const base = Math.round(t.spinStart / HALF) * HALF;
    const off = Math.abs(t.spinStart - base) > 1e-6 ? t.spinStart - base : 0;
    // står kroppen (helt eller litt) off-axis, vurderes landingen ut fra hvor den faktisk står
    let stance: JumpExtras['stance'];
    let landedSpin = ds;
    if (t.offAxisBlend > 0) {
      const st = bodyStance(bodyQuat(t.spin, t.flip, t.offAxisBlend, t.offAxisSide));
      stance = { spinErrDeg: offBy(st.heading, HALF), flipErrDeg: st.tiltDeg };
      // retningen kroppen peker, nærmest spinnet du har gjort
      const wrap = st.heading - t.spin - Math.round((st.heading - t.spin) / TURN) * TURN;
      landedSpin = t.spin + wrap - t.spinStart;
    }
    t.lastLanding = judgeLanding(ds, df, {
      grab: g, grabTime: g ? t.grabs.bestTime : 0, perfectPop: t.jumpPerfectPop, fromSwitch: t.jumpFromSwitch,
      airTime: t.airTime, stillGrabbing: t.grabs.held !== 0, spinOffset: off, offAxis: t.offAxis, stance,
    });
    t.landingAge = 0;
    t.justLanded = true;
    // spinn: nærmeste halve runde (en halv runde = du kjører baklengs, switch). Flip: nærmeste hele runde.
    t.spinTarget = off === 0 ? t.spinStart + Math.round(landedSpin / HALF) * HALF : base + Math.round((landedSpin + off) / HALF) * HALF;
    t.turnOut = false;
    t.flipTarget = t.flipStart + Math.round(df / TURN) * TURN;
  }

  // grab: teller bare i lufta; på bakken slipper kroppen mykt
  stepGrabs(t.grabs, inp.grab ?? 0, t.inAir, dt);

  // avsats-vinduet: spinn og flip begge trykket like etter avsatsen gir off-axis resten av hoppet
  const min = CONFIG.offAxisMinInput;
  if (t.inAir && !t.offAxis && t.airTime <= CONFIG.offAxisWindow && Math.abs(inp.spin) >= min && Math.abs(inp.flip) >= min) {
    t.offAxis = true;
    t.offAxisSide = Math.sign(inp.spin) * Math.sign(inp.flip);
  }
  // stillingen glir mykt inn i off-axis i lufta, og tilbake til vanlig når du ikke er det lenger
  if (t.inAir && t.offAxis) t.offAxisBlend = Math.min(1, t.offAxisBlend + dt / CONFIG.offAxisBlendIn);
  else t.offAxisBlend = Math.max(0, t.offAxisBlend - dt / CONFIG.offAxisBlendOut);

  if (t.inAir) {
    t.airTime += dt;
    if (inp.spin !== 0) t.turnOut = false;
    // landingshjelp bare på en akse der tasten ikke holdes, så den aldri kjemper imot
    const flipHelp = inp.assist && inp.flip === 0 ? assistRate(t.flip, t.flipRate, t.flipStart, t.flipStart, TURN, FLIP_AXIS, inp.toLand, dt) : null;
    t.flipRate = flipHelp ?? approach(t.flipRate, inp.flip, CONFIG.flipSpeedDeg * DEG, CONFIG.flipBuild, CONFIG.flipCoastDeg, dt);
    if (t.turnOut) {
      // ut av en boardslide uten å spinne selv: kroppen vris mykt tilbake langs fallinja
      [t.spin, t.spinRate] = settle(t.spin, t.spinRate, turnOutTarget(t.spin), CONFIG.railTurnOut, dt);
    } else {
      // rene stillinger for spinn er hele og halve runder (switch er greit)
      const spinHelp = inp.assist && inp.spin === 0 ? assistRate(t.spin, t.spinRate, 0, t.spinStart, HALF, SPIN_AXIS, inp.toLand, dt) : null;
      t.spinRate = spinHelp ?? approach(t.spinRate, inp.spin, CONFIG.spinSpeedDeg * DEG, CONFIG.spinBuild, CONFIG.spinCoastDeg, dt);
      t.spin += t.spinRate * dt;
    }
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

/** Nærmeste stilling langs fallinja (hel eller halv runde). Står du midt imellom, velges forlengs. */
function turnOutTarget(spin: number): number {
  const a = Math.floor(spin / HALF) * HALF, b = a + HALF;
  const da = spin - a, db = b - spin;
  if (Math.abs(da - db) < 20 * DEG) return Math.cos(a) > 0 ? a : b;
  return da < db ? a : b;
}

/**
 * Skiene vris for å peke langs railen. Kroppen skal stå stille i verden, så spinnet vris like mye
 * motsatt vei (kroppens retning er heading − spinn). Da snur ikke kroppen seg brått.
 */
export function shiftSpin(t: TrickState, headingShift: number): void {
  t.spin += headingShift; t.spinStart += headingShift; t.spinTarget += headingShift;
}

/** Hvordan du landet på en rail. */
export interface RailLanding {
  quality: LandingQuality;
  /** På tvers (boardslide) eller langs (50-50)? */
  across: boolean;
  /** Hvor skjevt (grader), med fortegn: hvilken side du lener mot. */
  errDeg: number;
}

/**
 * Lander på en rail (eller kjører opp på den). Kroppen kan stå langs railen (50-50, forlengs eller baklengs)
 * eller på tvers (boardslide). Kroppen retter seg mykt inn mot nærmeste kvarte runde.
 * Gir ikke poeng for hoppet opp; railen gir poeng når du er ferdig med den.
 */
export function landOnRail(t: TrickState): RailLanding {
  const QUARTER = HALF / 2;
  const q = Math.round(t.spin / QUARTER);
  const errDeg = (t.spin - q * QUARTER) / DEG;
  const flipErr = offBy(t.flip - t.flipStart, TURN);
  let quality: LandingQuality = 'ren';
  if (Math.abs(errDeg) >= CONFIG.railLandFall || flipErr > CONFIG.landFlipClean + CONFIG.landSloppyExtra) quality = 'fall';
  else if (Math.abs(errDeg) > CONFIG.railLandClean || flipErr > CONFIG.landFlipClean) quality = 'slurvete';
  if (quality !== 'fall') {
    t.inAir = false;
    t.landingAge = 0;
    t.turnOut = false;
    t.spinTarget = q * QUARTER;
    t.flipTarget = t.flipStart + Math.round((t.flip - t.flipStart) / TURN) * TURN;
  }
  return { quality, across: Math.abs(q) % 2 === 1, errDeg };
}
