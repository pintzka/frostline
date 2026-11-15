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
  /**
   * Snøsprut. Mengder er partikler per sekund (sprut) eller per hendelse (puff).
   * Alt i en fast buffer på sprayMax partikler; er den full, venter ny sprut til gamle forsvinner.
   */
  sprayMax: 800,
  /** Carving: partikler/s ved full kant i full fart. Fra sprayMinSpeed til sprayFullSpeed (m/s) øker sprut mykt. */
  sprayCarveRate: 240,
  sprayMinSpeed: 3,
  sprayFullSpeed: 20,
  /** Brems: partikler/s ved full brems i full fart (mest av alt), og hvor fort bremsesprut kommer og går (per sekund). */
  sprayBrakeRate: 520,
  sprayBrakeFullSpeed: 12,
  sprayBrakeResponse: 6,
  /** Landing: hvor kraftig puffen kastes ut: grunn + per m/s slag, men høyst maks. */
  sprayLandStrength: { base: 0.4, perImpact: 1 / 6, max: 1.5 },
  /** Landing: partikler per m/s du treffer bakken med, pluss litt per m/s fart, og høyst så mange. */
  sprayLandPerImpact: 45,
  sprayLandPerSpeed: 3,
  sprayLandMax: 200,
  /** Korte hopp over småkuler gir ingen puff: lufttid under dette (s) eller slag under dette (m/s) teller ikke. */
  sprayLandMinAir: 0.15,
  sprayLandMinImpact: 0.8,
  /** Pop: så mange partikler i fokket fra avsparket, og så mange ganger mer ved perfekt pop. */
  sprayPopCount: 40,
  sprayPopPerfect: 1.5,
  /** Lett snø: egen tyngdekraft (m/s²) og luftbrems (per sekund). Faller da høyst ca. 2,4 m/s. */
  sprayGravity: 6,
  sprayDrag: 2.5,
  /** Hvor mye av skiløperens fart snøen tar med seg (0–1). Resten blir liggende igjen bak. */
  sprayInherit: 0.55,
  /** Hvor sterk sprutene er (0–1) når de er tettest. */
  sprayOpacity: 0.6,
  /** Hvor stor del av levetiden spruten bruker på å tones inn, og hvor i levetiden den begynner å blekne (0–1). */
  sprayFadeIn: 0.15,
  sprayFadeOut: 0.3,
  /** Snø som har landet glir ut og stopper med denne bremsen (per sekund). */
  spraySettleDrag: 8,
  /** Ny sprut starter så høyt over snøen (m). */
  spraySpawnLift: 0.05,
  /** Snø som ligger på bakken løftes så mange ganger sin egen størrelse, så bakken ikke kutter den med en skarp strek. */
  sprayGroundLift: 0.3,
  /** Sprut nærmere kameraet enn [fra, til] (m) tones bort, så den ikke dekker hele skjermen. */
  sprayNearFade: [0.8, 1.5],
  /** Største størrelse på skjermen (CSS-piksler, likt på vanlig skjerm, retina og mobil). */
  sprayMaxPx: 220,
  /** Fargen på snøen der lyset treffer, og i skyggen. */
  sprayColorLight: 0xf4f8ff,
  sprayColorShade: 0x9fb6d2,
  /**
   * Hvordan hver type sprut ser ut: levetid (s, fra–til), størrelse når den kommer (m, fra–til),
   * hvor mange ganger større den blir før den er borte, og hvor fort den kastes ut (m/s).
   */
  sprayLooks: {
    carve: { life: [0.5, 1.0], size: [0.10, 0.24], grow: 2.4, throw: 3.5 },
    brake: { life: [0.7, 1.4], size: [0.16, 0.36], grow: 2.8, throw: 2.8 },
    land: { life: [0.8, 1.5], size: [0.20, 0.40], grow: 2.4, throw: 3.2 },
    pop: { life: [0.4, 0.8], size: [0.10, 0.22], grow: 2.4, throw: 1.6 },
  },
  /**
   * Hvor spruten starter og hvor den kastes. along: langs skiene (andel av halve skilengden, minus = bak).
   * side: ut fra skiene (m). up: fart oppover (m/s). throwMul: ganges med throw. jitter: litt tilfeldig fart (m/s).
   */
  spraySpread: {
    carve: { along: [-0.7, 0.2], side: [0.1, 0.25], up: [0.8, 3.0], throwMul: [0.6, 1.2], slowThrow: 0.4, back: 1.2, jitter: 0.8 },
    brake: { along: [-0.8, 0.6], side: [0, 0.15], up: [0.8, 2.6], throwMul: [0.4, 1.2], forward: [0.5, 2.0], extraInherit: 0.2 },
    land: { radius: [0.2, 0.8], up: [0.5, 2.5], throwMul: [0.4, 1.2] },
    pop: { along: [0.4, 1.0], side: 0.3, up: [0.3, 1.3], throwMul: [0.5, 1.3], jitter: 1 },
  },
} as const;

export type Config = typeof CONFIG;
