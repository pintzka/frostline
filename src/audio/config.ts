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
} as const;
