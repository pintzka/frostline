import { CURRENT_PARK_ID, PARKS } from '../park/parks';
import { loadChallenges, type Challenge } from './format';
import testbakke from './testbakke.json';

/**
 * Utfordringene for hver park. Ny park: lag en JSON-fil her i src/challenges/,
 * importer den og legg den til i lista under. Se docs/UTFORDRINGER.md.
 */
const FILES: Record<string, unknown> = {
  testbakke,
};

/** Utfordringene per park (navnet på parkfila). Hver fil sjekkes mot parken sin. */
export const CHALLENGES: Record<string, Challenge[]> = Object.fromEntries(
  Object.entries(FILES).map(([key, data]) => {
    const park = PARKS[key];
    if (!park) throw new Error(`Utfordringer for «${key}», men det finnes ingen park med det navnet i src/park/parks.ts.`);
    const file = loadChallenges(data, park, `${key}.json (utfordringer)`);
    if (file.park !== key) throw new Error(`${key}.json (utfordringer): "park" er «${file.park}», men skal være «${key}».`);
    return [key, file.challenges];
  }),
);

/** Utfordringene for parken spillet kjører nå (tom liste hvis den ikke har noen). */
export const CURRENT_CHALLENGES: Challenge[] = CHALLENGES[CURRENT_PARK_ID] ?? [];
