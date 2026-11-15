# Frostline: design og måltall

Dette er målene vi bygger mot. Tallene ligger i `src/core/config.ts`. Daniel kan be om å endre dem etter playtest.

## Følelsen vi vil ha
- Rask og myk. Man skal kjenne farten, men aldri miste kontrollen uten grunn.
- Lett å lære, vanskelig å mestre. Et enkelt 360 skal gå første kvelden, en dobbel cork med grab skal ta en uke.
- Kort vei fra feil til nytt forsøk: restart på under 1 sekund.

## Kjøring (fase 1)
| Mål | Verdi |
|---|---|
| Toppfart | 25 m/s (90 km/t) |
| Tid fra start til 60 km/t i hovedbakken | ca. 3–4 s |
| Snuradius ved full styring i 60 km/t | ca. 15 m |
| Brems fra 60 km/t til stopp | under 3 s |
| Fysikksteg | 240 Hz, deterministisk |

## Luft (fase 2)
| Hopp | Lufttid | Høyde over kul |
|---|---|---|
| Lite (6 m) | 1,0–1,3 s | 1–2 m |
| Medium (12 m) | 1,6–2,0 s | 3–4 m |
| Stort (20 m) | 2,3–2,8 s | 5–7 m |

Rampene skal dytte mykt: maks 2,1 g (1 g = å stå stille). Landingene skal treffe under 10° mot bakken.
Justert 10. november etter Daniels test («brå oppover, brå landing»): rampene ble myke og landingene bratte.

Justert 11. november etter Daniels test («farten går rett ned til 90 når jeg lander»): toppfarten er ikke lenger en vegg, farten tas mykt ned (`overspeedFade`). Da kommer du inn mot det store hoppet i ca. 100 km/t, og i den farten gir en myk rampe (maks 2,1 g) bare ca. 3 m.

Justert 15. november: Daniel valgte et høyere stort hopp. Rampen på det store hoppet får sparke opp til 2,3 g (de andre maks 2,1 g). Det gir 2,5 s og 5,0 m uten pop, og 3,0 s og 6,0 m med perfekt pop, med landing under 8°.

## Pop
| Mål | Verdi |
|---|---|
| Lading | hold mellomrom, fullt etter 0,5 s |
| Pop på flat bakke (ollie) | ca. 60 cm (popSpeed 3,4 m/s) |
| Perfekt pop | slipp innen 0,12 s før kanten, 25 % ekstra kraft |
| Ekstra høyde med perfekt pop | ca. +0,5 m (lite), +0,9 m (medium), +1,0 m (stort) |
| Landing med perfekt pop | fortsatt under 11° |

## Triks (fase 2)
| Mål | Verdi |
|---|---|
| Spinnfart | ca. 540° per sekund (et 720 på et medium hopp) |
| Flipfart | ca. 360° per 0,9 s |
| Gli etter slipp | ca. 25° (spinn) og 18° (flip), så du lander rent hvis du slipper når trikset er rundt (med landingshjelp: se under) |
| Grab | J / K / L holdes for poeng, minst 0,3 s for å telle (se Grabs under) |
| Landing | ren hvis vinkelen mot bakken er under 25° og spinnet er innenfor ±30° av en hel eller halv runde (switch) |
| Poeng og boost | bare for ekte triks: 540 eller mer, en flip eller en grab |

## Landingshjelp
Daniels ønske: «auto complete hopp for spilleren, sakte, ikke for raskt, men man må være litt snill med dem».
Valget **Landingshjelp: På / Av** står på startskjermen og pauseskjermen (under grafikkvalget), huskes i nettleseren, og er **På** som standard. Med Av virker alt nøyaktig som før.

