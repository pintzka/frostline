import { CONFIG } from '../core/config';

/**
 * Ren input-logikk uten DOM og three.js, så den kan testes.
 * Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Gjør et rått utslag (-1..1) om til styring:
 * - innenfor dødsonen blir det 0
 * - utenfor glir det jevnt fra 0 (ikke noe hopp ved kanten av dødsonen)
 * - fullt utslag allerede ved `outer`
 * - kurven (> 1) gjør små utslag mindre, så du får fin kontroll i slake svinger
 */
export function shapeAxis(raw: number, deadzone: number, outer: number, curve: number): number {
  if (!Number.isFinite(raw)) return 0;
  const t = clamp01((Math.abs(raw) - deadzone) / Math.max(1e-6, outer - deadzone));
  if (t === 0) return 0; // ikke -0
  return Math.sign(raw) * Math.pow(t, curve);
}

/** Trigger (0..1): dødsone nederst, så rett fram opp til 1. */
export function shapeTrigger(raw: number, deadzone = CONFIG.triggerDeadzone): number {
  if (!Number.isFinite(raw)) return 0;
  return clamp01((raw - deadzone) / Math.max(1e-6, 1 - deadzone));
}

/** Knappene i "standard"-oppsettet til Gamepad API (Xbox-navn). */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

/** Det vi trenger fra en knapp. Samme form som GamepadButton, men uten DOM. */
export interface PadButton { pressed: boolean; value: number }

export interface PadInput {
  steer: number;
  brake: number;
  pop: boolean;
  restart: boolean;
  pause: boolean;
}

/**
 * Venstre stikke → styring. Dødsonen måles rundt hele stikka (ikke bare sidelengs), og
 * retningen teller for seg: er stikka minst `padSideFull` sidelengs, svinger du fullt.
 * Da gir en skrå stikke like hard sving som en rett til siden, og rett opp gir ingen sving.
 */
export function stickSteer(x: number, y: number): number {
  if (!Number.isFinite(x)) return 0;
  if (!Number.isFinite(y)) y = 0;
  const m = Math.hypot(x, y);
  const amount = shapeAxis(m, CONFIG.padDeadzone, CONFIG.padOuterEdge, CONFIG.padCurve);
  if (amount === 0) return 0;
  const side = Math.min(1, Math.abs(x) / m / CONFIG.padSideFull);
  return Math.sign(x) * amount * side;
}

/**
 * Leser én gamepad (stikker og knapper som vanlige lister).
 * Knappenumrene stemmer bare når `standard` er sann (gp.mapping === 'standard'). Ellers kan
 * f.eks. "brems" ligge på en knapp som alltid står på, så da brukes bare stikka.
 */
export function readPad(axes: readonly number[], buttons: readonly (PadButton | undefined)[], standard = true): PadInput {
  if (!standard) buttons = [];
  const down = (i: number) => buttons[i]?.pressed === true;
  const value = (i: number) => buttons[i]?.value ?? 0;
  const stick = stickSteer(axes[0] ?? 0, axes[1] ?? 0);
  // piltastene på padden virker som tastaturet: helt av eller helt på
  const dpad = (down(PAD.RIGHT) ? 1 : 0) - (down(PAD.LEFT) ? 1 : 0);
  return {
    steer: Math.abs(dpad) > Math.abs(stick) ? dpad : stick,
    brake: Math.max(shapeTrigger(value(PAD.LT)), down(PAD.B) ? 1 : 0),
    pop: down(PAD.A),
    restart: down(PAD.Y) || down(PAD.BACK),
    pause: down(PAD.START),
  };
}

/** Triks-knappene på padden: flip (1 = frontflip, -1 = backflip) og grab (0 = ingen, 1–3 som J/K/L). */
export interface PadTricks { flip: number; grab: 0 | 1 | 2 | 3 }

/**
 * Leser flip og grab fra én gamepad. Flip: stikka opp/ned forbi padFlipThreshold (opp = frontflip,
 * som W) eller piltastene opp/ned. Grab: X = Nordlys (J), RB = Isbit (K), LB = Snøugle (L).
 * Uten standard-oppsett brukes bare stikka, som i readPad.
 */
export function readPadTricks(axes: readonly number[], buttons: readonly (PadButton | undefined)[], standard = true): PadTricks {
  if (!standard) buttons = [];
  const down = (i: number) => buttons[i]?.pressed === true;
  const y = Number.isFinite(axes[1]) ? axes[1] : 0;
  // stikka gir minus når den skyves opp
  const stick = y <= -CONFIG.padFlipThreshold ? 1 : y >= CONFIG.padFlipThreshold ? -1 : 0;
  const dpad = (down(PAD.UP) ? 1 : 0) - (down(PAD.DOWN) ? 1 : 0);
  const grab = down(PAD.X) ? 1 : down(PAD.RB) ? 2 : down(PAD.LB) ? 3 : 0;
  return { flip: dpad || stick, grab };
}

