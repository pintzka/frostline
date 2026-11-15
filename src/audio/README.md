# Lyd (arbeidsstrøm 7)

All lyd lages i kode med Web Audio. Ingen lydfiler, så ingenting å føre i ASSETS.md.

- `config.ts`: alle tall (volum, når vinden starter, filtre, hvor mykt lyden følger med).
- `mix.ts`: ren logikk uten Web Audio og three.js. Regner ut hvor sterk og lys hver lyd skal være ut fra fart, kant, brems og skrens, og finner pop og landing. Testes i `tests/audio.test.ts`.
- `engine.ts`: selve lyden. Vind (mørk støy, lysere med farten, rolige vindkast), snø-sus, carve-hvisl, skrape ved brems/skrens, dump ved landing og «tsjk» ved pop.

Regler:
- Lyden starter ved første tastetrykk eller klikk (nettleseren krever det). M slår av/på, og valget huskes.
- Alle endringer glir mykt (`setTargetAtTime`), korte lyder starter fra 0 og dør ut mykt, så det ikke klikker.
- Finnes ikke Web Audio, gjør `createAudio()` ingenting, og spillet går som før.
- `suspend()` / `resume()` er klare for pause. Skjult fane stopper lyden av seg selv.
