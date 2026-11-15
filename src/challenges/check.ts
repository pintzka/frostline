import { rampLength, type ParkData } from '../park/format';
import type { Landing } from '../tricks/rotation';
import { comboMult, flipCount, spinHalves } from '../tricks/score';
import type { FlowEvent, Game } from '../ui/flow';
import { CHALLENGE_CONFIG } from './config';
import type { Challenge } from './format';

/**
 * Sjekker utfordringene mot det som skjer i spillet. Ren logikk uten three.js og DOM.
 * Spillet endres ikke: vi leser bare hva som skjedde i hvert steg og gjør det om til hendelser.
 */

/** Det som kan skje i et steg, sett fra utfordringene. */
export type ChallengeEvent =
  | { type: 'start' }
  /** kicker = navnet på hoppet du lettet fra, null hvis det var et småhopp et annet sted */
  | { type: 'landing'; landing: Landing; kicker: string | null }
  | { type: 'score'; total: number; combo: number }
  | { type: 'finish'; time: number; total: number };

/** Det som er klart i runden som pågår. */
export interface RunProgress {
  /** id-ene som er klart denne runden, i den rekkefølgen de ble klart */
  cleared: string[];
  /** hoppene du har tatt med perfekt pop denne runden */
  popKickers: string[];
}

export function createRunProgress(): RunProgress {
  return { cleared: [], popKickers: [] };
}

/** Hvilket hopp du lettet fra, ut fra hvor du lettet (z). null = ikke fra et hopp. */
export function kickerAt(park: ParkData, takeoffZ: number): string | null {
  const k = park.kickers.find((k) => takeoffZ >= k.z - rampLength(k) && takeoffZ <= k.z + CHALLENGE_CONFIG.takeoffAfterLip);
  return k ? k.name : null;
}

/** Gjør ett steg i spillet om til hendelser. ev er det ui/flow.ts sin stepGame ga tilbake. */
export function gameEvents(g: Game, ev: FlowEvent, park: ParkData): ChallengeEvent[] {
  const out: ChallengeEvent[] = [];
  if (ev === 'ny-runde') out.push({ type: 'start' });
  // bare det som skjer mens du kjører (målet nås i samme steg som fasen blir «resultat»)
  if (g.flow.phase !== 'kjorer' && ev !== 'mål') return out;
  const l = g.tricks.lastLanding;
  if (g.tricks.justLanded && l) out.push({ type: 'landing', landing: l, kicker: kickerAt(park, g.takeoffZ) });
  out.push({ type: 'score', total: g.score.total, combo: comboMult(g.score) });
  if (ev === 'mål') out.push({ type: 'finish', time: g.flow.stats.time, total: g.score.total });
  return out;
}

/** Klarer denne landingen et triks-mål? Må være ren landing. */
export function matchesTrick(c: Challenge, l: Landing, kicker: string | null): boolean {
  if (l.quality !== 'ren') return false;
  if (c.kicker !== undefined && c.kicker !== kicker) return false;
  if (c.spin !== undefined && spinHalves(l) * 180 < c.spin) return false;
  if (c.flips !== undefined) {
    if (flipCount(l) < c.flips) return false;
    if (c.flipDir === 'back' && l.flipDeg >= 0) return false;
    if (c.flipDir === 'front' && l.flipDeg <= 0) return false;
  }
  // grabben må telle (holdt lenge nok); grabTime er da hvor lenge den ble holdt
  if (c.grabTime !== undefined && (l.grab === 0 || l.grabTime < c.grabTime)) return false;
  return true;
}

/** Klarer hendelsen utfordringen? run må være oppdatert med hendelsen først (for perfectPops). */
function clears(c: Challenge, e: ChallengeEvent, run: RunProgress): boolean {
  switch (c.type) {
    case 'trick': return e.type === 'landing' && matchesTrick(c, e.landing, e.kicker);
    case 'combo': return e.type === 'score' && e.combo >= (c.mult ?? Infinity) - 1e-9;
    case 'score': return (e.type === 'score' || e.type === 'finish') && e.total >= (c.points ?? Infinity);
    case 'time': return e.type === 'finish' && e.time < (c.seconds ?? 0);
    case 'perfectPops': return e.type === 'landing' && run.popKickers.length >= (c.count ?? Infinity);
  }
}

/**
 * Tar inn én hendelse. Gir id-ene som ble klart akkurat nå (hver bare én gang per runde).
 * 'start' starter runden på nytt.
 */
export function applyEvent(run: RunProgress, list: readonly Challenge[], e: ChallengeEvent): string[] {
  if (e.type === 'start') { Object.assign(run, createRunProgress()); return []; }
  if (e.type === 'landing' && e.landing.perfectPop && e.landing.quality !== 'fall' && e.kicker && !run.popKickers.includes(e.kicker)) {
    run.popKickers.push(e.kicker);
  }
  const now: string[] = [];
  for (const c of list) {
    if (run.cleared.includes(c.id) || !clears(c, e, run)) continue;
    run.cleared.push(c.id);
    now.push(c.id);
  }
  return now;
}