/**
 * Slår sammen styring fra flere kilder. Størst utslag vinner.
 * Den som vant sist (`prev`), beholder styringen til en annen er minst `margin` større,
 * så to kilder som er nesten like ikke bytter fram og tilbake hvert bilde.
 * Gir tilbake verdien og hvilken kilde som vant (-1 hvis alle er 0).
 */
export function mergeSteer(values: readonly number[], prev: number, margin = CONFIG.inputMergeMargin): { value: number; source: number } {
  let best = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== 0 && (best < 0 || Math.abs(values[i]) > Math.abs(values[best]))) best = i;
  }
  if (best < 0) return { value: 0, source: -1 };
  const p = values[prev];
  if (prev >= 0 && prev < values.length && p !== 0 && Math.abs(p) >= Math.abs(values[best]) - margin) {
    return { value: p, source: prev };
  }
  return { value: values[best], source: best };
}

/**
 * Tommel-styring på mobil. Styringen måles fra der tommelen ble satt ned (`anchor`),
 * så det aldri rykker når du setter fingeren ned. Drar du lenger enn `radius`, flytter
 * midtpunktet seg etter, så du kan snu retning med en gang uten å dra hele veien tilbake.
 */
export function touchSteer(anchor: number, x: number, radius = CONFIG.touchSteerRadius): { steer: number; anchor: number } {
  if (x - anchor > radius) anchor = x - radius;
  else if (anchor - x > radius) anchor = x + radius;
  const raw = (x - anchor) / radius;
  return { steer: shapeAxis(raw, CONFIG.touchDeadzone, 1, CONFIG.touchCurve), anchor };
}

/** Er berøringen på venstre side av skjermen, der tommelen styrer? */
export function isSteerZone(x: number, width: number): boolean {
  return x < width / 2;
}

/**
 * Gjør "knappen er nede" om til "knappen ble trykket nå": gir true bare i det første
 * øyeblikket knappen går ned, ikke hele tiden mens den holdes.
 */
export function createEdge() {
  let wasDown = false;
  return (down: boolean): boolean => {
    const pressed = down && !wasDown;
    wasDown = down;
    return pressed;
  };
}

/**
 * Husker tastetrykk mellom to avlesninger. Trykker du og slipper før spillet rekker å lese
 * input (et veldig raskt tapp), regnes tasten likevel som nede i én avlesning. Da gir et
 * raskt tapp på mellomrom en kort pop i stedet for ingenting.
 * Bruk: down/up fra hendelsene, isDown når input leses, endRead etter hver avlesning.
 */
export function createKeyLatch() {
  const held = new Set<string>();
  const tapped = new Set<string>();
  return {
    down(code: string) { held.add(code); tapped.add(code); },
    up(code: string) { held.delete(code); },
    isDown(code: string) { return held.has(code) || tapped.has(code); },
    /** Antall taster/fingre som er nede nå (eller ble tappet siden sist). */
    count() { return new Set([...held, ...tapped]).size; },
    endRead() { tapped.clear(); },
    clear() { held.clear(); tapped.clear(); },
  };
}

/** Brukes gamepaden tydelig (ikke bare litt drift i stikka)? Da bytter hjelpeteksten til gamepad. */
export function padInUse(p: PadInput): boolean {
  return Math.abs(p.steer) >= CONFIG.padActiveSteer || p.brake >= CONFIG.padActiveBrake || p.pop || p.restart || p.pause;
}

/**
 * Holder styr på fingrene på venstre side. Den første styrer. Løfter du den mens en annen
 * finger ligger på venstre side, tar den andre over, med nytt midtpunkt der den er, så det
 * ikke hopper.
 */
export function createSteerTouches(radius = CONFIG.touchSteerRadius) {
  const fingers = new Map<number, { x: number; y: number }>(); // alle fingre som startet på venstre side
  let id = -1, anchor = 0, value = 0;
  const take = (newId: number) => {
    const f = fingers.get(newId)!;
    id = newId;
    anchor = f.x;
    value = 0;
  };
  return {
    /** Gir true hvis fingeren ble en styrefinger (eller venter på å bli det). */
    down(pid: number, x: number, y: number, width: number): boolean {
      if (!isSteerZone(x, width)) return false;
      fingers.set(pid, { x, y });
      if (id < 0) take(pid);
      return true;
    },
    move(pid: number, x: number, y: number) {
      const f = fingers.get(pid);
      if (!f) return;
      f.x = x; f.y = y;
      if (pid !== id) return;
      const r = touchSteer(anchor, x, radius);
      anchor = r.anchor;
      value = r.steer;
    },
    up(pid: number) {
      if (!fingers.delete(pid) || pid !== id) return;
      id = -1;
      value = 0;
      const next = fingers.keys().next();
      if (!next.done) take(next.value);
    },
    clear() { fingers.clear(); id = -1; value = 0; },
    value() { return value; },
    /** Hvor ringen og prikken skal tegnes, eller null hvis ingen styrer. */
    view() {
      if (id < 0) return null;
      const f = fingers.get(id)!;
      return { anchorX: anchor, y: f.y, x: f.x, radius };
    },
  };
}
