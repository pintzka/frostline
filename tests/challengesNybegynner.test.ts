import { describe, expect, it, vi } from 'vitest';

// Late som om nybegynnerparken er valgt før spillet lastes (som i tests/nybegynner.test.ts).
vi.hoisted(() => {
  const data: Record<string, string> = { 'frostline.park': 'nybegynner' };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => { data[k] = v; },
    },
  });
});

import { applyEvent, createRunProgress, gameEvents } from '../src/challenges/check';
import { validateChallenges } from '../src/challenges/format';
import { CHALLENGES, CURRENT_CHALLENGES } from '../src/challenges/index';
import data from '../src/challenges/nybegynner.json';
import { PARK } from '../src/park/terrain';
import { rideRun, type JumpPlan } from './rideBot';

/** Kjører en hel runde i nybegynnerparken med ekte fysikk og gir id-ene som ble klart. */
function clearedIn(plans: (JumpPlan | null)[]): string[] {
  const run = createRunProgress();
  const got: string[] = [];
  rideRun(plans, (g, ev) => {
    for (const e of gameEvents(g, ev, PARK)) got.push(...applyEvent(run, CURRENT_CHALLENGES, e));
  });
  return got;
}

describe('utfordringer i nybegynnerparken', () => {
  it('har 3–5 gyldige utfordringer, og de er de som gjelder når parken er valgt', () => {
    expect(PARK.name).toBe('Nybegynner');
    expect(validateChallenges(data, PARK)).toEqual([]);
    expect(CURRENT_CHALLENGES).toBe(CHALLENGES.nybegynner);
    expect(CURRENT_CHALLENGES.length).toBeGreaterThanOrEqual(3);
    expect(CURRENT_CHALLENGES.length).toBeLessThanOrEqual(5);
  });

  it('bare å kjøre rett ned klarer ingenting', () => {
    expect(clearedIn([null, null, null, null])).toEqual([]);
  });

  it('grab, backflip og 540 går an på minihoppene', () => {
    expect(clearedIn([{ grab: 0.5 }, null, null, null])).toContain('grab');
    expect(clearedIn([{ flip: -360, perfect: true }, null, null, null])).toContain('backflip');
    expect(clearedIn([{ spin: 540, perfect: true }, null, null, null])).toContain('ren-540');
  });

  it('perfekt pop på alle fire, og en runde med flips gir 1 500 poeng', () => {
    expect(clearedIn([{ perfect: true }, { perfect: true }, { perfect: true }, null])).not.toContain('perfekt-pop-alle');
    expect(clearedIn([{ perfect: true }, { perfect: true }, { perfect: true }, { perfect: true }])).toContain('perfekt-pop-alle');
    const flips = clearedIn([{ flip: -360, perfect: true }, { flip: 360, perfect: true }, null, null]);
    expect(flips).toContain('poeng-1500');
    expect(clearedIn([{ spin: 540, perfect: true }, null, null, null])).not.toContain('poeng-1500');
  });
});
