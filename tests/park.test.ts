import { describe, expect, it } from 'vitest';
import { validatePark } from '../src/park/format';
import { createTerrain, heightAt, normalAt, PARK } from '../src/park/terrain';
import testbakke from '../src/park/parks/testbakke.json';
import * as legacy from './legacyTerrain';

/** En dyp kopi av testbakken som en test kan endre på. */
function copy(): any {
  return JSON.parse(JSON.stringify(testbakke));
}

describe('parkformat: testbakken fra JSON', () => {
  it('gir nøyaktig samme høyder som den gamle formelen', () => {
    let n = 0;
    for (let z = -20; z <= 620; z += 0.37) {
      for (let x = -50; x <= 50; x += 1.3) {
        expect(heightAt(x, z)).toBe(legacy.heightAt(x, z));
        n++;
      }
    }
    expect(n).toBeGreaterThan(100000);
  });
  it('gir nøyaktig samme normaler', () => {
    for (let z = 0; z <= 600; z += 1.7) {
      for (let x = -40; x <= 40; x += 4.1) expect(normalAt(x, z)).toEqual(legacy.normalAt(x, z));
    }
  });
  it('har de samme tallene som før', () => {
    expect(PARK.width).toBe(legacy.PARK.width);
    expect(PARK.length).toBe(legacy.PARK.length);
    expect(PARK.kickers).toEqual(legacy.PARK.kickers);
    expect(PARK.deck).toEqual(legacy.DECK);
    expect(PARK.landing).toEqual(legacy.LANDING);
  });
  it('er gyldig', () => {
    expect(validatePark(testbakke)).toEqual([]);
  });
  it('createTerrain lager en egen bakke for en annen park', () => {
    const p = copy();
    p.kickers = [];
    const flat = createTerrain(p);
    expect(flat.heightAt(0, 290)).not.toBe(heightAt(0, 290));
  });
});

describe('parkformat: validering', () => {
  /** Endrer en kopi, og gir feilmeldingene. */
  function errorsFor(change: (p: any) => void): string[] {
    const p = copy();
    change(p);
    return validatePark(p);
  }
  const has = (errs: string[], text: string) => expect(errs.some((e) => e.includes(text)), errs.join('\n')).toBe(true);

  it('ikke en park i det hele tatt', () => {
    expect(validatePark(null).length).toBe(1);
    expect(validatePark([]).length).toBe(1);
  });
  it('manglende felt', () => {
    has(errorsFor((p) => delete p.width), 'mangler feltet "width"');
    has(errorsFor((p) => delete p.kickers[1].lipDeg), 'Hopp nr. 2 («Medium»): mangler feltet "lipDeg"');
    has(errorsFor((p) => delete p.landing.steep), '"landing": mangler feltet "steep"');
  });
  it('feil type og feilstavede felt', () => {
    has(errorsFor((p) => (p.kickers[0].z = '160')), '"z" må være et tall');
    has(errorsFor((p) => (p.kickers[0].lipdeg = 12)), 'ukjent felt "lipdeg"');
    has(errorsFor((p) => (p.kickers[0].name = '')), '"name" må være tekst');
    has(errorsFor((p) => (p.kickers = {})), '"kickers" må være en liste');
  });
  it('umulige vinkler', () => {
    has(errorsFor((p) => (p.kickers[0].lipDeg = 70)), 'umulig');
    has(errorsFor((p) => (p.kickers[0].lipDeg = 0)), '"lipDeg" er 0°');
    has(errorsFor((p) => (p.kickers[2].landingDeg = 45)), '"landingDeg" er 45°');
  });
  it('hopp som overlapper hverandre', () => {
    has(errorsFor((p) => (p.kickers[1].z = 220)), '«Medium» overlapper «Lite»');
  });
  it('hopp i feil rekkefølge', () => {
    has(errorsFor((p) => (p.kickers[2].z = 280)), 'må stå lenger ned enn «Medium»');
  });
  it('hopp forbi slutten av bakken', () => {
    has(errorsFor((p) => (p.kickers[2].z = 540)), 'kjøringen stopper ved 560 m');
    has(errorsFor((p) => (p.length = 520)), 'Flytt hoppet opp');
  });
  it('hopp helt øverst før skiløperen har fart', () => {
    has(errorsFor((p) => (p.kickers[0].z = 15)), 'før skiløperen har fått fart');
  });
  it('landing som starter før kanten', () => {
    has(errorsFor((p) => (p.kickers[0].landingStart = 0.5)), '"landingStart" må være større');
    has(errorsFor((p) => (p.kickers[0].landingStart = -3)), '"landingStart" må være større');
  });
  it('like navn og for brede hopp', () => {
    has(errorsFor((p) => (p.kickers[1].name = 'Lite')), 'To hopp heter «Lite»');
    has(errorsFor((p) => (p.kickers[0].width = 78)), 'bredere enn bakken');
  });
  it('rare tall for bakken', () => {
    has(errorsFor((p) => (p.width = 5)), '"width" er 5 m');
    has(errorsFor((p) => (p.deck.height = 2)), '"deck.height" er 2');
    has(errorsFor((p) => (p.landing.runout = 0)), '"landing.runout" må være større enn 0');
  });
  it('en park uten hopp er gyldig', () => {
    expect(errorsFor((p) => (p.kickers = []))).toEqual([]);
  });
});