Regelen: **slipper du spinn- eller flip-tasten når du er nesten rundt, fullfører spillet rolig resten**, så du lander rent.
- Hjelpen virker bare på en akse når du **ikke** holder tasten for den (spinn A/D, flip W/S). Den kjemper aldri imot. Gjelder spinn, flip og off-axis (cork/rodeo).
- Målet er nærmeste rene stilling i retningen du roterer, regnet fra der rotasjonen ville stoppet med glidet: hel eller halv runde for spinn (switch er greit), hel runde for flip.
- **Rekkevidde:** mangler du opptil **100°** (spinn) / **90°** (flip), fullfører den framover. Er du opptil **30°** forbi, trekker den deg tilbake. Er du lenger unna, hjelper den ikke (et 200° spinn eller en 150° flip er fortsatt slurvete eller fall).
- **Fart:** maks **120°/s** (spinn) og **100°/s** (flip), mye saktere enn din egen (540 / 400). Minst halvparten av det langt fra landingen, opp til full jo nærmere landingen er (anslått tid fra høyden over snøen og farten ned). Bygger seg opp mykt (900 / 750 °/s²), bremser som glidet, og glir mykt inn de siste gradene. Aldri et hopp i rotasjonsfarten, aldri raskere enn du selv kan, og aldri mer enn én stilling fram (300° blir aldri 720°).
- **Poeng:** ingen straff. Navn og poeng etter stillingen du faktisk lander i (en 640° som blir en ren 720 er en 720).
- **Reprise:** valget er en del av inputen hvert steg og med i kopien av spillet når runden starter, så reprisen blir lik.

| Eksempel (ekte fysikk) | Uten hjelp | Med hjelp |
|---|---|---|
| Slipp spinn ved 270° (medium) | 295°, fall | ren 360 |
| Slipp spinn ved 300° | 324°, slurvete 360 | ren 360 |
| Slipp spinn ved 640° | 664°, fall | ren 720 |
| Slipp backflip ved 290° | 308°, fall | ren backflip |
| Cork: spinn 640°, flip 300° | fall | ren Cork 720 |
| Spinn 200° / flip 150° | 225° slurvete / 167° fall | det samme |

Tallene står i `src/core/config.ts` (`landAssist...`), logikken i `src/tricks/rotation.ts` (`assistTarget`, `assistRate`), tid til landing i `src/core/game.ts` (`timeToLand`).

## Off-axis: cork og rodeo
Regelen: **trykk spinn (A/D) og flip (W/S) begge innen 0,25 s etter avsatsen**, så blir hoppet off-axis resten av hoppet.
- **Spinn + W = Cork.** Kroppen snurrer rundt seg selv og tipper over på skrå, med hodet framover og ut mot den siden du spinner.
- **Spinn + S = Rodeo.** Det samme, men hodet går bakover og ut mot spinnsiden.
- Trykker du den andre tasten senere enn 0,25 s, er det vanlig spinn + flip som før (f.eks. «720 + Frontflip»).
- Tastene, farten og glidet er de samme som vanlig. Bare stillingen og navnet endres: kroppen roterer rundt én skrå akse (sideaksen vridd 45° mot fartsretningen), ikke spinn og flip etter hverandre. Den glir mykt inn i off-axis (0,12 s) og ut igjen på bakken (0,4 s).
- Tastene du holdt da du lettet (f.eks. styring over kanten), teller ikke, så du får aldri cork uten å mene det.
- **Navn:** «Cork 720», «Cork 540», «Rodeo 900», «Dobbel cork 1080» (to flips), «Trippel rodeo 1440». Det må være minst 360 spinn og én hel flip, ellers heter trikset som vanlig.
- **Landing:** vurderes ut fra hvor kroppen faktisk står: hvor langt fra stående, og hvor langt fra en hel eller halv runde skiene peker. Samme grenser som vanlig (ren ±25° / ±30°).
- **Poeng:** spinnpoengene ganges med x1,3. Cork 720 = 800 × 1,3 + 700 = 1 740 (720 + Frontflip = 1 500).
- Tallene står i `src/core/config.ts` (`offAxis...`), logikken i `src/tricks/offaxis.ts` og `rotation.ts`.

## Grabs
Hold en tast i lufta. Grabben teller først etter 0,3 s, og den lengste grabben i hoppet er den som teller.
Slipp grabben før du lander: holder du fortsatt en grab som teller når skiene treffer snøen, blir landingen slurvete (halve poeng).

