import { describe, expect, it } from 'vitest';
import { DEFAULT_PARK, loadParkChoice, nextPark, PARK_KEY, pickPark, saveParkChoice, type ParkStore } from '../src/park/choice';
import { CURRENT_PARK, CURRENT_PARK_ID, PARK_IDS, PARKS } from '../src/park/parks';

/** En liten lagring i minnet, som localStorage. */
function memory(start: Record<string, string> = {}): ParkStore & { data: Record<string, string> } {
  const data = { ...start };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}
/** En lagring som alltid kaster feil (f.eks. privat vindu eller blokkert lagring). */
const broken: ParkStore = {
  getItem() { throw new Error('blokkert'); },
  setItem() { throw new Error('blokkert'); },
};

const ids = ['testbakke', 'nybegynner'];

describe('parkvalg', () => {
  it('lista har begge parkene, og testbakken er standard', () => {
    expect(PARK_IDS).toContain('testbakke');
    expect(PARK_IDS).toContain('nybegynner');
    expect(DEFAULT_PARK).toBe('testbakke');
    expect(PARKS.nybegynner.name).toBe('Nybegynner');
  });

  it('uten lagret valg (som i testene) kjører testbakken', () => {
    expect(CURRENT_PARK_ID).toBe('testbakke');
    expect(CURRENT_PARK).toBe(PARKS.testbakke);
  });

  it('bruker parken som er lagret', () => {
    expect(loadParkChoice(ids, memory({ [PARK_KEY]: 'nybegynner' }))).toBe('nybegynner');
  });

  it('ukjent, tomt eller manglende valg gir standardparken', () => {
    expect(pickPark(ids, null)).toBe('testbakke');
    expect(pickPark(ids, '')).toBe('testbakke');
    expect(pickPark(ids, 'finnes-ikke')).toBe('testbakke');
    expect(loadParkChoice(ids, memory())).toBe('testbakke');
    expect(loadParkChoice(ids, null)).toBe('testbakke');
    // finnes ikke standardparken i lista, brukes den første
    expect(pickPark(['a', 'b'], null)).toBe('a');
  });

  it('husker valget', () => {
    const store = memory();
    expect(saveParkChoice('nybegynner', store)).toBe(true);
    expect(store.data[PARK_KEY]).toBe('nybegynner');
    expect(loadParkChoice(ids, store)).toBe('nybegynner');
  });

  it('krasjer ikke når lagringen er blokkert', () => {
    expect(loadParkChoice(ids, broken)).toBe('testbakke');
    expect(saveParkChoice('nybegynner', broken)).toBe(false);
    expect(saveParkChoice('nybegynner', null)).toBe(false);
  });

  it('bla til neste og forrige park, rundt i ring', () => {
    expect(nextPark(ids, 'testbakke', 1)).toBe('nybegynner');
    expect(nextPark(ids, 'nybegynner', 1)).toBe('testbakke');
    expect(nextPark(ids, 'testbakke', -1)).toBe('nybegynner');
    expect(nextPark(ids, 'ukjent', 1)).toBe('testbakke');
  });
});
