# Triks og poeng (arbeidsstrøm 3)
Ren logikk uten three.js, med tester i `tests/tricks.test.ts`.

- `rotation.ts`: spinn og flips i lufta (ingen automatisk fullføring), landing ren/slurvete/fall og triksnavn.
- `fall.ts`: hva landingen fører til. Slurvete: litt fartstap og vakling. Fall: tumle, skli, bleke og respawn før hoppet.
- `controls.ts`: fordeler tastene. På bakken styrer og bremser de, i lufta spinner og flipper de.

Tallene (spinnfart, flipfart, grenser for ren landing) ligger i `src/core/config.ts`.
Ikke laget ennå: grabs, poeng, off-axis (cork o.l.).
