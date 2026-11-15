import { describe, expect, it } from 'vitest';
import { applyEvent, createRunProgress, gameEvents, kickerAt, matchesTrick, type ChallengeEvent } from '../src/challenges/check';
import { validateChallenges, type Challenge } from '../src/challenges/format';
import { CHALLENGES, CURRENT_CHALLENGES } from '../src/challenges/index';
import { isCleared, markCleared, parseProgress, serializeProgress } from '../src/challenges/progress';
import data from '../src/challenges/testbakke.json';
import { PARK } from '../src/park/terrain';
import { judgeLanding } from '../src/tricks/rotation';
import { rideRun, type JumpPlan } from './rideBot';

const DEG = Math.PI / 180;
const list = CHALLENGES.testbakke;
const byId = (id: string) => list.find((c) => c.id === id)!;
const land = (spinDeg: number, flipDeg: number, extra: Parameters<typeof judgeLanding>[2] = {}) =>
  judgeLanding(spinDeg * DEG, flipDeg * DEG, { airTime: 1.5, ...extra });

/** Kjører en hel runde med ekte fysikk og gir id-ene som ble klart, i rekkefølge. */
function clearedIn(plans: (JumpPlan | null)[]): string[] {
  const run = createRunProgress();
  const got: string[] = [];
  rideRun(plans, (g, ev) => {
    for (const e of gameEvents(g, ev, PARK)) got.push(...applyEvent(run, list, e));
  });
  return got;
}

describe('utfordringsfila', () => {
  it('testbakken har 6–8 gyldige utfordringer, og den er parken som kjører nå', () => {
    expect(validateChallenges(data, PARK)).toEqual([]);
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(list.length).toBeLessThanOrEqual(8);
    expect(CURRENT_CHALLENGES).toBe(list);
  });

  it('gir forståelige feil for skrivefeil og mål som ikke går an', () => {
    const bad = (c: Record<string, unknown>) => validateChallenges({ park: 'testbakke', challenges: [{ id: 'a', text: 'A', ...c }] }, PARK).join('\n');
    expect(bad({ type: 'flip' })).toContain('"type" må være');
    expect(bad({ type: 'trick', spin: 400 })).toContain('180, 360, 540');
    expect(bad({ type: 'trick', spin: 720, kicker: 'Gigant' })).toContain('«Gigant»');
    expect(bad({ type: 'trick', spinn: 360 })).toContain('feilstavet');
    expect(bad({ type: 'trick' })).toContain('minst én');
    expect(bad({ type: 'combo', mult: 2 })).toContain('bare 3 hopp');
    expect(bad({ type: 'combo', mult: 1.6 })).toContain('steg');
    expect(bad({ type: 'perfectPops', count: 4 })).toContain('fra 1 til 3');
    expect(bad({ type: 'time' })).toContain('"seconds"');
    expect(bad({ type: 'score', points: '3000' })).toContain('et tall');
    const twice = validateChallenges({ park: 'x', challenges: [{ id: 'a', text: 'A', type: 'time', seconds: 30 }, { id: 'a', text: 'B', type: 'time', seconds: 20 }] }, PARK);
    expect(twice.join('\n')).toContain('forskjellige id-er');
    expect(validateChallenges([], PARK)[0]).toContain('"park"');
  });
});

