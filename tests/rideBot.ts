import { CONFIG } from '../src/core/config';
import { PARK } from '../src/park/terrain';
import { flipCoast, spinCoast } from '../src/tricks/rotation';
import { createGame, stepGame, type FlowEvent, type Game, type GameInput } from '../src/ui/flow';

/**
 * En «robot» som kjører hele bakken med ekte fysikk og triks gjennom ui/flow.ts.
 * Brukes i testene for utfordringer. Ikke en test i seg selv.
 */
const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;

/** Hva roboten gjør over ett hopp. */
export interface JumpPlan {
  /** Spinn i grader (positiv = høyre). */
  spin?: number;
  /** Flip i grader (positiv = frontflip, negativ = backflip). */
  flip?: number;
  /** Hold grab (J) så mange sekunder. */
  grab?: number;
  /** Slipp pop akkurat på kanten. */
  perfect?: boolean;
}

/** Kjører en hel runde. plans[i] gjelder hopp nr. i. onStep kalles etter hvert steg. */
export function rideRun(plans: (JumpPlan | null)[], onStep: (g: Game, ev: FlowEvent) => void = () => {}, g: Game = createGame()): Game {
  const idle: GameInput = { raw: { steer: 0, brake: 0, flip: 0, pop: false }, click: false, restart: false };
  onStep(g, stepGame(g, { ...idle, click: g.flow.phase !== 'kjorer' }, dt));
  let jump = -1;
  let landedJump = -1;
  for (let i = 0; i < 120 * CONFIG.physicsHz && g.flow.phase === 'kjorer'; i++) {
    const s = g.skier, t = g.tricks;
    const nextIdx = PARK.kickers.findIndex((k) => k.z - s.z > -1 && k.z - s.z < 25);
    if (s.grounded && nextIdx >= 0) jump = nextIdx;
    const plan = jump >= 0 && landedJump !== jump ? plans[jump] : null;
    const raw = { steer: 0, brake: 0, flip: 0, pop: false, grab: 0 as 0 | 1 };
    if (plan && s.grounded && plan.perfect && nextIdx >= 0) {
      const d = PARK.kickers[nextIdx].z - s.z;
      // hold pop inne på vei mot kanten, slipp rett før kanten
      raw.pop = d > Math.max(1, s.vz) * CONFIG.popPerfectWindow * 0.5;
    }
    if (plan && !s.grounded) {
      const spinLeft = (plan.spin ?? 0) * DEG - (t.spin - t.spinStart + spinCoast(t.spinRate));
      const flipLeft = (plan.flip ?? 0) * DEG - (t.flip - t.flipStart + flipCoast(t.flipRate));
      raw.steer = Math.abs(spinLeft) > 0.02 ? Math.sign(spinLeft) : 0;
      raw.flip = Math.abs(flipLeft) > 0.02 ? Math.sign(flipLeft) : 0;
      if (plan.grab && t.grabs.holdTime < plan.grab + 0.02 && t.grabs.bestTime < plan.grab) raw.grab = 1;
    }
    const wasAir = !s.grounded;
    const ev = stepGame(g, { ...idle, raw }, dt);
    if (wasAir && g.skier.grounded && jump >= 0) landedJump = jump;
    onStep(g, ev);
  }
  return g;
}
