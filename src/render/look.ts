/**
 * Tallene som bestemmer hvordan miljøet ser ut: tåke, skygger, skog, fjell og lykter.
 * Endre her, ikke rundt omkring i koden. Ren data uten three.js.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export const LOOK = {
  /** Tåke (m fra kameraet): starter ved near, helt tett ved far. */
  fog: { near: 60, far: 280 },

  /** Skyggene rundt skiløperen: halv bredde på skyggeboksen (m) og oppløsning (piksler). */
  shadow: { half: 30, mapSize: 2048 },

  /** Den preparerte bakken: største tillatte avvik fra fysikkbakken (m), og avstand mellom punktene (m). */
  ground: { tolerance: 0.011, minSpacing: 0.12, maxColumnSpacing: 2, maxRowSpacing: 1.5 },

  forest: {
    seed: 2026,
    /** Trærne står minst så langt utenfor løypekanten (m). */
    edgeMargin: 7,
    /** Minste avstand mellom to trær (m). */
    gap: 2.8,
    /** Høyde på et tre (m): fra min til min + range. Trærne lenger ut er farScale ganger større. */
    height: { min: 5.5, range: 6.5, farScale: 1.15 },
    /** Klynger nær løypa: avstand nedover (m), hvor langt ut (m), antall trær og hvor spredt (m). */
    near: { step: [6, 10], out: [2, 22], count: [3, 8], spread: [3, 5] },
    /** Skogholt lenger ute i liene. */
    far: { step: [9, 15], out: [25, 105], count: [6, 12], spread: [6, 10] },
    /** Skogen deles i biter (m langs bakken), så bare bitene som syns tegnes. */
    chunk: 80,
  },

  mountains: {
    /** Nærmeste ring glir litt forbi når du kjører (0 = står helt stille med kameraet, 1 = står fast i verden). */
    parallax: 0.03,
    /** Avstand (m), laveste og høyeste topp (grader over horisonten), farge, hvor mye dis (0–1), kveldsglød og frø. */
    layers: [
      { r: 820, low: 0.8, high: 5.5, body: 0x324a6e, haze: 0.25, glow: 0, seed: 11 },
      { r: 1200, low: 1.8, high: 8, body: 0x5a7099, haze: 0.5, glow: 0.25, seed: 23 },
      { r: 1600, low: 2.8, high: 11, body: 0x8796b8, haze: 0.68, glow: 0.6, seed: 37 },
    ],
  },

  /** Skystripene på himmelen glir sakte sidelengs: så mye per sekund spilltid (står stille på pause). */
  clouds: { drift: 0.004 },

  /** Gløden rundt lyktene: størrelse (m), styrke, og at den blekner bort litt lenger ute enn tåka. */
  glow: { size: 2.6, opacity: 0.7, fadeEndFactor: 1.15 },

  /**
   * Kvalitetsnivåene (logikken ligger i quality.ts). Høy er slik spillet så ut før nivåene kom.
   * pixelRatio: høyeste oppløsning i forhold til skjermen. shadowMapSize: 0 = ingen skygger.
   * antialias: myke kanter (gjelder bare nivået spillet startet på, den kan ikke byttes uten å laste siden på nytt).
   * forest: hvor stor del av trærne som tegnes. fogFar: synsavstand (m). spray: hvor mye snøsprut (0–1).
   * groundTolerance: største avvik i den preparerte bakken (m); større gir færre trekanter.
   */
  quality: {
    levels: {
      lav: { pixelRatio: 1, shadowMapSize: 0, antialias: false, forest: 0.45, fogFar: 190, spray: 0.4, groundTolerance: 0.016 },
      middels: { pixelRatio: 1.5, shadowMapSize: 1024, antialias: true, forest: 0.75, fogFar: 240, spray: 0.7, groundTolerance: 0.011 },
      hoy: { pixelRatio: 2, shadowMapSize: 2048, antialias: true, forest: 1, fogFar: 280, spray: 1, groundTolerance: 0.011 },
    },
    /**
     * Auto: starter på Middels på mobil og Høy på PC. Er snittet under minFps i slowFor sekunder,
     * går den ett nivå ned. Over okFps nullstilles tellingen (mellom de to står den stille).
     * Etter et bytte eller en pause ventes det settle sekunder før det måles igjen. Den går aldri opp av seg selv.
     */
    /**
     * capRates: vanlige faste fps-tak (halv/tredels skjermfrekvens o.l.). Like snitt (innenfor capSpread fps)
     * over capSamples målinger nær et av dem (innenfor capNear) regnes som et tak, ikke som tregt.
     * capGain: et hakk ned må gi mer enn så mange ganger fps-en før, ellers var det et tak.
     */
    auto: {
      mobile: 'middels', desktop: 'hoy', minFps: 45, okFps: 50, slowFor: 4, settle: 3,
      capRates: [20, 24, 30, 36, 40], capSpread: 1, capNear: 1.5, capSamples: 3, capGain: 1.08,
    },
    /** FPS-måleren viser snittet over så mange sekunder, så tallet står rolig. */
    fpsWindow: 1,
  },
} as const;
