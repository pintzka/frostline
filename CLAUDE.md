# Frostline

Frostline er Daniels eget 3D ski-triks-spill i nettleseren (freeski i en park med hopp og rails).
Daniel er 13 år og eier prosjektet, Carl er forelder og eier repoet. Svar på norsk, enkelt og konkret, på et nivå som passer en 13-åring.

## Regler som alltid gjelder
- **Eget innhold.** Ikke kopier andre spill (heller ikke cork7.com): ingen navn, figurer, baner, grafikk, lyder eller tekst derfra. Sjanger og mekanikker er fritt, utseende og innhold skal være vårt eget.
- **Kun gratis ressurser med åpen lisens**, helst CC0 (Poly Haven, ambientCG, Kenney, Quaternius, Freesound med CC0-filter, Google Fonts/OFL). Ingen NC- eller ND-lisenser, ingen betaling. Hver ressurs føres i `ASSETS.md` før den brukes.
- **Én endring om gangen.** Hver endring i egen gren og pull request. `main` endres aldri direkte.
- **Tester først.** `npm run check` (typecheck + tester + bygg) må være grønn før en PR. Ny spillogikk får tester i `tests/`.
- **Daniel bestemmer følelsen.** Etter hver fase spiller Daniel og svarer på spørsmålene i `docs/PLAYTEST.md`. Neste fase starter først når han er fornøyd.
- Måltall (fart, hopphøyde, spinnfart, poeng) står i `docs/DESIGN.md` og `src/core/config.ts`. Endre tallene der, ikke hardkod dem andre steder.
- Fysikken går med fast steg (240 Hz) og skal være deterministisk. Ren logikk (fysikk, triks, poeng) skal ikke importere three.js.

## Kommandoer
- `npm install` første gang
- `npm run dev` starter spillet på http://localhost:5173
- `npm run check` kjører alt som CI kjører

## Hvem eier hvilke mapper (arbeidsstrømmer)
Når flere agenter jobber samtidig, endrer hver bare sine egne mapper. Endringer i en annens mappe gjøres i en egen PR.

| # | Arbeidsstrøm | Mapper |
|---|---|---|
| 1 | Kjernefysikk | `src/physics/`, `src/core/` |
| 2 | Kamera og input | `src/camera/`, `src/input/` |
| 3 | Triks og poeng | `src/tricks/` |
| 4 | Karakter og animasjon | `src/character/`, `tools/blender/` |
| 5 | Park og verktøy | `src/park/` |
| 6 | Grafikk og effekter | `src/render/` |
| 7 | Lyd | `src/audio/` |
| 8 | UI og flyt | `src/ui/`, `index.html` |
| Q | Kvalitet | `tests/`, `.github/` |

`src/main.ts` kobler alt sammen. Hold den kort.

## Faser
0. Oppsett og design (denne)
1. Kjøre på ski: fart, svinger, carving, kamera. Gate: Daniel synes det er gøy å bare kjøre.
2. Luft og triks: hopp, spinn, flips, grabs, landing, poeng. Gate: triksene føles riktige.
3. Utseende og lyd (parallelt fra fase 1)
4. Innhold: én ferdig park, utfordringer, menyer
5. Lansering
