# Lage egne utfordringer

Utfordringene for en park står i én fil per park: `src/challenges/testbakke.json` og `src/challenges/nybegynner.json`. Endre eller legg til der, du trenger ikke røre koden. Spillet sjekker fila når det starter, og sier på norsk hva som er feil.

```json
{ "id": "stort-720", "text": "Land et rent 720 på det store hoppet", "type": "trick", "spin": 720, "kicker": "Stort" }
```

- `id`: kort navn uten mellomrom. Ikke endre det etterpå, for fremgangen (hakene) lagres med det.
- `text`: teksten spilleren ser.
- `type` og målet:

| type | felt | betyr |
|---|---|---|
| `trick` | `spin` (180, 360, 540 …), `flips` (1–3), `flipDir` (`"back"`/`"front"`), `grabTime` (s), `kicker` (navnet på et hopp) | land et triks **rent** med minst så mye. Bruk minst én av `spin`, `flips`, `grabTime`. |
| `combo` | `mult` (1.25, 1.5, 1.75 …) | nå minst den komboen. Hvert rent ekte triks gir +0,25, så x1,75 trenger tre på rad. |
| `perfectPops` | `count` | perfekt pop (uten fall) på så mange forskjellige hopp i én runde. |
| `time` | `seconds` | kom i mål på under så mange sekunder. Rett ned uten brems tar ca. 27 s. |
| `score` | `points` | få minst så mange poeng i én runde. En god runde gir 3 000–6 000. |

Mer enn 360 teller også for 360 (et 720 klarer begge).

**Ny park:** lag `src/challenges/<parknavn>.json` med `"park": "<parknavn>"`, og legg den til i `src/challenges/index.ts`.
