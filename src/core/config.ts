// Alle måltall samles her. Se docs/DESIGN.md for hva de betyr.
export const CONFIG = {
  /** Fast fysikksteg (Hz). Fysikken er deterministisk med dette steget. */
  physicsHz: 240,
  gravity: 9.81,
  /** Bakkens grunnhelning i grader. */
  slopeDeg: 18,
  /** Toppfart i m/s (≈ 90 km/t). */
  maxSpeed: 25,
  /** Forsterker farten ned bakken, så 0–60 km/t tar 3–4 s. */
  slopeAccel: 1.75,
  /** Luftmotstand og snøfriksjon. dragCoef er satt så farten flater ut like under toppfarten. */
  dragCoef: 0.0085,
  snowFriction: 0.03,
  /** Hvor hardt bremsen tar i (m/s²) ved full brems. */
  brakeDecel: 11,
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
  /** Kamera: fast avstand bak (m) og høyde over snøen (m). */
  camDistance: 5.5,
  camHeight: 2.0,
  camFovBase: 62,
  camFovMax: 78,
  /** Hvor fort kameraet svinger etter skiløperen (per sekund). Lavere = mykere, men henger mer etter. */
  camYawFollow: 4,
  /** Hvor fort kamerahøyden følger kuler i bakken (per sekund). */
  camHeightFollow: 6,
  /** Hvor fort synsfeltet følger farten (per sekund). */
  camFovFollow: 3,
  /** Kameraet ser på et punkt så langt foran (m) og så høyt over skiene (m). */
  camLookAhead: 3,
  camLookHeight: 0.8,
  /** Under denne farten (m/s) følger kameraet skiene i stedet for fartsretningen. */
  camDirMinSpeed: 2,
  /** Kameraet holder alltid minst så mye avstand til snøen (m). */
  camMinClearance: 0.6,
  /** Hopper skiløperen lenger enn dette på ett bilde (restart), flytter kameraet seg rett dit. */
  camSnapDistance: 20,
} as const;

export type Config = typeof CONFIG;
