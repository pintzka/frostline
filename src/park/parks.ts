import { loadPark, type ParkData } from './format';
import testbakke from './parks/testbakke.json';

/**
 * Alle parkene i spillet. Ny park: lag en JSON-fil i src/park/parks/,
 * importer den her og legg den til i lista. Se docs/PARK.md.
 */
export const PARKS: Record<string, ParkData> = {
  testbakke: loadPark(testbakke, 'testbakke.json'),
};

/** Parken spillet kjører nå. */
export const CURRENT_PARK = PARKS.testbakke;
