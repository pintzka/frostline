// Alle måltall samles her. Se docs/DESIGN.md for hva de betyr.
export const CONFIG = {
  /** Fast fysikksteg (Hz). Fysikken er deterministisk med dette steget. */
  physicsHz: 240,
  gravity: 9.81,
  /** Bakkens grunnhelning i grader. */
  slopeDeg: 18,
  /** Toppfart i m/s (≈ 90 km/t). */
  maxSpeed: 25,
  /** Er du over toppfarten (f.eks. etter et hopp), tas farten mykt ned med denne tidskonstanten (s). */
  overspeedFade: 0.8,
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
  /** Hvor mye kroppen kan lene seg inn i en sving (rad). 0,45 ≈ 25°. */
  maxLean: 0.45,
  /** Hvor mye skiene vipper på kanten, som andel av kroppens lening. */
  skiEdgeTilt: 0.4,
  /** Hvor fort kroppen legger seg over og reiser seg. 4 ≈ 1 sekund til full lening. Lavere = roligere. */
  leanSpeed: 4,
  /** Hvor mye skrens bremser (m/s² per m/s sidelengs fart). */
  skidFriction: 0.25,
  /** Faller bakken rett foran mer enn dette (m) bort under skiene på ett steg, letter skiløperen. */
  takeoffGap: 0.02,
  /**
   * Pop: sekunder å lade fullt, fart opp fra bakken ved full lading (m/s), og andel du får ved et kort trykk.
   * popSpeed gjelder på vanlig bakke (hopp på ca. 60 cm). På rampen til et hopp gjør rampen mesteparten
   * av jobben, så der brukes popSpeedRamp, ellers flyr du forbi landingen.
   */
  popChargeTime: 0.5,
  popSpeed: 3.4,
  popSpeedRamp: 1.0,
  popMinCharge: 0.35,
  /** Slipper du pop så kort tid (s) før kanten, er det en perfekt pop, som gir så mye ekstra. */
  popPerfectWindow: 0.12,
  popPerfectBoost: 1.25,
  /** Runden starter på nytt så mange meter før bakken tar slutt. */
  runEndMargin: 40,
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
  /** Skienes lengde (m). Sporet starter ved bakenden, halve lengden bak midten. */
  skiLength: 1.7,
  /** Skispor: avstand mellom punktene (m), hvor mange punkter som huskes, og avstand mellom skiene (m). */
  trailSpacing: 0.25,
  trailMaxPoints: 600,
  skiGap: 0.3,

  // --- Triks i lufta (src/tricks/) ---
  /** Full spinnfart (grader per sekund) når du holder venstre/høyre i lufta. 540 = et 720 på et medium hopp. */
  spinSpeedDeg: 540,
  /** Full flipfart (grader per sekund). 400 = én hel flip per 0,9 s. */
  flipSpeedDeg: 400,
  /** Hvor fort rotasjonen bygger seg opp når du holder (per sekund). 10 ≈ 0,1 s til nesten full fart. */
  spinBuild: 10,
  flipBuild: 8,
  /** Hvor fort rotasjonen bremses når du slipper (per sekund). Lavere = den fortsetter lenger. 9 ≈ 60° ekstra. */
  spinRelease: 9,
  flipRelease: 8,
  /** Ren landing: spinnet innenfor så mange grader av en hel eller halv runde, flipen innenfor så mange av stående. */
  landSpinClean: 30,
  landFlipClean: 25,
  /** Så mange grader utenfor ren regnes som slurvete. Enda mer = fall. */
  landSloppyExtra: 20,
  /** Hvor fort kroppen retter seg opp etter landing (rad/s i en myk fjær). 10 ≈ 0,4 s. */
  landSettle: 10,
  /** Skiløperen roterer rundt dette punktet (m over føttene), ca. midt på kroppen. */
  trickPivotHeight: 1.0,
  /** Sekunder triksnavnet vises etter landing. */
  trickShowTime: 1.6,

  // --- Meny og flyt (src/ui/) ---
  /** Sekunder startskjermen bruker på å blekne bort når du starter. */
  startFadeOut: 0.3,
  /** Sekunder resultatskjermen bruker på å komme fram, og på å blekne bort ved ny runde. */
  resultFadeIn: 0.35,
  resultFadeOut: 0.2,
  /** Så lenge (s) resultatet vises før mellomrom eller klikk kan starte ny runde (R virker alltid). */
  resultMinTime: 0.4,
  /** Etter målet bremser skiløperen inn med så mye ekstra (m/s²), så den stopper før bakken tar slutt. */
  finishStopDecel: 20,
  /** Ved ny runde dekker et mørkt slør skjermen så mye (0–1) og blekner bort på så mange sekunder. Skjuler hoppet til toppen. */
  restartVeil: 0.6,
  restartVeilTime: 0.3,
} as const;

export type Config = typeof CONFIG;
