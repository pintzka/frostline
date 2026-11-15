import { loadParkChoice } from './choice';
import { loadPark, type ParkData } from './format';
import nybegynner from './parks/nybegynner.json';
import testbakke from './parks/testbakke.json';

/**
 * Alle parkene i spillet, i den rekkefølgen de vises på startskjermen. Ny park: lag en JSON-fil
 * i src/park/parks/, importer den her og legg den til i lista. Se docs/PARK.md.
 */
export const PARKS: Record<string, ParkData> = {
  nybegynner: loadPark(nybegynner, 'nybegynner.json'),
  testbakke: loadPark(testbakke, 'testbakke.json'),
};

/** Navnene (nøklene) på parkene, i rekkefølge. */
export const PARK_IDS = Object.keys(PARKS);

/**
 * Parken spillet kjører nå: den spilleren valgte sist (husket i localStorage), ellers testbakken.
 * Velges én gang når spillet lastes. Bytter du park, lastes siden på nytt (se ui/menu.ts).
 */
export const CURRENT_PARK_ID = loadParkChoice(PARK_IDS);
export const CURRENT_PARK = PARKS[CURRENT_PARK_ID];
