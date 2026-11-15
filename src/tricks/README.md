# Triks og poeng (arbeidsstrøm 3)
Ren logikk uten three.js, med tester i `tests/tricks.test.ts` og `tests/score.test.ts`.

- `rotation.ts`: spinn og flips i lufta (ingen automatisk fullføring), landing ren/slurvete/fall og triksnavn.
- `grabs.ts`: grabs på J/K/L (Nordlys, Isbit, Snøugle), teller etter 0,3 s, myk bøy for figuren.
- `score.ts`: poengtabell, ekte triks, landing, gjentakelse og kombo.
- `controls.ts`: fordeler tastene. På bakken styrer og bremser de, i lufta spinner og flipper de.

Tallene (spinnfart, flipfart, grenser for ren landing, poeng) ligger i `src/core/config.ts`.
Ikke laget ennå: fart-boost for ekte triks, fall-konsekvens (tumle og respawn), off-axis (cork o.l.).
