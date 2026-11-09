# Frostline: review mot cork7 og plan for ny versjon

Opprinnelig review 9. november 2026 (Claude Doc: https://claude.ai/artifact/Uoh2nnVusrBWLT7T4vmxoi). Kopiert hit så Claude Code har planen i repoet.

## Konklusjon

Frostline v7 er en teknisk prototype, ikke et spill. Cork7 er et levende produkt med 7 baner, rangerte moduser, sesongpass, replay-editor og flere oppdateringer i uka. Frostline har 1 bane på 1,1 km, ingen rails, ingen lyd verdt navnet og en pinnefigur som skiløper.

Gapet skyldes først og fremst arbeidsmåten, ikke enkeltfeil. Spillet ble bygget i en chattråd, i én HTML-fil på 1 MB, uten at noen spilte det i sanntid mellom endringene. Sju versjoner på én dag ga brå kursendringer og nye feil hver gang.

Anbefalingen er å bygge på nytt fra bunnen i et ordentlig kodeprosjekt i Claude Code. Det betyr TypeScript, git, automatiske tester og en spillbar build etter hver endring. Arbeidet deles i 8 parallelle arbeidsstrømmer med faste porter der Daniel spiller og godkjenner. Målet er ikke å kopiere cork7, men å nå samme nivå av håndverk med eget innhold.

## Hvordan reviewen ble gjort

Cork7 er vurdert ut fra deres egne sider om spillet, tre tredjeparts spillguider og Daniels beskrivelser. Jeg fikk ikke spilt cork7 selv. Nettverket i skymiljøet mitt blokkerer cork7.com, så jeg har ikke sett grafikken eller kjent på fysikken direkte. Vurderingene av utseende og følelse bygger på deres beskrivelser og på at du og Daniel har spilt begge.

Frostline v7 er vurdert ut fra koden, automatiske testkjøringer og bilde-for-bilde-opptak av hopp og landinger.

Kilder: [How to play](https://cork7.com/how-to-play), [About](https://cork7.com/about), [Patch notes](https://cork7.com/updates), [cork7.org guide](https://cork7.org/), [Browsergamehub guide](https://browsergamehub.io/games/cork7), [Opengame-guide](https://opengame.app/blog/cork7-guide).

**Tillegg 9. november, fra Daniels PC.** En kort test av cork7 i en ekte nettleser på Daniels PC. Spillet frøs etter 6 sekunder fordi nettleservinduet var skjult. Fart, sving, rotasjon og landing ble derfor ikke testet. Dette ble faktisk observert:

- **Kamera:** Lavt og tett bak. Rideren fyller omtrent halve skjermhøyden, og horisonten ligger like over midten. Frostline har kameraet 6–8 m bak og 2,6 m over, så rideren blir liten og sett ovenfra.
- **Rider:** Troverdige proporsjoner, jakke i fargefelt, vide bukser og detaljerte ski. Frostline har boksstøvler og tynne lemmer.
- **Snø:** Synlige preparerte riller, kjølig blå skyggelegging og myk, gjennomskinnelig sprut. Frostline har flat farge og firkantede partikler.
- **Himmel og fjern:** Malte skyer og fjellrekker i lag som forsvinner i dis. Frostline har bare gradient og tåke.
- **Miljø og UI:** Liftstasjon med gondoler, startport, sikkerhetsnett og lysmaster. Egen display-font, illustrert parkkart, designet lasteskjerm og en HUD med minikart, gjenstående distanse og fartsmåler.

Kamera, rider og snø med sprut ser ut til å stå for mye av det billige inntrykket, og bør prioriteres først i fase 1 og 3.

## Review: design

Frostline ser ut som en teknisk demo. Cork7 har en tydelig visuell identitet, tre grafikknivåer og lyd tatt opp i felt.

| Område | cork7 | Frostline v7 | Gap |
| --- | --- | --- | --- |
| Skiløper | Stilisert rider, mann eller kvinne, mange klær og ski i Locker | Pinnefigur laget av rør i Blender via skript, bare jakkefarge | Stort |
| Snø og terreng | Preparert snø med mønster og skispor, fint snøspray (Ultra) | Flat farget flate uten tekstur, ingen spor, ingen snøspray i v7 | Stort |
| Lys og vær | Dynamisk vær, snøfall, tåke og lysendringer | Én fast sol og en enkel himmelgradient | Stort |
| Miljø | Bygd park med rails, gondol, landsby, skog og superpipe | Kjegletrær, flagg og to porter | Stort |
| Lyd | Feltopptak av snø, vind, rails og landinger, musikk i lobby | Syntetisk støy og to pip laget i kode | Stort |
| Meny og flyt | Basecamp, Locker, Shop, Pass, rangert, parkkart, gondol | Ett kort med kontroller og en Ride-knapp | Stort |
| HUD og triksfeedback | Fart, poeng, linjemultiplikator, landingsbonus | Poeng, fart og en enkel tekstpopup | Middels |
| Kamera | Chase med innstillinger, FOV etter fart, drone, trikskamera, førsteperson | Én chase-kamera uten innstillinger | Middels |
| Ytelse og innstillinger | Performance, High og Ultra, FPS-visning, mobilmodus | Ingen innstillinger, ingen mobilstøtte | Middels |
| Typografi og merkevare | Egen fargeprofil og logo | Systemfont og en enkel ordlogo | Middels |

## Review: innhold

Cork7 har rundt 20 km park fordelt på 7 baner. Frostline har 1,1 km og 10 hopp.

| Område | cork7 | Frostline v7 | Gap |
| --- | --- | --- | --- |
| Baner | 7 parker: åpen park, pro-park, puddersnø, railskog, big air, superpipe og landsbygate | 1 bane, 1,1 km, 10 kickere | Stort |
| Rails og bokser | 5 til 8 railsoner per park, 750 poeng per sekund | Ingen (fjernet i v7) | Stort |
| Triksbredde | Spinn, flips, roll, cork, bio, rodeo, misty, butters, 8+ grabs | Spinn, front- og bakflip, cork, misty, 3 grabs, ingen roll | Stort |
| Moduser | Solo, multiplayer med 30 ridere, 1v1, 2v2, rangert med nivåer | Bare solo | Stort |
| Progresjon | Sesongpass med 100 nivåer, POW-valuta, butikk | Bare beste poengsum lagret lokalt | Stort |
| Kosmetikk | Jakke, bukse, hjelm, briller, ski, staver, grab-stiler, lagrede antrekk | 6 jakkefarger | Stort |
| Replays | Siste 5 runs lagres, klipperedigering, frikamera, MP4-eksport | Ingen | Stort |
| Sosialt | Venner, party, chat, gaver, Discord | Ingen | Stort |
| Kontrollere | Tastatur, gamepad og touch, alt kan endres | Bare tastatur | Middels |
| Utviklingstakt | Rundt 60 oppdateringer siste 4 uker | 7 versjoner på én dag, så stopp | Stort |

Multiplayer, rangering og butikk er store systemer med server og moderering. De hører ikke hjemme i første versjon av et nytt Frostline.

## Review: gameplay

Frostline v7 er stabilt, men flatt. Systemet tar for mange avgjørelser for spilleren, og det finnes lite å mestre.

| Område | cork7 | Frostline v7 | Gap |
| --- | --- | --- | --- |
| Skifysikk | Fart bygges i fallet, carving og skrens føles forskjellig | Retning pluss én fartsverdi. Ingen kanting, skrens eller vekt | Stort |
| Rotasjon i lufta | Spilleren styrer hele rotasjonen og kan under- eller overrotere | Rotasjonen fullføres automatisk når tasten slippes. Det fjerner ferdighet | Stort |
| Off-axis-triks | Cork, bio, rodeo og misty krever input innen 0,25 s etter avsats | Spinn og flip er to uavhengige akser. Cork er bare en kombinasjon | Middels |
| Landing | Rett, sidelengs eller switch gir ulik score. Auto-landing kan slås av og på | Ren, sketchy eller fall ut fra vinkel. Ingen ekte kontakt mellom ski og bakke | Middels |
| Linjer og kombo | Hvert hopp eller rail i rekke gir +0,25x, lagres når du lander på snø | Ingen kombo (fjernet i v7) | Stort |
| Belønning | Spinnpoeng stiger bratt (360 = 1500, 1080 = 13 500). Repetisjon straffes | Flate poeng, enkel repetisjonsstraff | Middels |
| Fall | Mister linja, tydelig og rask retur | Kroppen blir stiv og glir, så respawn midt i løypa | Middels |
| Hoppdesign | Kickere med riktig landing for gitt fart, pro-park for presisjon | Hopp og landinger regnet ut fra en formel, ikke designet og testet for hvert hopp | Stort |
| Kamera | Fart styrer synsfelt, trikskamera på store hopp | Fast avstand og vinkel | Middels |
| Tuning | Mange dokumenterte justeringer basert på spillere | Tallene ble satt av meg og testet av en autopilot, ikke av folk | Stort |

## Rotårsaker

De fleste svakhetene kommer fra seks valg i arbeidsmåten. De må rettes før ny kode skrives, ellers blir resultatet det samme.

1. **Ingen spilling i sanntid.** Jeg testet med autopilot og stillbilder i en nettleser uten skjermkort. Spillfølelse, som respons, vekt og timing, kan ikke måles slik. Daniel var eneste ekte tester, og han fikk nye versjoner med timers mellomrom.
2. **Feil format.** Alt lå i én HTML-fil på 1 MB, med figuren lagt inn som base64. Det var ingen moduler, ingen typer, ingen git-historikk og ingen tester. Hver endring var et tekstlapp-skript mot forrige fil, og det gjorde at én feil ble byttet mot en annen.
3. **For lite designarbeid før koding.** Det fantes aldri et designdokument med mål for fart, lufttid, rotasjonstempo, poengkurver og hoppdimensjoner. Tallene ble gjettet og justert etter hver klage.
4. **Kunst laget av kode alene.** Figuren og animasjonene ble laget med Blender-skript uten et menneske eller en referanse som vurderte resultatet. Terreng og trær er geometriske grunnformer uten teksturer.
5. **Hastighet foran kvalitet.** Sju versjoner på én dag, med store kursendringer: fire baner ble til én, rails kom og forsvant, og kombo forsvant i v7. Hver ny start mistet det som virket.
6. **To agenter i samme kode.** Skyøkta og økta på Daniels PC lagde parallelle versjoner av samme skript, med navnekollisjoner og dobbeltarbeid. Ingen hadde eierskap til helheten.

## 10 forslag: design

1. **Egen visuell retning før første modell.** Et moodboard og en stilguide med palett, lys, form og typografi, godkjent av Daniel. For eksempel kald nordisk skumring med varme lysflekker, som skiller seg fra cork7.
2. **Ny skiløper med ekte proporsjoner.** En modell med klær i lag, hjelm, briller og ski med bindinger, ca. 8–15 000 trekanter. Bruk en ferdig rig og lisensierte bevegelser (gratis med åpen lisens, f.eks. Quaternius CC0) som utgangspunkt i stedet for skript-rør.
3. **Snø med tekstur.** Preparert mønster, normalkart og glitter. Skispor som tegnes i sanntid bak spilleren.
4. **Partikler som føles.** Snøsprut ved carving, brems og landing, snøfokk i fart, pudderskyer ved fall. Bruk GPU-partikler så det tar lite ytelse.
5. **Lys og etterbehandling.** Fysisk basert lys, skyggekaskader, myk bloom, fargegradering og hastighetsuskarphet. Tre kvalitetsnivåer fra start.
6. **Bygde parkelementer.** Kickere, bokser, rails, gondol, trær og hytter som egne modeller med materialer, ikke som hump i et høydekart.
7. **Ekte lyd.** Lisensierte eller egne opptak av snø, vind, landing, rail og publikum. Lag lyden etter fart og underlag, og legg til musikk i menyen.
8. **Ordentlig meny og flyt.** Startskjerm med figuren i scenen, parkkart, garderobe, innstillinger og resultatskjerm med beste triks og replay-knapp.
9. **Tydelig HUD.** Fart, poeng, linjemultiplikator, triksnavn i stor stil, en indikator for landing og et lite kart. Alt bør være lesbart på mobil.
10. **Kamera som forteller.** Synsfeltet øker med farten, kameraet trekker seg ut på store hopp og vender tilbake mykt etter landing. En replay-modus med flere kameravinkler.

## 10 forslag: innhold

1. **To håndlagde parker i første versjon.** En nybegynnerpark med små hopp og bokser, og en hovedpark på 2,5–3 km med tre linjer (liten, medium, stor). Kvalitet foran antall.
2. **Parkeditor som internt verktøy.** Hopp, rails og landinger plasseres som objekter i et JSON-format med forhåndsvisning. Da kan nye baner lages uten ny kode, og Daniel kan designe selv.
3. **Rails og bokser tilbake, gjort skikkelig.** Rette, knekte og buede rails, bokser og wallride. Balanse, slide-varianter og avhopp med spinn.
4. **Flere triks.** Roll og sideflip på piltastene, off-axis-varianter (cork, bio, rodeo, misty), butters på snøen og 6–8 grabs med tydelige stillinger.
5. **Utfordringer per bane.** For eksempel: lande en 720, holde en grab i 1 sekund eller fullføre under 1:30. Det gir korte mål å jakte på.
6. **Progresjon uten butikk.** XP og nivåer som låser opp klær, ski, farger og nye parker. Ingen ekte penger og ingen valuta i første runde.
7. **Garderobe.** Jakke, bukse, hjelm, briller og ski med egne design. Antrekk lagres på kontoen.
8. **Replays.** Siste run lagres automatisk og kan spilles av med 2–3 kameravinkler. Eksport til video kan komme senere.
9. **Toppliste og ghost.** Beste run per bane mot familie og venner, med en ghost-skiløper. Gjenbruk innlogging og server fra sjakk.pintzka.com.
10. **Mobil og gamepad.** Touch-kontroller og gamepad, med mulighet for egne knapper. Da kan Daniel og vennene spille på alle enheter.

Multiplayer i sanntid, rangert spill og butikk anbefales ikke før grunnspillet er bedre enn i dag.

## 10 forslag: gameplay

1. **Designdokument med måltall før koding.** Toppfart, akselerasjon, svingradius, lufttid per hoppstørrelse, rotasjonstempo og poengkurver. Alt tuning måles mot disse tallene.
2. **Ekte skimodell.** Kanting, carving mot skrens, vektoverføring og kompresjon i ujevnt terreng. Ski som følger bakken med to kontaktpunkter, ikke ett punkt.
3. **Full spillerkontroll i lufta.** Fjern automatisk fullføring. Rotasjonen fortsetter med fart og bremses når du slipper. Under- og overrotasjon må være mulig og straffes. En valgfri "assistert" modus for nybegynnere.
4. **Avsats-vindu for off-axis.** Input innen 0,2–0,3 s etter avsats bestemmer om det blir cork, bio, rodeo eller misty. Det gir dybde uten flere taster.
5. **Landing med ekte kontakt.** Vinkelen mellom ski og bakke, fart sidelengs og switch avgjør om landingen er perfekt, ren, sketchy eller fall. Tydelig lyd og visuell feedback for hver.
6. **Linjer og kombo.** Hopp, rails og butters i rekke bygger multiplikator. Den lagres når du lander rent på snø, og mistes ved fall. Det er hovedmotivasjonen for å kjøre hele banen.
7. **Bratt poengkurve og variasjonsbonus.** Store triks skal lønne seg mye mer enn små. Repetisjon gir lavere poeng, og nye retninger, switch og nye grabs gir full verdi.
8. **Pop-timing som ferdighet.** Hold for å lade, slipp ved avsatsen. Perfekt timing gir mer høyde og en liten "perfect pop"-markering.
9. **Fall som føles rettferdig.** Enkel ragdoll eller tumle-animasjon, rask retur på under 1,5 s og respawn før hoppet. Et øyeblikks-replay av fallet kan være med.
10. **Spilltest-sløyfe.** Hver build er spillbar på en lenke innen minutter. Daniel spiller 10 minutter og svarer på 3 faste spørsmål. Opptak av input gjør at en feil kan spilles av og rettes nøyaktig.

## Plan for gjennomføring

Spillet bygges på nytt i seks faser. Ingen fase starter før porten før den er bestått. Fase 0 låser grensesnittene mellom delene, slik at agentene kan jobbe parallelt uten å gå i beina på hverandre.

Fasene: 0 Oppsett og design → 1 Kjøre på ski → 2 Luft og triks → 3 Utseende og lyd (parallelt fra fase 1) → 4 Innhold → 5 Lansering. Daniel spiller og godkjenner ved hver port.

Kunst og lyd (fase 3) jobber parallelt fra fase 1 og leverer inn i grensesnittene fra fase 0.

| Arbeidsstrøm | Agentens ansvar | Starter i fase | Leverer |
| --- | --- | --- | --- |
| 1. Kjernefysikk | Skimodell, kanting, fart, hopp, landing | 1 | Fysikkmodul med enhetstester mot måltallene |
| 2. Kamera og input | Tastatur, gamepad, touch, kamera og FOV | 1 | Inputlag og kamera-rig |
| 3. Triks og poeng | Rotasjon, off-axis, grabs, linjer, rails, butters | 2 | Triksmotor og poengtabell |
| 4. Karakter og animasjon | Skiløper, rig, 30+ animasjoner, blanding | 1 | glTF-filer og animasjonsgraf |
| 5. Park og verktøy | Terreng, hopp, rails, parkeditor, 2 parker | 1 | Parkformat (JSON) og editor |
| 6. Grafikk og effekter | Snø, lys, partikler, spor, kvalitetsnivåer | 1 | Renderoppsett og shadere |
| 7. Lyd | Snø, vind, landing, rails, musikk, miksing | 1 | Lydmotor og lydfiler |
| 8. UI og flyt | Meny, HUD, garderobe, resultater, replays | 2 | Skjermer og HUD |
| Kvalitet (hele tiden) | Testkjøringer, input-opptak, ytelse, regresjoner | 0 | Testsuite som må være grønn før sammenslåing |

En ledende agent eier designdokumentet, slår sammen arbeidet og sjekker helheten. Hver strøm leverer små pull requests mot felles repo. Hver pull request får en spillbar forhåndsvisningslenke.

Reglene som hindrer at vi bytter én feil mot en annen:

- Ingen endring uten en test som viser at den virker, og at ingenting annet ble ødelagt.
- Daniel spiller ved hver port og svarer på de samme tre spørsmålene hver gang.
- Én agent eier hver fil. Endringer på tvers går via den ledende agenten.

## Bør prosjektet flyttes til Claude Code?

Ja. Et spill på dette nivået trenger et ekte kodeprosjekt, og det får det ikke i en chattråd.

- **Eget repo.** For eksempel `pintzka/frostline` på GitHub, med Vite, TypeScript og three.js i moduler, og figurer og lyd som egne filer. Git-historikk gjør at en dårlig endring kan rulles tilbake på sekunder.
- **Forhåndsvisning per endring.** Cloudflare Pages gir en egen lenke for hver gren, slik som for sjakk.pintzka.com. Daniel kan spille hver endring før den slås sammen.
- **Parallelle agenter.** Claude Code kan kjøre flere agenter i hver sin worktree mot samme repo, med pull requests og automatiske tester som port. Det er den riktige måten å dele arbeidet på.
- **Ekte spilltesting.** Claude Code på Daniels PC kan kjøre spillet lokalt med skjermkort og direkte oppdatering. Skyøkter kan ikke det, og de når heller ikke cork7.com.
- **Blender i samme løp.** Modell- og animasjonsskript ligger i repoet og bygges til filer automatisk, i stedet for å sendes mellom økter.

Denne tråden egner seg fortsatt til beslutninger, review og å samle tilbakemeldinger fra Daniel.

Besluttet 9. november: repoet ligger på Carls GitHub (offentlig), Daniel jobber fra sin PC, og vi bruker bare gratis ressurser med åpen lisens (helst CC0, ingen NC/ND, alt føres i ASSETS.md).
