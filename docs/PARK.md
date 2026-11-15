# Lage og endre hopp (parkformatet)

Hele bakken står i én fil: `src/park/parks/testbakke.json`. Du endrer tallene der, og spillet bygger bakken ut fra dem. Du trenger ikke røre koden.

## Slik ser fila ut

```json
{
  "name": "Testbakke",
  "width": 80,
  "length": 600,
  "waves": { "height": 0.35, "along": 0.05, "across": 0.08 },
  "edge": { "start": 0.3, "strength": 0.02 },
  "deck": { "height": 0.85, "drop": 1, "sideDrop": 10 },
  "landing": { "knuckle": 6, "steep": 32, "runout": 75 },
  "kickers": [
    { "name": "Lite", "z": 160, "lipDeg": 12, "radius": 50, "width": 9, "sideWidth": 4, "landingStart": 19, "landingDeg": 9 }
  ]
}
```

`z` betyr «meter nedover bakken». Skiløperen starter ved z = 5.

## Hva feltene betyr

**Bakken**

| Felt | Betyr |
|---|---|
| `name` | Navnet på parken. |
| `width` | Hvor bred bakken er (m). |
| `length` | Hvor lang bakken er (m). Kjøringen stopper 40 m før slutten. |
| `waves` | Svake bølger i snøen: `height` = hvor høye (m), `along`/`across` = hvor tett de kommer nedover og på tvers. 0 i `height` = helt glatt. |
| `edge` | «Bollen» mot kantene. Den bøyer seg opp og snur deg mykt tilbake før kanten, som en halfpipe. `start` = hvor den begynner (0,3 = 30 % av bredden fra midten, altså 24 m), `strength` = hvor fort den blir bratt. Med dagens tall er den ca. 5 m høy helt ytterst. |
| `deck` | Platået rett etter kanten. `height` = hvor høyt det er i forhold til kanten (1 = like høyt), `drop` = hvor kort den lille kanten ned til platået er på midten (m), `sideDrop` = hvor mye lengre og slakere den kanten blir ute på sidene av hoppet (m), så den ikke gir et kraftspark når du kjører over den. |
| `landing` | Delene av landingen (m): `knuckle` = den myke overgangen inn, `steep` = den bratte delen der du skal lande, `runout` = utkjøringen der det flater ut. |

Helningen på bakken (18°) står i `src/core/config.ts` (`slopeDeg`), ikke i parkfila. Der står også den myke bremsen helt ute ved kanten (`wallZone` = de siste 10 m, `wallDecel` = hvor hardt), i tilfelle bollen ikke rekker å snu deg.

**Et hopp** (ett element i `kickers`, skriv dem ovenfra og ned)

| Felt | Betyr |
|---|---|
| `name` | Navnet på hoppet. Må være unikt. |
| `z` | Hvor kanten (lipen) står, i meter nedover bakken. |
| `lipDeg` | Vinkelen på kanten (grader). Mer = høyere og lengre hopp, men hardere spark. |
| `radius` | Hvor myk rampen er (m). Større = lengre og mykere rampe. |
| `width` | Bredden på den flate toppen av hoppet, der det har full høyde (m). |
| `sideWidth` | Hvor bred den myke skråningen ned på hver side av hoppet er (m). Større = slakere sider som du kan kjøre på. |
| `landingStart` | Hvor langt etter kanten landingen begynner (m). Lengre hopp trenger større tall. |
| `landingDeg` | Hvor mye brattere enn bakken landingen er (grader). |
| `respawnBeforeRamp` | Valgfritt. Faller du på landingen, settes du så mange meter før rampen (m). Standard 75. |
| `respawnSpeed` | Valgfritt. Farten du settes tilbake med (m/s). Velg den så farten på kanten blir som i en vanlig kjøring. Standard 11. |

## Lage et nytt hopp

1. Kopier en linje i `kickers`, gi den et nytt `name`.
2. Sett `z` slik at rampen ikke starter før landingen til hoppet over er ferdig.
3. Kjør `npm run check`. Er noe galt, får du en melding på norsk som sier hva du må fikse.

## Hvilke tall er trygge?

Tallene for dagens hopp er ikke gjettet. De er funnet ved å teste mange kombinasjoner i en hel kjøring fra start, så rampene dytter mykt (maks 2,1 g, det store hoppet 2,3 g) og landingene er myke (under 10° mot bakken). Små endringer går fint, store endringer kan gi hard rampe eller hard landing.

| Felt | Trygt område | Grense (gir feil) |
|---|---|---|
| `lipDeg` | 10–26 | 3–40 |
| `radius` | 50–80 | 5–300 |
| `landingDeg` | 9–15 | 0–30 |
| `width` | 8–14 | minst 2 |
| `sideWidth` | ca. 3–3,5 × kanthøyden (Lite 4, Medium 20, Stort 22) | sidene kan være høyst 35° bratte; feilmeldingen sier hvor bred den må være. `width` + 2 · `sideWidth` må få plass i bakken |
| `landingStart` | 19–45 | må være større enn `deck.drop` |
| `respawnBeforeRamp` | 60–100 (Lite 100, Medium 75, Stort 60) | minst 10 m, og du må ikke havne oppe på hoppet over. Skriv begge respawn-feltene eller ingen |
| `respawnSpeed` | 10–14 (Lite 14, Medium 11, Stort 10) | mellom 0 og toppfarten (25 m/s) |

Tommelfingerregel: øker du `lipDeg`, flyr du lenger, så `landingStart` må også øke. Gjør du hoppet høyere, må også `sideWidth` øke.

Ute på sidene er hoppet lavere, så du flyr kortere. Derfor begynner platået å gå nedover tidligere der, så du ikke lander flatt. Det skjer av seg selv.

Testene `offcenter.test.ts` (kjøre på sidene av hoppene) og `wall.test.ts` (kjøre inn mot kanten) passer på at det er mykt også utenfor midten.

## Det valideringen sjekker

- Alle felt finnes, er tall eller tekst, og ingen felt er feilstavet.
- Vinkler og mål er innenfor grensene over.
- Første rampe starter etter 20 m (så du får fart).
- Hoppene står i rekkefølge og overlapper ikke (rampen starter etter at landingen over er ferdig).
- Landingen starter etter platåkanten, og er ferdig før kjøringen stopper.
- Sidene på hoppene er ikke brattere enn 35°.
- Ingen hopp (med sider) er bredere enn bakken, og ingen har samme navn.
- Respawn-tallene (hvis de finnes) gir mening, og stedet du settes tilbake etter et fall er ikke oppe på hoppet over.

**Test alltid med `npm run check` etter en endring.** Testene sjekker også at du får riktig høyde og myk landing. Hvis du endrer dagens hopp, vil noen av de testene (for eksempel `air.test.ts` og `pop.test.ts`) kanskje feile, fordi de passer på at hoppene føles som du valgte. Da kan du spille og se om det nye er bedre, og så oppdatere testene.

## Ny park

Lag en ny fil i `src/park/parks/`, for eksempel `minpark.json`, og legg den til i `src/park/parks.ts`.
