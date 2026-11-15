import { CONFIG } from '../core/config';

/**
 * Grabs: hold en tast i lufta for å ta tak i skiene. Ren logikk uten three.js.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila.
 *
 * Tre grabs med egne navn. Grabben teller først når den er holdt i minst 0,3 s (CONFIG.grabMinHold).
 * Bytter du grab midt i lufta, starter tiden på nytt; den lengste grabben i hoppet er den som teller.
 */

/** 0 = ingen grab, 1–3 = grabbene under. */
export type GrabKind = 0 | 1 | 2 | 3;

export const GRABS = [
  { key: 'KeyJ', label: 'J', name: 'Nordlys', how: 'høyre hånd fram til skituppene' },
  { key: 'KeyK', label: 'K', name: 'Isbit', how: 'begge hender ned til midten av skiene' },
  { key: 'KeyL', label: 'L', name: 'Snøugle', how: 'venstre hånd bak til skihælene' },
] as const;

export function grabName(kind: GrabKind): string {
  return kind === 0 ? '' : GRABS[kind - 1].name;
}

export interface GrabState {
  /** Grabben du holder nå (0 = ingen). */
  held: GrabKind;
  /** Hvor lenge du har holdt den nå (s). */
  holdTime: number;
  /** Den lengste grabben i dette hoppet, og hvor lenge den ble holdt. */
  best: GrabKind;
  bestTime: number;
  /** Hvor mye kroppen er bøyd mot hver grab (0–1), og hvor fort bøyen endrer seg. Glir mykt, så figuren aldri rykker. */
  blend: [number, number, number];
  blendVel: [number, number, number];
}

export function createGrabs(): GrabState {
  return { held: 0, holdTime: 0, best: 0, bestTime: 0, blend: [0, 0, 0], blendVel: [0, 0, 0] };
}

/** Nytt hopp: glem grabbene fra forrige hopp. */
export function resetGrabJump(g: GrabState): void {
  g.held = 0; g.holdTime = 0; g.best = 0; g.bestTime = 0;
}

/** Ett steg. I lufta teller tiden; på bakken slipper du alltid (kroppen retter seg mykt opp). */
export function stepGrabs(g: GrabState, want: GrabKind, inAir: boolean, dt: number): void {
  const kind: GrabKind = inAir ? want : 0;
  if (kind !== g.held) { g.held = kind; g.holdTime = 0; }
  if (kind !== 0) {
    g.holdTime += dt;
    if (g.holdTime > g.bestTime) { g.best = kind; g.bestTime = g.holdTime; }
  }
  // myk fjær (kritisk dempet), samme som kroppen i pose.ts: starter rolig, glir på plass og skyter ikke over
  const w = CONFIG.grabSpring;
  const e = Math.exp(-w * dt);
  for (let i = 0; i < 3; i++) {
    const x0 = g.blend[i] - (kind === i + 1 ? 1 : 0), v0 = g.blendVel[i];
    g.blend[i] = (kind === i + 1 ? 1 : 0) + (x0 + (v0 + w * x0) * dt) * e;
    g.blendVel[i] = (v0 - (v0 + w * x0) * w * dt) * e;
  }
}

/** Grabben som teller i hoppet (0 hvis ingen er holdt lenge nok). */
export function countedGrab(g: GrabState): GrabKind {
  return g.bestTime >= CONFIG.grabMinHold ? g.best : 0;
}
