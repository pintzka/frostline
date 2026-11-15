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
| Gli etter slipp | ca. 25° (spinn) og 18° (flip), så du lander rent hvis du slipper når trikset er rundt |
| Grab | J / K / L holdes for poeng, minst 0,3 s for å telle (se Grabs under) |
| Landing | ren hvis vinkelen mot bakken er under 25° og spinnet er innenfor ±30° av en hel eller halv runde (switch) |
| Poeng og boost | bare for ekte triks: 540 eller mer, en flip eller en grab |

## Grabs
Hold en tast i lufta. Grabben teller først etter 0,3 s, og den lengste grabben i hoppet er den som teller.

| Tast | Grab | Stilling |
|---|---|---|
| J | Nordlys | høyre hånd fram til skituppene |
| K | Isbit | begge hender ned til midten av skiene |
| L | Snøugle | venstre hånd bak til skihælene |

## Poeng
Tallene står i `src/core/config.ts` og regnes ut i `src/tricks/score.ts`.

Poeng for ett triks = (spinn + flip + grab) × grab-gangetall × perfekt pop × landing × gjentakelse × kombo.

| Spinn | 180 | 360 | 540 | 720 | 900 | 1080 | 1260 | 1440 | 1620 | mer |
|---|---|---|---|---|---|---|---|---|---|---|
| Grunnpoeng | 50 | 150 | 400 | 800 | 1 400 | 2 200 | 3 200 | 4 400 | 5 800 | +1 500 per 180 |

| Flip | 1 | 2 | 3 | mer |
|---|---|---|---|---|
| Ekstra | 700 | 1 800 | 3 200 | +1 600 per flip |

- **Bare ekte triks gir poeng:** 540 eller mer, minst én flip, eller en grab som teller. Et 180 eller 360 alene vises, men gir 0.
- **Grab:** +300 poeng, og hele trikset ganges med x1,25 når grabben teller. Gangetallet vokser med 0,5 per sekund du holder etter 0,3 s, opp til x2.
- **Perfekt pop:** x1,2.
- **Landing:** ren full sum, slurvete halv sum, fall null.
- **Gjentakelse:** samme triks igjen på rad gir 60 %, så 36 %, og aldri under 20 %. Andre spinnretning, en annen grab eller switch er et nytt triks og gir full verdi.
- **Kombo:** hvert ekte triks med ren landing øker gangetallet med +0,25 (x1, x1,25, x1,5 ... opp til x4). Slurvete landing beholder komboen uten å øke den. Fall eller 9 sekunder på snøen uten nytt ekte triks nullstiller den. Poengene du har fått beholdes.
- Eksempler: 540 = 400, 720 = 800, 1080 = 2 200. 720 + Backflip + Isbit holdt 1 s med perfekt pop = (800 + 700 + 300) × 1,6 × 1,2 ≈ 3 460.
- Når runden starter på nytt (R eller nederst i bakken), huskes beste runde i HUD-en.

## Kamera
- Lavt og nært bak skiløperen (5–6 m bak, 2 m opp).
- FOV øker med farten (62° til 78°).
- I lufta følger kameraet jevnt uten å snurre med skiløperen.

## Én park
Én ferdig park med en tydelig linje: rails øverst, tre hopp i midten, et stort hopp nederst.
