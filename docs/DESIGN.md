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

Justert 11. november etter Daniels test («farten går rett ned til 90 når jeg lander»): toppfarten er ikke lenger en vegg, farten tas mykt ned (`overspeedFade`). Da kommer du inn mot det store hoppet i ca. 100 km/t, og i den farten gir en myk rampe (maks 2,1 g) bare ca. 3,0 m (3,8 m med perfekt pop). Det store hoppet er derfor lavere enn målet på 5–7 m, men har lengst lufttid (2,4 s, 2,9 s med pop). Vil Daniel ha det høyere, må rampen på det store hoppet få sparke litt hardere (ca. 2,3 g).

## Pop
| Mål | Verdi |
|---|---|
| Lading | hold mellomrom, fullt etter 0,5 s |
| Pop på flat bakke (ollie) | ca. 5 cm |
| Perfekt pop | slipp innen 0,12 s før kanten, 25 % ekstra kraft |
| Ekstra høyde med perfekt pop | ca. +0,5 m (lite), +0,9 m (medium), +0,8 m (stort) |
| Landing med perfekt pop | fortsatt under 11° |

## Triks (fase 2)
| Mål | Verdi |
|---|---|
| Spinnfart | ca. 540° per sekund (et 720 på et medium hopp) |
| Flipfart | ca. 360° per 0,9 s |
| Grab | holdes for poeng, minst 0,3 s for å telle |
| Landing | ren hvis vinkelen mot bakken er under 25° og spinnet er innenfor ±30° av en hel eller halv runde (switch) |
| Poeng og boost | bare for ekte triks: 540 eller mer, en flip eller en grab |

## Poeng
- Grunnpoeng per halve runde spinn, ekstra for flip, ganget opp av grab og kombinasjon.
- Ren landing gir full sum, slurvete landing halv sum, fall null.

## Kamera
- Lavt og nært bak skiløperen (5–6 m bak, 2 m opp).
- FOV øker med farten (62° til 78°).
- I lufta følger kameraet jevnt uten å snurre med skiløperen.

## Én park
Én ferdig park med en tydelig linje: rails øverst, tre hopp i midten, et stort hopp nederst.
