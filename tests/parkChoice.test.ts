import { describe, expect, it } from 'vitest';
import { bestKey, DEFAULT_PARK, loadBest, loadParkChoice, nextPark, PARK_KEY, parkFromSearch, pickPark, saveBest, saveParkChoice, searchWithPark, type ParkStore } from '../src/park/choice';
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

describe('parkvalg: adressen som reserve, og beste runde per park', () => {
  it('?park= i adressen vinner over lagret valg, og ukjent park i adressen ignoreres', () => {
    const store = memory({ [PARK_KEY]: 'testbakke' });
    expect(loadParkChoice(ids, store, '?park=nybegynner')).toBe('nybegynner');
    expect(loadParkChoice(ids, store, '?park=finnesikke')).toBe('testbakke');
    expect(loadParkChoice(ids, broken, '?park=nybegynner')).toBe('nybegynner');
    expect(loadParkChoice(ids, null, '')).toBe(DEFAULT_PARK);
    expect(parkFromSearch('?a=1&park=testbakke')).toBe('testbakke');
    expect(searchWithPark('?a=1', 'nybegynner')).toBe('?a=1&park=nybegynner');
    expect(searchWithPark('?park=testbakke', 'nybegynner')).toBe('?park=nybegynner');
  });

  it('beste runde lagres per park, bare når den er bedre, og blokkert lagring krasjer ikke', () => {
    const store = memory();
    expect(loadBest('testbakke', store)).toBe(0);
    saveBest('testbakke', 2500, store);
    saveBest('testbakke', 1200, store);
    saveBest('nybegynner', 800, store);
    expect(loadBest('testbakke', store)).toBe(2500);
    expect(loadBest('nybegynner', store)).toBe(800);
    store.data[bestKey('testbakke')] = 'tull';
    expect(loadBest('testbakke', store)).toBe(0);
    expect(loadBest('testbakke', broken)).toBe(0);
    expect(() => saveBest('testbakke', 100, broken)).not.toThrow();
    expect(() => saveBest('testbakke', 100, null)).not.toThrow();
  });
});
