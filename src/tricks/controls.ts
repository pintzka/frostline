import type { SkierInput } from '../physics/skier';

/**
 * Fordeler tastene mellom kjøring og triks. Ren logikk uten three.js.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila.
 *
 * På bakken: venstre/høyre styrer, S/pil ned bremser.
 * I lufta: venstre/høyre spinner, W/pil opp er frontflip, S/pil ned er backflip.
 * Holder du fortsatt tasten når du lander, teller den ikke som styring eller brems før du slipper den.
 * Ellers ville du svinge eller bremse brått rett etter et spinn eller en backflip.
 */
export interface RawControls {
  steer: number;
  brake: number;
  /** 1 = W/pil opp, -1 = S/pil ned */
  flip: number;
  pop?: boolean;
}

export interface ControlLatch {
  /** Sant når styre- eller bremsetasten ble holdt i lufta og ikke er sluppet ennå. */
  steerHeld: boolean;
  brakeHeld: boolean;
}

export function createLatch(): ControlLatch {
  return { steerHeld: false, brakeHeld: false };
}

export function splitControls(raw: RawControls, grounded: boolean, latch: ControlLatch): { skier: SkierInput; spin: number; flip: number } {
  if (!grounded) {
    latch.steerHeld = raw.steer !== 0;
    latch.brakeHeld = raw.brake > 0;
    return { skier: { steer: 0, brake: 0, pop: raw.pop }, spin: raw.steer, flip: raw.flip };
  }
  if (raw.steer === 0) latch.steerHeld = false;
  if (raw.brake === 0) latch.brakeHeld = false;
  return {
    skier: { steer: latch.steerHeld ? 0 : raw.steer, brake: latch.brakeHeld ? 0 : raw.brake, pop: raw.pop },
    spin: 0,
    flip: 0,
  };
}
