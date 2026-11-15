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
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LT: 6, RT: 7, BACK: 8, START: 9, LEFT: 14, RIGHT: 15 } as const;

/** Det vi trenger fra en knapp. Samme form som GamepadButton, men uten DOM. */
export interface PadButton { pressed: boolean; value: number }

export interface PadInput {
  steer: number;
  brake: number;
  pop: boolean;
  restart: boolean;
  pause: boolean;
}

/** Leser én gamepad (stikker og knapper som vanlige lister). */
export function readPad(axes: readonly number[], buttons: readonly (PadButton | undefined)[]): PadInput {
  const down = (i: number) => buttons[i]?.pressed === true;
  const value = (i: number) => buttons[i]?.value ?? 0;
  const stick = shapeAxis(axes[0] ?? 0, CONFIG.padDeadzone, CONFIG.padOuterEdge, CONFIG.padCurve);
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