| Tast | Grab | Stilling |
|---|---|---|
| J | Nordlys | høyre hånd fram til skituppene |
| K | Isbit | begge hender ned til midten av skiene |
| L | Snøugle | venstre hånd bak til skihælene |

## Mobil
- Venstre tommel (venstre halvdel av skjermen): dra sidelengs for å styre, i lufta spinner det.
- I lufta: dra tommelen tydelig opp (frontflip) eller ned (backflip), minst 50 px (`touchFlipThreshold`). Flippen holder til tommelen er under 30 px fra midten (`touchFlipRelease`).
- En tommel som sakte glir opp eller ned mens du styrer gir aldri flip: midtpunktet følger etter med 30 px/s (`touchFlipRecenter`). Er tommelen dratt opp/ned når du letter, sperres flippen til du drar på nytt.
- Høyre side: POP (hold og slipp), BREMS (hold), og tre grab-knapper NORDLYS / ISBIT / SNØUGLE (hold, som J / K / L). Liggende telefon: grabbene står til venstre for POP. Stående: over BREMS. Ingen knapp dekker venstre halvdel.
## Landing og fall (fase 2)
| Landing | Hva skjer |
|---|---|
| Ren | ingenting, du kjører videre |
| Slurvete | du mister ca. 12 % av farten over 0,3 s, og kroppen vakler fra side til side i ca. 0,6 s |
| Fall | kroppen velter, du sklir og bremser opp i snøen, skjermen blekner, og du settes tilbake |

- Settes tilbake 1,1 s etter landingen, skjermen er klar igjen etter 1,4 s (målet er under 1,5 s).
- Falt du på landingen til et hopp, settes du tilbake før rampen på det hoppet, midt i hoppet. Avstand og fart er valgt per hopp så farten på kanten blir som i en vanlig kjøring (innen 3 %): Lite 100 m før rampen i 50 km/t, Medium 75 m i 40 km/t, Stort 60 m i 36 km/t.
- Andre fall (f.eks. pop på flat bakke): 35 m før fallstedet i 36 km/t. Havner du da på et hopp (rampe, platå eller kanten inn til landingen), settes du 10 m før rampen i stedet.
- Mens du faller virker ingen taster. R virker først når skjermen er helt klar igjen. Pop holdt fra fallet teller ikke før du slipper.
- R og slutten av bakken tømmer skisporet; respawn etter fall lar det gamle sporet ligge med et hull.
- Tallene ligger i `src/core/config.ts` (`sloppy...` og `fall...`). Avstand og fart for respawn står per hopp i park-fila (`respawnBeforeRamp`, `respawnSpeed`, se `docs/PARK.md`).

## Poeng
Tallene står i `src/core/config.ts` og regnes ut i `src/tricks/score.ts`.

Poeng for ett triks = (spinn × off-axis + flip + grab) × grab-gangetall × perfekt pop × switch × landing × gjentakelse × kombo.

| Spinn | 180 | 360 | 540 | 720 | 900 | 1080 | 1260 | 1440 | 1620 | mer |
|---|---|---|---|---|---|---|---|---|---|---|
| Grunnpoeng | 50 | 150 | 400 | 800 | 1 400 | 2 200 | 3 200 | 4 400 | 5 800 | +1 500 per 180 |

| Flip | 1 | 2 | 3 | mer |
|---|---|---|---|---|
| Ekstra | 700 | 1 800 | 3 200 | +1 600 per flip |

