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
  ['Grab i lufta', 'hold J / K / L (slipp før landing)'],
  ['Rail og boks', 'kjør opp rampen eller pop opp på den; på tvers = boardslide. Ikke hold styring for lenge, pop = hopp av'],
  ['Start på nytt', 'R'],
  ['Pause · lyd', 'P / Esc · M'],
  ['Gamepad', 'stikke, A pop, LT/B brems, X/RB/LB grab, Y ny runde, Start pause'],
  ['Mobil', 'dra tommelen på venstre side, POP og BREMS til høyre'],
];
