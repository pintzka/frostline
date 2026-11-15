import { describe, expect, it } from 'vitest';
import { respawnOf, sideAngle, validatePark } from '../src/park/format';
import { CONFIG } from '../src/core/config';
import { createTerrain, heightAt, normalAt, PARK } from '../src/park/terrain';
import testbakke from '../src/park/parks/testbakke.json';
import * as legacy from './legacyTerrain';

/** En dyp kopi av testbakken som en test kan endre på. */
function copy(): any {
  return JSON.parse(JSON.stringify(testbakke));
}

describe('parkformat: testbakken fra JSON', () => {
  // Den frosne kopien er den gamle bakken. Siden da er tre ting bevisst endret:
  // bredere og myke sider på hoppene, slakere platåkant ut mot sidene, og en brattere «bolle» mot kantene.
  // Midt i løypa (der hoppene har full høyde) og på vanlig bakke mellom hoppene skal alt være NØYAKTIG som før,
  // så hopp, pop og landing på midten (air.test, pop.test) gir de samme tallene.
  const centerHalf = Math.min(...PARK.kickers.map((k) => k.width / 2)); // 4,5 m: alle hoppene har full høyde her
  const bowlStart = PARK.width * PARK.edge.start; // 24 m: her begynner bollen
  /** Strekninger (z) uten hopp, der bakken er lik helt ut til bollen. */
  const plain: [number, number][] = [[-20, 148], [218, 260]];

  it('gir nøyaktig samme høyder som den gamle formelen midt i løypa', () => {
    let n = 0;
    for (let z = -20; z <= 620; z += 0.37) {
      for (let x = -centerHalf; x <= centerHalf; x += 0.3) {
        expect(heightAt(x, z)).toBe(legacy.heightAt(x, z));
        n++;
      }
    }
    expect(n).toBeGreaterThan(50000);
  });
  it('gir nøyaktig samme høyder som før på vanlig bakke mellom hoppene, helt ut til bollen', () => {
    for (const [z0, z1] of plain) {
      for (let z = z0; z <= z1; z += 0.53) {
        for (let x = -bowlStart; x <= bowlStart; x += 0.7) expect(heightAt(x, z)).toBe(legacy.heightAt(x, z));
      }
    }
  });
  it('gir nøyaktig samme normaler midt i løypa', () => {
    for (let z = 0; z <= 600; z += 1.7) {
      for (let x = -4.4; x <= 4.4; x += 1.1) expect(normalAt(x, z)).toEqual(legacy.normalAt(x, z));
    }
  });
  it('har de samme tallene for hoppene som før', () => {
    expect(PARK.width).toBe(legacy.PARK.width);
    expect(PARK.length).toBe(legacy.PARK.length);
    // sideWidth og respawn-tallene er nye felt (ikke formen på hoppet), resten skal være likt
    expect(PARK.kickers.map(({ sideWidth: _, respawnBeforeRamp: _b, respawnSpeed: _s, ...k }) => k)).toEqual(legacy.PARK.kickers);
    expect({ height: PARK.deck.height, drop: PARK.deck.drop }).toEqual(legacy.DECK);
    expect(PARK.landing).toEqual(legacy.LANDING);
  });
  it('sidene er nå slakere enn før, og bollen er høyere', () => {
    // ved siden av det store hoppet: før 76° bratt side
    const k = PARK.kickers[2];
    const at = (x: number) => heightAt(x, k.z - 2);
    const steepest = Math.max(...Array.from({ length: 300 }, (_, i) => {
      const x = k.width / 2 + i * 0.1;
      return Math.abs(at(x + 0.05) - at(x - 0.05)) / 0.1;
    }));
    expect((Math.atan(steepest) * 180) / Math.PI).toBeLessThan(35);
    expect(heightAt(40, 100) - heightAt(0, 100)).toBeGreaterThan(legacy.heightAt(40, 100) - legacy.heightAt(0, 100) + 2);
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
    has(errorsFor((p) => (p.kickers[1].sideWidth = 36)), 'bredere enn bakken');
  });
  it('for bratte sider på hoppene', () => {
    // de gamle 3 m brede sidene på det store hoppet var 76° bratte
    const errs = errorsFor((p) => (p.kickers[2].sideWidth = 3));
    has(errs, 'sidene er 75° bratte');
    has(errs, 'Sett "sideWidth" til minst 17 m');
    has(errorsFor((p) => (p.kickers[0].sideWidth = 0)), '"sideWidth" må være større enn 0');
    has(errorsFor((p) => delete p.kickers[0].sideWidth), 'mangler feltet "sideWidth"');
  });
  it('sidene på dagens hopp er slake nok', () => {
    for (const k of PARK.kickers) expect(sideAngle(k)).toBeLessThan(30);
  });
  it('rare tall for bakken', () => {
    has(errorsFor((p) => (p.deck.sideDrop = -1)), '"deck.sideDrop" kan ikke være negativ');
    has(errorsFor((p) => (p.width = 5)), '"width" er 5 m');
    has(errorsFor((p) => (p.deck.height = 2)), '"deck.height" er 2');
    has(errorsFor((p) => (p.landing.runout = 0)), '"landing.runout" må være større enn 0');
  });
  it('en park uten hopp er gyldig', () => {
    expect(errorsFor((p) => (p.kickers = []))).toEqual([]);
  });

  it('et 4. hopp uten respawn-tall er gyldig og får standardverdier (ikke NaN)', () => {
    const p = copy();
    p.length = 800;
    p.kickers.push({ name: 'Ekstra', z: 600, lipDeg: 21, radius: 75, width: 10, sideWidth: 20, landingStart: 37, landingDeg: 15 });
    expect(validatePark(p)).toEqual([]);
    const back = respawnOf(p.kickers[3]);
    expect(back).toEqual({ before: CONFIG.fallRespawnBeforeDefault, speed: CONFIG.fallRespawnSpeedDefault });
    expect(Number.isFinite(back.before) && Number.isFinite(back.speed)).toBe(true);
  });

  it('respawn-tall som ikke gir mening', () => {
    has(errorsFor((p) => (p.kickers[1].respawnSpeed = -1)), 'respawnSpeed');
    has(errorsFor((p) => (p.kickers[1].respawnSpeed = 99)), 'respawnSpeed');
    has(errorsFor((p) => (p.kickers[1].respawnBeforeRamp = 5)), 'respawnBeforeRamp');
    // begge eller ingen
    has(errorsFor((p) => delete p.kickers[1].respawnSpeed), 'eller ingen av dem');
    has(errorsFor((p) => (p.kickers[1].respawnSpeed = 'fort')), 'respawnSpeed');
    // så langt tilbake at du havner oppe på hoppet over
    has(errorsFor((p) => (p.kickers[1].respawnBeforeRamp = 80)), 'oppe på «Lite»');
  });
});
