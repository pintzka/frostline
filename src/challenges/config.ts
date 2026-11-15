/**
 * Tallene for visningen av utfordringer. Selve målene (grader, sekunder, poeng) står i JSON-fila for hver park.
 */
export const CHALLENGE_CONFIG = {
  /** Så lenge (s) meldingen «Utfordring klart: …» står i HUD-en, inkludert inn- og uttoning. */
  toastTime: 2.8,
  /** Litt pause (s) mellom to meldinger når du klarer flere samtidig. */
  toastGap: 0.25,
  /** Et hopp regnes som tatt fra en kicker når du letter fra rampen eller inntil så mange meter etter kanten. */
  takeoffAfterLip: 3,
  /** Nøkkelen fremgangen lagres under i nettleseren (localStorage). */
  storageKey: 'frostline.utfordringer',
} as const;
