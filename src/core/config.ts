// Alle måltall samles her. Se docs/DESIGN.md for hva de betyr.
export const CONFIG = {
  /** Fast fysikksteg (Hz). Fysikken er deterministisk med dette steget. */
  physicsHz: 240,
  /** Hvor runden starter (m nedover bakken, midt i bakken). */
  startZ: 5,
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
  /** Hvor fort bremsen tas inn og slippes (per sekund), selv om tasten bare er av/på. 9 ≈ 0,1 s til nesten full brems. */
  brakeResponse: 9,
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
  /** Må bakken rett foran trekke deg ned mer enn så mange g (utover tyngden) for at du skal følge den, letter du i stedet. */
  takeoffPull: 1,
  /** ...men bare så nær kanten på et hopp (m), så vanlige kuler og landinger ikke gir små hopp. */
  takeoffPullZone: 2,
  /** Ved kanten ser fysikken minst så langt fram (m) etter en knekk. Litt mer enn avstanden normalAt måler over. */
  takeoffLook: 0.06,
  /**
   * Pop: sekunder å lade fullt, fart opp fra bakken ved full lading (m/s), og andel du får ved et kort trykk.
   * popSpeed gjelder på vanlig bakke (hopp på ca. 60 cm). På rampen til et hopp gjør rampen mesteparten
   * av jobben, så der brukes popSpeedRamp, ellers flyr du forbi landingen.
   */
  popChargeTime: 0.5,
  popSpeed: 3.4,
  popSpeedRamp: 1.0,
  /** Rampen regnes til så langt etter kanten (m), så en pop rett på kanten også er svak. */
  popRampAfterLip: 0.5,
  popMinCharge: 0.35,
  /** Slipper du pop så kort tid (s) før kanten, er det en perfekt pop, som gir så mye ekstra. */
  popPerfectWindow: 0.12,
  popPerfectBoost: 1.25,
  /**
   * Kanten av parken: de siste wallZone meterne før kanten bremses farten utover mykt, opp til wallDecel (m/s²)
   * helt ytterst. Bollen i terrenget (edge i parkfila) gjør mesteparten av jobben. Helt ytterst er en nødstopp.
   */
  wallZone: 10,
  wallDecel: 60,
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
  /** Kameraet holder alltid minst så mye avstand til snøen rett under seg (m). */
  camSnowClearance: 0.8,
  /** Hvor mykt kameraet går over fra «camHeight over skiløperen» til «over snøen bak» (m). Større = mykere. */
  camHeightBlend: 0.8,
  /** Hvor fort kameraet høyst kan vri seg (rad/s), så det aldri slenger rundt. 2 ≈ 115° per sekund. */
  camMaxYawRate: 2,
  /** Hopper skiløperen lenger enn dette på ett bilde (restart), flytter kameraet seg rett dit. */
  camSnapDistance: 20,
  /**
   * Kroppens vinkel: hvor fort den følger snøen (rad/s i en myk fjær), og hvor høyt over snøen (m)
   * den begynner å tippe fra loddrett over mot snøen den skal lande på. Tippingen starter først når du
   * faller, og er helt med når du faller fortere enn bodyTiltFallSpeed (m/s).
   */
  bodyTiltSpeed: 12,
  bodyTiltHeight: 3,
  bodyTiltFallSpeed: 2,
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
  /**
   * Hvor mange grader rotasjonen glir videre når du slipper i full fart. Den bremses jevnt ned,
   * så du lander der du slapp (pluss litt), godt innenfor grensen for ren landing (±30° / ±25°).
   */
  spinCoastDeg: 25,
  flipCoastDeg: 18,
  /** Ren landing: spinnet innenfor så mange grader av en hel eller halv runde, flipen innenfor så mange av stående. */
  landSpinClean: 30,
  landFlipClean: 25,
  /** Så mange grader utenfor ren regnes som slurvete. Enda mer = fall. */
  landSloppyExtra: 20,
  /** Hvor fort kroppen retter seg opp etter landing (rad/s i en myk fjær). 10 ≈ 0,4 s. */
  landSettle: 10,
  /**
   * Skiene biter i snøen ved landing: rotasjonsfarten bremses så hardt (per sekund) de første
   * landGripTime sekundene, så et perfekt 360 ikke snurrer forbi. Kroppen retter seg likevel mykt opp.
   */
  landGrip: 120,
  landGripTime: 0.1,
  /** Holder du spinn- eller backflip-tasten når du lander, styrer/bremser den ikke før etter så mange sekunder (eller du slipper). */
  landKeyLock: 0.25,
  /** Sperret styring (fra avsats eller landing) slippes når stikka flyttes mer enn dette (0–1), bytter retning eller slippes. Tåler skjelving i analog styring. */
  latchRelease: 0.25,
  /** Skiløperen roterer rundt dette punktet (m over føttene), ca. midt på kroppen. */
  trickPivotHeight: 1.0,
  /** Sekunder triksnavnet og poengene vises etter landing. */
  trickShowTime: 2.2,
  /** Et hopp som starter innen så mange sekunder etter en perfekt pop, regnes som perfekt pop. */
  popTakeoffWindow: 0.05,
  /** HUD: triksteksten kommer inn på hudFadeIn s, glir ned hudSlidePx piksler på hudSlideTime s, og blekner bort på hudFadeOut s. */
  hudFadeIn: 0.2,
  hudFadeOut: 0.5,
  hudSlideTime: 0.25,
  hudSlidePx: 10,
  /** Hvor fort totalen teller seg opp (per sekund). */
  hudCountUp: 8,

  // --- Grabs (src/tricks/grabs.ts) ---
  /** En grab må holdes minst så lenge (s) i lufta for å telle. */
  grabMinHold: 0.3,
  /** Hvor fort kroppen bøyer seg mot skiene og retter seg opp igjen (rad/s i en myk fjær). 12 ≈ 0,4 s, starter rolig. */
  grabSpring: 12,

  // --- Poeng (src/tricks/score.ts). Se tabellen i docs/DESIGN.md ---
  /** Grunnpoeng for spinn, etter antall halve runder: 0, 180, 360, 540, 720, 900, 1080, 1260, 1440, 1620. */
  spinPoints: [0, 50, 150, 400, 800, 1400, 2200, 3200, 4400, 5800],
  /** Hver halve runde over tabellen gir så mye ekstra. */
  spinPointsExtra: 1500,
  /** Ekstra poeng for flips: 0, 1, 2 og 3 hele flips. */
  flipPoints: [0, 700, 1800, 3200],
  flipPointsExtra: 1600,
  /** En grab som teller gir så mange poeng, og ganger hele trikset med grabStartMult. */
  grabPoints: 300,
  grabStartMult: 1.25,
  /** Gangetallet vokser så mye per sekund du holder grabben etter 0,3 s, opp til grabMaxMult. */
  grabMultPerSec: 0.5,
  grabMaxMult: 2,
  /**
   * Småhopp: et hopp med kortere lufttid enn dette (s) er en pop på flaten, ikke et ekte hopp.
   * En pop på flaten gir 0,7 s, det lille hoppet 1,2 s. Triks på småhopp gir bare smallJumpShare
   * av poengene og påvirker ikke komboen.
   */
  trickMinAir: 0.9,
  smallJumpShare: 0.05,
  /** Perfekt pop ganger trikset med så mye. */
  popPerfectMult: 1.2,
  /** Slurvete landing gir denne andelen, fall gir null. */
  sloppyShare: 0.5,
  /**
   * Gjentakelse: de repeatMemory siste triksene huskes. For hver gang trikset finnes der, ganges det med
   * repeatFactor (0,6 = 60 %, 36 % ...), men aldri under repeatMin. Retning og switch gjør det ikke til et nytt triks.
   */
  repeatFactor: 0.6,
  repeatMin: 0.2,
  repeatMemory: 4,
  /** Liten bonus for å hoppe baklengs (switch). */
  switchBonus: 1.1,
  /** Kombo: hvert ekte triks med ren landing øker gangetallet så mye, opp til comboMax. */
  comboStep: 0.25,
  comboMax: 4,
  /** Så mange sekunder på snøen uten nytt ekte triks før komboen nullstilles. */
  comboTimeout: 9,

  // --- Konsekvens av landingen (src/tricks/fall.ts) ---
  /** Slurvete landing: så stor del av farten mistes (0,12 = 12 %), fordelt over så mange sekunder (ikke brått). */
  sloppySpeedLoss: 0.12,
  sloppyLossTime: 0.3,
  /** Slurvete landing: kroppen vakler fra side til side, så mye (rad), så mange ganger per sekund, og dør ut så fort (s). */
  sloppyWobble: 0.3,
  sloppyWobbleHz: 2.5,
  sloppyWobbleDecay: 0.25,
  /** Vaklingen bygges opp på så lang tid (s), så den ikke starter brått, og er helt borte etter sloppyWobbleEnd (s). */
  sloppyWobbleRampIn: 0.06,
  sloppyWobbleEnd: 2,
  /** Hvor mye kroppen vakler fram og tilbake, som andel av vaklingen fra side til side. */
  sloppyWobblePitch: 0.5,
  /** Fall: sklien i snøen bremses av en del som øker med farten (per s) og en fast del (m/s²). Stopper på ca. 1 s. */
  fallSlideDrag: 2.5,
  fallSlideDecel: 4,
  /** Fall: kroppen velter over på så lang tid (s), så langt (rad, 1,35 ≈ 77°), og ligger så høyt over snøen (m). */
  fallTipTime: 0.4,
  fallRoll: 1.35,
  fallLieHeight: 0.28,
  /** Fall: så mye kroppen bøyer seg framover når den ligger (rad). */
  fallPitch: 0.35,
  /** Fall: hvor fort kanten og leningen slippes mens du sklir (per sekund). */
  fallLetGo: 8,
  /** Fall: velter mot den siden du spinner, men bare når spinnet er raskere enn dette (rad/s). Ellers mot leningen, eller høyre. */
  fallSpinSideMin: 0.5,
  /** Fall: kroppen reiser seg fra dette tidspunktet (s etter landing) og bruker så lang tid (s), ferdig før respawn. */
  fallGetUpStart: 0.65,
  fallGetUpTime: 0.4,
  /** Fall: så mange sekunder etter landingen settes du tilbake. Skjermen blekner ut og inn igjen på fallFadeTime (s). */
  fallRespawnAt: 1.1,
  fallFadeTime: 0.3,
  /**
   * Falt du på landingen til et hopp, settes du tilbake så mange meter før starten på rampen, med denne farten (m/s).
   * Hvert hopp har egne tall i park-fila ("respawnBeforeRamp", "respawnSpeed"); disse brukes når de mangler.
   * Avstanden må være minst fallRespawnBeforeMin, og farten høyst toppfarten (maxSpeed).
   */
  fallRespawnBeforeDefault: 75,
  fallRespawnSpeedDefault: 11,
  fallRespawnBeforeMin: 10,
  /** Avsatsen regnes som fra et hopp når du lettet innenfor så mange meter fra kanten. */
  fallTakeoffWindow: 3,
  /** Andre fall (f.eks. etter pop på flat bakke): tilbake så mange meter før fallstedet, med denne farten (m/s). */
  fallBackDistance: 35,
  fallBackSpeed: 10,
  /** Havner du da på et hopp (rampe, platå eller kant inn til landingen), settes du så mange meter før rampen i stedet. */
  fallRampMargin: 10,
  /** Fartsmåleren følger den ekte farten mykt (per sekund), så tallet aldri hopper. */
  hudSpeedFollow: 6,
  /** Sekunder «PERFEKT POP!» vises. */
  popFlashTime: 1.2,

  // --- Kroppens stillinger rundt et hopp (src/character/pose.ts). Lengder i m, vinkler i rad, tider i s ---
  pose: {
    /** Hvor raskt kroppen glir mellom stillingene (rad/s i en myk fjær). 22 ≈ 0,15 s. */
    speed: 22,
    /** Hvor fort leningens fortegn snus når du lander switch (per sekund). 10 ≈ 0,3 s. */
    leanSignSpeed: 10,
    /** Sats mens pop lades: så langt ned og så mye framover ved full lading. */
    crouchDrop: 0.22,
    crouchPitch: 0.3,
    /** Fjæring rett etter landing: så langt ned og framover, og hvor lenge til den er tilbake. */
    landDrop: 0.18,
    landPitch: 0.2,
    landTime: 0.35,
    /** Avsparket: starter så lenge etter at du letter, varer så lenge, og strekker kroppen så mye opp. */
    kickStart: 0.08,
    kickTime: 0.15,
    kickStretch: 0.14,
    /** Rolig stilling i lufta etter avsparket: så langt ned. */
    airDrop: 0.04,
    /** Skiene trekkes så høyt opp på så lang tid, og kroppen lener så mye framover. */
    tuckTime: 0.2,
    tuckLift: 0.3,
    tuckPitch: 0.12,
    /** Skiene går ned igjen mellom disse høydene over snøen: helt nede under den første, helt oppe over summen. */
    tuckLowHeight: 0.1,
    tuckFadeHeight: 0.7,
  },

  // --- Snøsprut (src/render/spray.ts) ---
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
  /**
   * Gamepad: stikka gjør ingenting innenfor dødsonen (så den ikke "kryper"), og gir fullt utslag
   * allerede ved padOuterEdge (stikker når sjelden helt ut). padCurve > 1 gjør små utslag ekstra
   * fine, så du kan legge inn en slak sving uten å vri hardt.
   */
  padDeadzone: 0.15,
  padOuterEdge: 0.95,
  padCurve: 1.5,
  /**
   * Skrå stikke: er stikka minst så mye sidelengs (andel av utslaget), gir den full sving.
   * 0,7 ≈ 45°, så en skrå stikke svinger like hardt som en rett til siden.
   */
  padSideFull: 0.7,
  /** Stikka må skyves så langt opp eller ned (0–1) før den gir flip i lufta. */
  padFlipThreshold: 0.6,
  /** Gamepaden regnes som "i bruk" (for hjelpeteksten) først ved så stor styring eller brems, så drift ikke teller. */
  padActiveSteer: 0.3,
  padActiveBrake: 0.5,
  /** Venstre trigger (brems) gjør ingenting under dette, så en hvilende finger ikke bremser. */
  triggerDeadzone: 0.06,
  /**
   * Mobil: dra tommelen så mange CSS-piksler sidelengs fra der du satte den ned for full sving.
   * Drar du lenger, følger midtpunktet etter, så du kan snu retning med en gang.
   */
  touchSteerRadius: 60,
  touchDeadzone: 0.06,
  touchCurve: 1.3,
  /**
   * Brukes flere styringer samtidig (tastatur, gamepad, berøring), vinner den med størst utslag.
   * Den som styrer nå, beholder styringen til en annen er så mye større, så det ikke hopper fram og tilbake.
   */
  inputMergeMargin: 0.1,

  // --- Meny og flyt (src/ui/) ---
  /** Sekunder startskjermen bruker på å blekne bort når du starter. */
  startFadeOut: 0.3,
  /** Sekunder resultatskjermen bruker på å komme fram, og på å blekne bort ved ny runde. */
  resultFadeIn: 0.35,
  resultFadeOut: 0.2,
  /** Så lenge (s) resultatet vises før mellomrom eller klikk kan starte ny runde (R virker alltid). Mellomrom må også slippes etter dette. */
  resultMinTime: 1,
  /** Etter målet bremser skiløperen inn med så mye ekstra (m/s²), så den stopper før bakken tar slutt. */
  finishStopDecel: 20,
  /** Ved ny runde dekker et mørkt slør skjermen så mye (0–1) og blekner bort på så mange sekunder. Skjuler hoppet til toppen. */
  restartVeil: 0.6,
  restartVeilTime: 0.3,
} as const;

export type Config = typeof CONFIG;
