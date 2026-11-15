import { CONFIG } from '../core/config';
import { springStep } from './pose';

/**
 * Hvilken vei kroppen peker opp. På bakken står skiløperen vinkelrett på snøen, høyt i lufta rett opp.
 * Mens bakken nærmer seg, tipper kroppen gradvis over mot snøen den skal lande på, så den ikke «nikker»
 * når skiene treffer. En myk fjær gjør at vinkelen aldri rykker, likt uansett bildefrekvens.
 * Ren logikk uten three.js, så den kan testes. Arbeidsstrøm 4 (Karakter og animasjon) eier denne fila.
 */
export interface TiltInput {
  grounded: boolean;
  /** hvor høyt over snøen skiene er (m) */
  heightAboveSnow: number;
  /** fart opp (m/s), negativ når skiløperen faller */
  vy: number;
  /** snøens retning opp rett under skiløperen */
  normal: readonly number[];
}

export interface TiltState {
  /** retningen opp (lengde 1) */
  up: [number, number, number];
  /** fjærens tilstand: retningen før den gjøres lengde 1, og farten */
  raw: [number, number, number];
  vel: [number, number, number];
  ready: boolean;
}

export function createTilt(): TiltState {
  return { up: [0, 1, 0], raw: [0, 1, 0], vel: [0, 0, 0], ready: false };
}

const ease = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

/** Flytter kroppens retning ett bilde fram og gir den nye retningen opp. */
export function stepTilt(t: TiltState, inp: TiltInput, dt: number): readonly number[] {
  // hvor mye kroppen skal følge snøen: helt på bakken, ingenting høyt oppe, gradvis mellom.
  // På vei opp fra et hopp står den rett opp (snøen under kanten er ikke der du skal lande);
  // først når du begynner å falle, tipper den mot snøen
  const falling = Math.min(1, Math.max(0, -inp.vy / CONFIG.bodyTiltFallSpeed));
  const k = inp.grounded ? 1 : falling * ease(1 - inp.heightAboveSnow / CONFIG.bodyTiltHeight);
  const want = [k * inp.normal[0], 1 - k + k * inp.normal[1], k * inp.normal[2]];
  for (let i = 0; i < 3; i++) {
    if (!t.ready) { t.raw[i] = want[i]; t.vel[i] = 0; continue; }
    [t.raw[i], t.vel[i]] = springStep(t.raw[i], t.vel[i], want[i], CONFIG.bodyTiltSpeed, dt);
  }
  t.ready = true;
  const len = Math.hypot(t.raw[0], t.raw[1], t.raw[2]) || 1;
  t.up[0] = t.raw[0] / len; t.up[1] = t.raw[1] / len; t.up[2] = t.raw[2] / len;
  return t.up;
}
