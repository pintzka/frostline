import { CONFIG } from '../core/config';
import type { SkierInput } from '../physics/skier';
import type { GrabKind } from './grabs';

/**
 * Fordeler tastene mellom kjøring og triks. Ren logikk uten three.js.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila.
 *
 * På bakken: venstre/høyre styrer, S/pil ned bremser.
 * I lufta: venstre/høyre spinner, W/pil opp er frontflip, S/pil ned er backflip, J/K/L er grabs.
 *
 * To sperrer, så du ikke får triks eller svinger du ikke mente:
 * - Holder du en tast når du letter (f.eks. carving over kanten), starter den ikke spinn eller flip.
 *   Triks starter bare på et nytt trykk i lufta (slipp, eller bytt retning).
 * - Holder du spinn- eller backflip-tasten når du lander, styrer eller bremser den ikke med en gang.
 *   Sperren slippes når du slipper eller bytter retning, og senest etter landKeyLock sekunder.
 */
export interface RawControls {
  steer: number;
  brake: number;
  /** 1 = W/pil opp, -1 = S/pil ned */
  flip: number;
  pop?: boolean;
  /** Grab-tasten som holdes: 0 = ingen, 1 = J, 2 = K, 3 = L. */
  grab?: GrabKind;
}

export interface ControlLatch {
  wasGrounded: boolean;
  /** Styring og flip-tast som ble holdt forrige steg på bakken. */
  groundSteer: number;
  groundFlip: number;
  /** Tasten som ble holdt da du lettet (sperret for triks til den slippes eller byttes). 0 = ingen. */
  spinBlock: number;
  flipBlock: number;
  /** Spinn og flip som ble brukt i lufta forrige steg. */
  lastSpin: number;
  lastFlip: number;
  /** Retningen som er sperret for styring rett etter landing (0 = ingen), og om bremsen er sperret. */
  steerBlock: number;
  brakeBlock: boolean;
  /** Sekunder siden landing. */
  sinceLanding: number;
}

export function createLatch(): ControlLatch {
  return { wasGrounded: true, groundSteer: 0, groundFlip: 0, spinBlock: 0, flipBlock: 0, lastSpin: 0, lastFlip: 0, steerBlock: 0, brakeBlock: false, sinceLanding: 99 };
}

/** Nullstiller sperrene, f.eks. når runden starter på nytt. */
export function resetLatch(latch: ControlLatch): void {
  Object.assign(latch, createLatch());
}

export function splitControls(raw: RawControls, grounded: boolean, latch: ControlLatch, dt: number): { skier: SkierInput; spin: number; flip: number; grab: GrabKind } {
  if (!grounded) {
    // akkurat lettet: tastene som allerede ble holdt på bakken, teller ikke som triks
    if (latch.wasGrounded) { latch.spinBlock = latch.groundSteer; latch.flipBlock = latch.groundFlip; }
    latch.wasGrounded = false;
    if (raw.steer !== latch.spinBlock) latch.spinBlock = 0;
    if (raw.flip !== latch.flipBlock) latch.flipBlock = 0;
    const spin = latch.spinBlock !== 0 ? 0 : raw.steer;
    const flip = latch.flipBlock !== 0 ? 0 : raw.flip;
    latch.lastSpin = spin; latch.lastFlip = flip;
    return { skier: { steer: 0, brake: 0, pop: raw.pop }, spin, flip, grab: raw.grab ?? 0 };
  }

  if (!latch.wasGrounded) {
    // akkurat landet: sperr bare tastene du brukte til triks
    latch.steerBlock = latch.lastSpin;
    latch.brakeBlock = latch.lastFlip < 0;
    latch.sinceLanding = 0;
  }
  latch.wasGrounded = true;
  latch.groundSteer = raw.steer;
  latch.groundFlip = raw.flip;
  latch.sinceLanding += dt;
  const timeUp = latch.sinceLanding >= CONFIG.landKeyLock;
  if (timeUp || raw.steer !== latch.steerBlock) latch.steerBlock = 0;
  if (timeUp || raw.brake === 0) latch.brakeBlock = false;
  return {
    skier: { steer: latch.steerBlock !== 0 ? 0 : raw.steer, brake: latch.brakeBlock ? 0 : raw.brake, pop: raw.pop },
    spin: 0,
    flip: 0,
    grab: 0,
  };
}
