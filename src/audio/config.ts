// Alle tall for lyden. Endre her, ikke i lydkoden.
// Styrker er 0–1 (andel av kanalens maks), «tone» er 0–1 (mørk til lys).
export const AUDIO = {
  /** Hovedvolum. Lavt med vilje, så det ikke skriker i hodetelefonene. */
  masterVolume: 0.3,
  /** Hvor fort lyden tones inn/ut ved M (s). */
  muteFade: 0.08,

  /** Vind: starter ved windMinSpeed, full ved windFullSpeed (m/s). Kurven gjør at den vokser mest i høy fart. */
  windMinSpeed: 2,
  windFullSpeed: 28,
  windCurve: 1.4,
  /** Litt ekstra vind i lufta, når snøen er stille. */
  windAirBoost: 1.15,
  /** Svak bris når du står stille, så det ikke blir helt dødt. */
  windFloor: 0.04,

  /** Snø-sus: full ved denne farten (m/s). Kurve < 1 = hørbar også i lav fart. */
  snowFullSpeed: 22,
  snowCurve: 0.8,
  /** Suset og skrapet tones mykt inn mellom 0 og denne farten (m/s), så det ikke starter med et hopp. */
  fadeInSpeed: 2,

  /** Carve-hvisl: kanten må være over carveEdgeStart (0–1) før det høres, full ved 1. */
  carveEdgeStart: 0.3,
  carveFullSpeed: 18,

  /** Skrape: full brems i denne farten (m/s) gir full lyd. Skrens (sidelengs gli) gir også skrape. */
  scrapeFullSpeed: 15,
  scrapeCurve: 0.7,
  scrapeSkidShare: 0.6,

  /**
   * Landing: styrken bygger mest på lufttid (stort hopp = tungt dump, selv om landingen er myk),
   * og litt på støtet (farten rett inn i bakken, m/s). Lufttid fra landAirStart til landAirFull (s).
   */
  landAirStart: 0.15,
  landAirFull: 3,
  landAirShare: 0.7,
  landMinImpact: 0.8,
  landFullImpact: 9,
  landImpactShare: 0.2,
  /** Grunnstyrke for en ekte landing. */
  landFloor: 0.1,
  /** Kortere lufttid enn dette (s) er bare en kul i bakken, og tones ned mot stille. */
  landBumpAir: 0.25,

  /** Pop: styrke ved kort trykk og full lading, og ekstra for perfekt pop. */
  popMin: 0.35,
  popPerfectBoost: 1.2,

  /** Maks volum for hver kanal (ganges med styrken over). */
  mix: { wind: 0.55, snow: 0.32, carve: 0.2, scrape: 0.38, landing: 0.9, pop: 0.3 },

  /** Filtrene (Hz): tone 0 gir første tall, tone 1 det andre. */
  windHz: [220, 2200],
  snowHz: [900, 4200],
  carveHz: [3000, 6500],
  scrapeHz: [450, 1300],

  /** Hvor mykt lyden følger spillet (tidskonstant i s). Lavere = kvikkere, høyere = mykere. */
  smooth: { wind: 0.15, snow: 0.06, carve: 0.08, scrape: 0.07 },
  /** Hvor skarpt hvert filter er (Q). Høyere = smalere, mer «tone». */
  q: { wind: 0.8, snow: 0.5, snowHighpass: 0.5, carve: 1.6, scrape: 0.9 },
  /** Snø-suset mister den dypeste rumlingen under dette (Hz). */
  snowHighpassHz: 250,
  /** Vindkast og grov skrape: langsomme bølger på volumet, [Hz, dybde 0–1]. */
  gusts: [[0.13, 0.18], [0.37, 0.08]],
  grit: [[13, 0.25], [21.7, 0.18]],

  /** Bare send nye verdier til lyden når de har endret seg merkbart. */
  sendGainStep: 0.003,
  /** Filtre: minste endring, som andel av frekvensen. */
  sendFreqStep: 0.01,
  /** Pop og landing svakere enn dette spilles ikke. */
  minEvent: 0.02,

  /** Limiter på slutten: tar bare toppene, og slipper fort, så lyden ikke «pumper» etter landinger. */
  limiter: { threshold: -3, knee: 0, ratio: 12, attack: 0.002, release: 0.06 },

  /** Første gang lyden starter, tones den inn rolig (tidskonstant i s). */
  startFade: 0.4,
  /** Før lyden pauses (skjult fane, pause), tones den ned over så mange sekunder, og inn igjen etterpå. */
  sleepFade: 0.05,
  /** Ny runde: lyden dukkes kort, så vinden ikke «suger» brått ned. Ned (tau), hold (s), opp igjen (tau). */
  duck: { down: 0.03, hold: 0.2, up: 0.15 },

  /** Korte lyder: hvor fort de når toppen (s), og etter hvor mange tidskonstanter de stoppes (da er de stille). */
  shotAttack: 0.006,
  shotStopTaus: 8,
  /** Landing: dyp tone som synker, et mykt dunk og litt knas. «PerHard» legges til ved hardest landing. */
  landSound: {
    toneHz: 80, toneHzPerHard: 50, toneEndHz: 38, toneSweep: 0.25, toneShare: 0.8, toneTau: 0.07, toneTauPerHard: 0.08,
    thumpHz: 300, thumpHzPerHard: 900, thumpQ: 0.7, thumpTau: 0.06, thumpTauPerHard: 0.06,
    crunchHz: 1600, crunchQ: 0.8, crunchShare: 0.25, crunchTau: 0.035,
  },
  /** Pop: kort lys «tsjk» og en liten «tokk». */
  popSound: { hissHz: 2400, hissQ: 1.2, hissTau: 0.025, tockHz: 210, tockEndHz: 130, tockSweep: 0.06, tockShare: 0.4, tockTau: 0.025 },
} as const;
