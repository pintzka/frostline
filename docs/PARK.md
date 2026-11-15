# Lage og endre hopp (parkformatet)

Hver park står i én fil i `src/park/parks/`: `testbakke.json` (tre hopp: Lite, Medium, Stort) og `nybegynner.json` (fire små og snille hopp). Du endrer tallene der, og spillet bygger bakken ut fra dem. Du trenger ikke røre koden.

På startskjermen (og resultatskjermen) velger du park med knappene eller tastene 1, 2, … Valget huskes i nettleseren til neste gang.

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
| `respawnBeforeRamp`, `respawnSpeed` | Valgfrie. Faller du på landingen, settes du så mange meter før rampen, med denne farten (m/s). Velg dem så farten på kanten blir som i en vanlig kjøring. Mangler de, brukes standardtallene i `config.ts` (75 m og 11 m/s). Skriv begge eller ingen. |

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
- `respawnBeforeRamp` og `respawnSpeed` står begge eller ingen, minst 10 m før rampen og ikke over toppfarten, og stedet du settes tilbake etter et fall er ikke oppe på hoppet over.

**Test alltid med `npm run check` etter en endring.** Testene sjekker også at du får riktig høyde og myk landing. Hvis du endrer dagens hopp, vil noen av de testene (for eksempel `air.test.ts` og `pop.test.ts`) kanskje feile, fordi de passer på at hoppene føles som du valgte. Da kan du spille og se om det nye er bedre, og så oppdatere testene.

## Rails og bokser

Rails og bokser står i lista `rails` (den kan sløyfes). Eksempel:

```json
"rails": [
  { "name": "Boks", "kind": "box", "z": 40, "x": 7, "length": 26, "height": 0.35 },
  { "name": "Langboks", "kind": "box", "z": 222, "x": 12, "length": 30, "height": 0.35, "angleDeg": 5 }
]
```

| Felt | Betyr |
|---|---|
| `name` | Navnet. Må være unikt. |
| `kind` | `"rail"` (smalt metallrør) eller `"box"` (bred boks med glatt topp). |
| `z` | Hvor starten står, i meter nedover bakken. |
| `x` | Hvor langt fra midten (m). Positivt = til høyre når du kjører ned, negativt = til venstre. |
| `length` | Hvor lang den er (m), med rampen i starten. |
| `height` | Hvor høyt over snøen toppen er (m). |
| `angleDeg` | (kan sløyfes) Hvor mye den skrår, i grader. 0 = rett ned bakken, positivt = mot høyre. |

Starten er alltid en myk rampe opp fra snøen (14 m, `railRampLength` i `src/core/config.ts`), så du kan kjøre rett opp. Railen følger bakken, med samme høyde over snøen hele veien.

**Trygge tall:** `height` 0,3–0,45 (en full pop gir ca. 0,6 m, så da kan du også poppe opp på den fra siden av starten), `length` 24–35.

**Valideringen sjekker:**
- `kind` er `"rail"` eller `"box"`, `height` 0,2–1,2 m, `length` minst 18 m (rampen + 4 m) og høyst 80 m, `angleDeg` høyst ±30°.
- Den står innenfor bollen mot kanten (23 m fra midten), starter etter 20 m og slutter 50 m før bakken tar slutt.
- Den står ikke på et hopp (rampe, platå eller landing, med de myke sidene og 2 m ekstra), og krysser ikke kanten inn til en landing (der bøyer bakken seg, over hele bredden).
- Det er minst 3 m til neste rail, og ingen har samme navn.

## Ny park

1. Kopier en park, for eksempel `src/park/parks/nybegynner.json`, til en ny fil, for eksempel `minpark.json`, og gi den et nytt `"name"`. Det er navnet som står på knappen.
2. Åpne `src/park/parks.ts` og legg den til i lista:

   ```ts
   import minpark from './parks/minpark.json';

   export const PARKS: Record<string, ParkData> = {
     nybegynner: loadPark(nybegynner, 'nybegynner.json'),
     testbakke: loadPark(testbakke, 'testbakke.json'),
     minpark: loadPark(minpark, 'minpark.json'),
   };
   ```

   Rekkefølgen i lista er rekkefølgen på knappene (og tastene 1, 2, 3 …). Nøkkelen (`minpark`) er det som huskes i nettleseren, så ikke bytt den senere.
3. Endre hoppene. Helningen (18°) er lik for alle parker, så det er hoppene som gjør en park lett eller vanskelig.
4. Gi hvert hopp `respawnBeforeRamp` og `respawnSpeed`, så du kommer i riktig fart inn mot hoppet igjen etter et fall.
5. Kjør `npm run check`. Er noe galt i fila, får du en melding på norsk.
6. Lag en test som kjører parken, som `tests/nybegynner.test.ts`: den later som om parken er valgt, kjører hele bakken med den ekte fysikken og sjekker myk rampe, myk landing og respawn. Kopier den og bytt `'nybegynner'` med nøkkelen til parken din.

### Nybegynnerparken

Fire små hopp (Mini 1–4), mindre enn «Lite» i testbakken, med 50–60 m flat bakke mellom landing og neste rampe. Tallene er funnet ved å teste mange kombinasjoner i en hel kjøring fra start:

| Hopp | Kanthøyde | Lufttid | Høyde over kanten | Rampe | Landing | Med perfekt pop |
|---|---|---|---|---|---|---|
| Mini 1 | 0,69 m | 1,02 s | 0,65 m | 1,91 g | 4,5° | 1,0 m, 6,7° |
| Mini 2 | 0,79 m | 1,01 s | 0,20 m | 1,97 g | 5,0° | 0,4 m, 6,6° |
| Mini 3 | 0,79 m | 1,09 s | 0,17 m | 1,90 g | 5,6° | 0,4 m, 7,2° |
| Mini 4 | 0,79 m | 1,09 s | 0,37 m | 1,80 g | 5,9° | 0,7 m, 7,6° |

Til sammenligning: «Lite» har 1,13 m kant, 1,18 s og 1,06 m. Alle hoppene gir over 0,9 s i lufta, så triks teller fullt. Landingen er under 6,5° også med 5 % saktere og 3 % raskere fart inn mot hoppet. Fra Mini 2 kommer du nesten i toppfart (ca. 90 km/t), så du flyr lavt og langt.

### Hvorfor siden lastes på nytt når du bytter park

Bakken, fysikken, trærne, hoppmerkene og stedet du settes tilbake etter fall leser alle parken én gang når spillet starter. Å bygge alt det på nytt mens spillet kjører ville kreve endringer i mange deler av koden. I stedet huskes valget, og siden lastes på nytt (under ett sekund). Det skjer bare på start- og resultatskjermen.