describe('sjekk av hver type', () => {
  it('triks: må være ren landing, nok rotasjon, riktig flip-retning og hopp', () => {
    const c360 = byId('ren-360'), back = byId('backflip'), big = byId('stort-720');
    expect(matchesTrick(c360, land(360, 0), null)).toBe(true);
    expect(matchesTrick(c360, land(720, 0), null)).toBe(true);
    expect(matchesTrick(c360, land(180, 0), null)).toBe(false);
    // 360 med 40° for mye er slurvete, og teller ikke
    expect(matchesTrick(c360, land(400, 0), null)).toBe(false);
    expect(matchesTrick(back, land(0, -360), null)).toBe(true);
    expect(matchesTrick(back, land(0, 360), null)).toBe(false);
    expect(matchesTrick(big, land(720, 0), 'Stort')).toBe(true);
    expect(matchesTrick(big, land(720, 0), 'Medium')).toBe(false);
  });

  it('grab: må telle og holdes lenge nok, og landingen må være ren', () => {
    const c = byId('grab-1s');
    expect(matchesTrick(c, land(0, 0, { grab: 1, grabTime: 1.1 }), null)).toBe(true);
    expect(matchesTrick(c, land(0, 0, { grab: 1, grabTime: 0.8 }), null)).toBe(false);
    expect(matchesTrick(c, land(0, 0, { grab: 1, grabTime: 1.1, stillGrabbing: true }), null)).toBe(false);
  });

  it('kombo, poeng og tid', () => {
    const run = createRunProgress();
    const ev = (e: ChallengeEvent) => applyEvent(run, list, e);
    expect(ev({ type: 'score', total: 100, combo: 1.25 })).toEqual([]);
    expect(ev({ type: 'score', total: 2999, combo: 1.5 })).toEqual(['kombo-1-5']);
    // hver utfordring klares bare én gang per runde
    expect(ev({ type: 'score', total: 2999, combo: 1.75 })).toEqual([]);
    expect(ev({ type: 'finish', time: 28.4, total: 3000 })).toEqual(['poeng-3000']);
    expect(ev({ type: 'start' })).toEqual([]);
    expect(run.cleared).toEqual([]);
    expect(ev({ type: 'finish', time: 27.5, total: 0 })).toEqual(['tid-28']);
  });

  it('perfekt pop teller hvert hopp én gang, og ikke hvis du falt', () => {
    const run = createRunProgress();
    const pop = (kicker: string | null, spin = 0) => applyEvent(run, list, { type: 'landing', landing: land(spin, 0, { perfectPop: true }), kicker });
    expect(pop('Lite')).toEqual([]);
    expect(pop('Lite')).toEqual([]);
    expect(pop(null)).toEqual([]);
    expect(pop('Medium', 90)).toEqual([]); // fall
    expect(pop('Medium')).toEqual([]);
    expect(pop('Stort')).toEqual(['perfekt-pop-alle']);
  });

  it('finner hoppet ut fra hvor du lettet', () => {
    const k = PARK.kickers[2];
    expect(kickerAt(PARK, k.z)).toBe(k.name);
    expect(kickerAt(PARK, k.z - 2)).toBe(k.name);
    expect(kickerAt(PARK, k.z + 20)).toBeNull();
  });
});

describe('fremgang lagret som rene data', () => {
  it('husker per park, gir bare nye id-er, og tåler ødelagt tekst', () => {
    let p = parseProgress(null);
    const a = markCleared(p, 'testbakke', ['ren-360', 'backflip', 'ren-360']);
    expect(a.added).toEqual(['ren-360', 'backflip']);
    p = parseProgress(serializeProgress(a.progress));
    expect(isCleared(p, 'testbakke', 'backflip')).toBe(true);
    expect(isCleared(p, 'nybegynner', 'backflip')).toBe(false);
    expect(markCleared(p, 'testbakke', ['backflip']).added).toEqual([]);
    expect(parseProgress('{ødelagt')).toEqual({});
    expect(parseProgress('[1,2]')).toEqual({});
    expect(parseProgress('{"testbakke":["a",3]}')).toEqual({ testbakke: ['a'] });
  });
});

describe('utfordringer med ekte fysikk og triks', () => {
  it('360 på Lite, backflip på Medium og 720 på Stort klarer fem utfordringer', () => {
    const got = clearedIn([{ spin: 360 }, { flip: -360 }, { spin: 720 }]);
    expect(got).toEqual(['ren-360', 'backflip', 'stort-720', 'kombo-1-5', 'tid-28']);
  });

  it('perfekt pop på alle tre hoppene og en lang grab', () => {
    const got = clearedIn([{ perfect: true, grab: 1 }, { perfect: true }, { perfect: true }]);
    expect(got).toContain('perfekt-pop-alle');
    expect(got).toContain('grab-1s');
  });

  it('en stor runde gir over 3 000 poeng (og 900 teller som minst 720)', () => {
    const got = clearedIn([{ spin: 540 }, { spin: 900 }, { spin: 900, perfect: true }]);
    expect(got).toContain('poeng-3000');
    expect(got).toContain('kombo-1-5');
    expect(got).toContain('stort-720');
  });

  it('720 på Medium er ikke det store hoppet', () => {
    const got = clearedIn([null, { spin: 720 }, null]);
    expect(got).toContain('ren-360');
    expect(got).not.toContain('stort-720');
  });

  it('bare å kjøre rett ned klarer bare tiden', () => {
    expect(clearedIn([null, null, null])).toEqual(['tid-28']);
  });
});

// sørger for at typen i fila stemmer med Challenge (feiler i typecheck hvis feltnavn endres)
const _typed: Challenge = { id: 'x', text: 'x', type: 'trick', spin: 360, kicker: 'Stort' };
void _typed;
