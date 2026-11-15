# Triks og poeng (arbeidsstrøm 3)
Ren logikk uten three.js, med tester i `tests/tricks.test.ts` og `tests/score.test.ts`.

- `rotation.ts`: spinn og flips i lufta (ingen automatisk fullføring), landing ren/slurvete/fall og triksnavn.
- `offaxis.ts`: kroppens stilling som kvaternion, også off-axis (cork med W, rodeo med S, innen 0,25 s etter avsats). Tester i `tests/offaxis.test.ts`.
- `grabs.ts`: grabs på J/K/L (Nordlys, Isbit, Snøugle), teller etter 0,3 s, myk bøy for figuren.
- `score.ts`: poengtabell, ekte triks, landing, gjentakelse og kombo.
- `fall.ts`: hva landingen fører til. Slurvete: litt fartstap og vakling. Fall: tumle, skli, bleke og respawn før hoppet.
- `controls.ts`: fordeler tastene. På bakken styrer og bremser de, i lufta spinner og flipper de.

Poengene regnes ut i spillsteget (`src/core/game.ts`), så fall og respawn henger sammen med kombo og beste runde.
Tallene (spinnfart, flipfart, grenser for ren landing, poeng) ligger i `src/core/config.ts`.
Ikke laget ennå: fart-boost for ekte triks, bio og misty.