- **Bare ekte triks gir poeng:** 540 eller mer, minst én flip, eller en grab som teller. Et 180 eller 360 alene vises, men gir 0.
- **Grab:** +300 poeng, og hele trikset ganges med x1,25 når grabben teller. Gangetallet vokser med 0,5 per sekund du holder etter 0,3 s, opp til x2.
- **Off-axis** (cork, rodeo): spinnpoengene ganges med x1,3 (se Off-axis over).
- **Perfekt pop:** x1,2.
- **Switch** (hoppet starter baklengs): liten bonus, x1,1.
- **Småhopp:** et hopp med under 0,9 s i lufta (en pop på flaten gir ca. 0,7 s, det lille hoppet 1,2 s) gir bare 5 % av poengene og påvirker ikke komboen. Da lønner det seg ikke å spamme pop og grabs på flaten.
- **Landing:** ren full sum, slurvete halv sum, fall null.
- **Gjentakelse:** de 4 siste triksene huskes. For hver gang trikset finnes der, gir det 60 % (så 36 %, 22 % ...), men aldri under 20 %. Også A-B-A-B gir mindre. Andre spinnretning eller switch gjør det ikke til et nytt triks; en annen rotasjon, flip, grab eller off-axis gjør det («Cork 720» og «720 + Frontflip» er to triks).
- **Kombo:** hvert ekte triks med ren landing øker gangetallet med +0,25 (x1, x1,25, x1,5 ... opp til x4). Slurvete landing beholder komboen uten å øke den. Fall eller 9 sekunder på snøen uten nytt ekte triks nullstiller den. Poengene du har fått beholdes. Et fall vises alltid («Fall», og «Kombo tapt» hvis komboen var over x1).
- Eksempler: 540 = 400, 720 = 800, 1080 = 2 200. 720 + Backflip + Isbit holdt 1 s med perfekt pop = (800 + 700 + 300) × 1,6 × 1,2 ≈ 3 460.
- Når runden starter på nytt (R eller nederst i bakken), huskes beste runde i HUD-en.

## Rails og bokser (første versjon)
Tallene står i `src/core/config.ts` (`rail...`), logikken i `src/physics/rail.ts`, poengene i `src/tricks/score.ts`.

- **Komme på:** kjør rett opp rampen i starten, eller pop opp på railen (lad og slipp mellomrom). Fra lufta låses du på når skiene treffer toppen på vei ned, høyst 0,45 m fra midten (boks: 0,58 m). Kjører du opp fra snøen, må du være innenfor 0,2 m (boks: innenfor bredden), og du starter rett, uten ustøhet.
- **Stil:** lander du med skiene langs railen (forlengs eller baklengs) er det **50-50**. Står du på tvers (spinn ca. 90° i lufta) er det **Boardslide**.
- **Skjevt:** innenfor 20° fra langs/på tvers er rent. 20–40° er skjevt: du starter ustø og får halve poeng. Mer enn 40° (eller en flip som ikke er rundt): du faller av med en gang.
- **Balanse:** holder du styring til én side, faller du av etter ca. 0,7 s. Slipp, så retter du deg opp igjen. Kroppen lener seg og en prikk i HUD-en viser balansen (gul, så rød nær kanten).
- **Fart:** tyngdekraften drar deg nedover railen like sterkt som i bakken (slopeAccel), friksjon (50-50 0,08, boardslide 0,15) og luft bremser. Farten holder seg omtrent som på snøen ved siden av, litt saktere (boardslide mer).
- **Av:** pop på railen hopper av (og du kan spinne). Ved slutten flyr du videre. Fra boardslide vris kroppen av seg selv tilbake langs fallinja hvis du ikke spinner selv, så du lander rent.
- **Poeng:** startbonus pluss poeng per meter (50-50: 150 + 15 per m, boardslide: 250 + 22 per m), så det lønner seg ikke å gli sakte. Under 0,3 s gir 0. Spinner du opp på railen (f.eks. «270 Boardslide»), gir hver ekstra kvarte runde +80. Railen er et ekte triks i komboen (øker x0,25 hvis du var ren), men av og på samme rail uten å lande i snøen bygger komboen bare én gang. Gjentakelse regnes per rail og stil. Faller du av, er det et vanlig fall (0 poeng, kombo tapt).
- **Lyd:** på railen er det skrape-lyd i stedet for snø-sus, og landingslyd når du kommer på fra lufta.

## Kamera
- Lavt og nært bak skiløperen (5–6 m bak, 2–3 m over skiløperen). Ligger snøen bak høyere (bratt landing), løftes kameraet akkurat så mye som trengs.
- FOV øker med farten (62° til 78°).
- I lufta følger kameraet jevnt uten å snurre med skiløperen.

## Én park
Én ferdig park med en tydelig linje: rails øverst, tre hopp i midten, et stort hopp nederst.
