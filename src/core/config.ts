// Alle måltall samles her. Se docs/DESIGN.md for hva de betyr.
export const CONFIG = {
  /** Fast fysikksteg (Hz). Fysikken er deterministisk med dette steget. */
  physicsHz: 240,
  gravity: 9.81,
  /** Bakkens grunnhelning i grader. */
  slopeDeg: 18,
  /** Toppfart i m/s (≈ 90 km/t). */
  maxSpeed: 25,
  /** Luftmotstand og snøfriksjon. */
  dragCoef: 0.0045,
  snowFriction: 0.03,
  /** Hvor fort skiene svinger (rad/s) ved full styring. */
  turnRate: 1.6,
  /** Hvor mye fart som går tapt sidelengs (carving-grep), 0–1 per sekund. */
  edgeGrip: 6,
  /** Kamera */
  camDistance: 5.5,
  camHeight: 2.0,
  camFovBase: 62,
  camFovMax: 78,
} as const;

export type Config = typeof CONFIG;
