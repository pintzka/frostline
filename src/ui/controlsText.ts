/**
 * Kontrollene, slik de faktisk er i koden (input/input.ts og tricks/controls.ts).
 * Brukes både på startskjermen og i hjelpelinja nederst. Endres tastene, endre her også.
 */
export const CONTROLS: [string, string][] = [
  ['Styr', '← → / A D'],
  ['Brems', '↓ / S'],
  ['Pop', 'hold og slipp mellomrom (slipp rett før kanten = perfekt)'],
  ['Spinn i lufta', '← → / A D'],
  ['Frontflip / backflip', '↑ / W · ↓ / S'],
  ['Cork / rodeo', 'spinn + W (cork) eller S (rodeo) rett etter kanten'],
  ['Grab i lufta', 'hold J / K / L (slipp før landing)'],
  ['Rail og boks', 'kjør opp rampen eller pop opp på den; på tvers = boardslide. Ikke hold styring for lenge, pop = hopp av'],
  ['Start på nytt', 'R'],
  ['Pause · lyd · fps', 'P / Esc · M · F'],
  ['Velg bakke (på menyen)', '1 / 2, eller trykk på knappen'],
  ['Reprise (etter målet)', 'V · kamera: C eller 1 / 2 / 3 · tilbake: mellomrom eller Esc'],
  ['Gamepad', 'stikke, A pop, LT/B brems, X/RB/LB grab, Y ny runde, Start pause · etter målet: X reprise, RB kamera, A tilbake'],
  ['Mobil', 'dra tommelen på venstre side (i lufta: sidelengs spinn, opp/ned flip), POP, BREMS og grabs (NORDLYS / ISBIT / SNØUGLE) til høyre, «Se reprise» etter målet'],
];
