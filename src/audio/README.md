# Lyd (arbeidsstrøm 7)

All lyd lages i kode med Web Audio. Ingen lydfiler, så ingenting å føre i ASSETS.md.

- `config.ts`: alle tall (volum, når vinden starter, filtre, hvor mykt lyden følger med).
- `mix.ts`: ren logikk uten Web Audio og three.js. Regner ut hvor sterk og lys hver lyd skal være ut fra fart, kant, brems og skrens, og finner pop og landing. Testes i `tests/audio.test.ts`.
- `engine.ts`: selve lyden. Vind (mørk støy, lysere med farten, rolige vindkast), snø-sus, carve-hvisl, skrape ved brems/skrens, dump ved landing og «tsjk» ved pop.

Regler:
- Lyden prøver å starte ved hvert tastetrykk, klikk og slipp av fingeren til den faktisk går (nettleseren krever det, og på mobil teller bare slipp). M slår av/på, og valget huskes.
- Alle endringer glir mykt (`setTargetAtTime`), korte lyder starter fra 0 og dør ut mykt, så det ikke klikker.
- Finnes ikke Web Audio, gjør `createAudio()` ingenting, og spillet går som før.
- `suspend()` / `resume()` er klare for pause: lyden tones ned før den stoppes og inn igjen etterpå. Skjult fane gjør det samme av seg selv.
- `newRun()` dukker lyden kort ved ny runde, så vinden ikke faller brått.
- Alle tall, også filtre, limiter og korte lyder, står i `config.ts`. `tests/audioEngine.test.ts` sjekker motoren med en falsk Web Audio.
