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
  /** Hvor fort skiene svinger (rad/s) ved full styring i lav fart. */
  turnRate: 1.6,
  /** Hvor hardt kanten kan presse i en sving (m/s²). Gir ca. 15 m radius i 60 km/t, større radius i høyere fart. */
  carveAccel: 18.5,
  /** Hvor fort kanten settes og slippes (per sekund). Høyere = kvikkere, lavere = mykere. */
  edgeResponse: 7,
  /** Hvor fort farten vris inn i skienes retning (per sekund). Farten beholdes. */
  edgeGrip: 6,
  /** Hvor mye skrens bremser (m/s² per m/s sidelengs fart). */
  skidFriction: 0.25,
  /** Kamera */
  camDistance: 5.5,
  camHeight: 2.0,
  camFovBase: 62,
  camFovMax: 78,
} as const;

export type Config = typeof CONFIG;
