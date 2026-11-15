import { CONFIG } from '../core/config';
import type { ParkData } from '../park/format';

/**
 * Formatet for utfordringer: én JSON-fil per park i src/challenges/ (f.eks. testbakke.json).
 * Denne fila beskriver hva som kan stå i fila, og sjekker at målene går an å klare i parken.
 * Ren logikk, ingen three.js og ingen DOM. Se docs/UTFORDRINGER.md.
 */

/**
 * Typene utfordringer:
 * - trick: land et triks rent. Velg minst én av spin (grader), flips (antall) og grabTime (sekunder).
 *   flipDir = "back" eller "front" krever backflip eller frontflip. kicker = navnet på hoppet det må gjøres på.
 * - combo: nå minst kombo-gangetallet mult (f.eks. 1.5).
 * - perfectPops: perfekt pop (og landing uten fall) på count forskjellige hopp i én runde.
 * - time: kom i mål på under seconds sekunder.
 * - score: få minst points poeng i én runde.
 */
export type ChallengeType = 'trick' | 'combo' | 'perfectPops' | 'time' | 'score';

export interface Challenge {
  /** Kort navn uten mellomrom som aldri endres. Fremgangen lagres med dette. */
  id: string;
  /** Teksten spilleren ser. */
  text: string;
  type: ChallengeType;
  spin?: number;
  flips?: number;
  flipDir?: 'back' | 'front';
  grabTime?: number;
  kicker?: string;
  mult?: number;
  count?: number;
  seconds?: number;
  points?: number;
}

export interface ChallengeFile {
  /** Navnet på parkfila (uten .json), f.eks. "testbakke". */
  park: string;
  challenges: Challenge[];
}

/** Hvilke felt hver type kan ha (i tillegg til id, text og type), og hvilke den må ha. */
const TYPE_FIELDS: Record<ChallengeType, { allowed: string[]; required: string[] }> = {
  trick: { allowed: ['spin', 'flips', 'flipDir', 'grabTime', 'kicker'], required: [] },
  combo: { allowed: ['mult'], required: ['mult'] },
  perfectPops: { allowed: ['count'], required: ['count'] },
  time: { allowed: ['seconds'], required: ['seconds'] },
  score: { allowed: ['points'], required: ['points'] },
};
const NUMBER_FIELDS = ['spin', 'flips', 'grabTime', 'mult', 'count', 'seconds', 'points'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isWhole = (x: number) => Math.abs(x - Math.round(x)) < 1e-9;

/** Sjekker én utfordring. Legger feilmeldinger i errors. */
function checkOne(c: Record<string, unknown>, where: string, park: ParkData, errors: string[]): void {
  if (!isText(c.id)) errors.push(`${where}: mangler "id" (et kort navn, f.eks. "ren-360").`);
  else if (/\s/.test(c.id)) errors.push(`${where}: "id" kan ikke ha mellomrom («${c.id}»). Bruk bindestrek.`);
  if (!isText(c.text)) errors.push(`${where}: mangler "text" (teksten spilleren ser).`);
  const type = c.type as ChallengeType;
  if (!(type in TYPE_FIELDS)) {
    errors.push(`${where}: "type" må være en av ${Object.keys(TYPE_FIELDS).map((t) => `"${t}"`).join(', ')}.`);
    return;
  }
  const { allowed, required } = TYPE_FIELDS[type];
  for (const key of Object.keys(c)) {
    if (key === 'id' || key === 'text' || key === 'type') continue;
    if (!allowed.includes(key)) errors.push(`${where}: feltet "${key}" passer ikke til type "${type}". Er det feilstavet?`);
    else if (NUMBER_FIELDS.includes(key) && (typeof c[key] !== 'number' || !Number.isFinite(c[key]))) errors.push(`${where}: "${key}" må være et tall.`);
  }
  for (const key of required) if (!(key in c)) errors.push(`${where}: type "${type}" må ha feltet "${key}".`);

  const n = (key: string) => (typeof c[key] === 'number' ? (c[key] as number) : undefined);
  if (type === 'trick') {
    const spin = n('spin'), flips = n('flips'), grab = n('grabTime');
    if (spin === undefined && flips === undefined && grab === undefined) {
      errors.push(`${where}: et triks må ha minst én av "spin", "flips" og "grabTime".`);
    }
    if (spin !== undefined && (spin < 180 || spin > 1800 || !isWhole(spin / 180))) {
      errors.push(`${where}: "spin" er ${spin}. Den må være 180, 360, 540 … opp til 1800.`);
    }
    if (flips !== undefined && (flips < 1 || flips > 3 || !isWhole(flips))) errors.push(`${where}: "flips" må være 1, 2 eller 3.`);
    if ('flipDir' in c && c.flipDir !== 'back' && c.flipDir !== 'front') errors.push(`${where}: "flipDir" må være "back" eller "front".`);
    if ('flipDir' in c && flips === undefined) errors.push(`${where}: "flipDir" trenger også "flips".`);
    if (grab !== undefined && (grab < CONFIG.grabMinHold || grab > 5)) {
      errors.push(`${where}: "grabTime" er ${grab} s. Den må være mellom ${CONFIG.grabMinHold} og 5 sekunder.`);
    }
    if ('kicker' in c && !park.kickers.some((k) => k.name === c.kicker)) {
      errors.push(`${where}: parken har ikke noe hopp som heter «${String(c.kicker)}». Hoppene heter ${park.kickers.map((k) => `«${k.name}»`).join(', ')}.`);
    }
  } else if (type === 'combo') {
    const mult = n('mult');
    if (mult !== undefined) {
      const steps = (mult - 1) / CONFIG.comboStep;
      if (mult <= 1 || mult > CONFIG.comboMax || !isWhole(steps)) {
        errors.push(`${where}: "mult" er ${mult}. Komboen går i steg på ${CONFIG.comboStep} (1.25, 1.5, 1.75 …) opp til ${CONFIG.comboMax}.`);
      } else if (Math.round(steps) > park.kickers.length) {
        errors.push(`${where}: kombo x${mult} trenger ${Math.round(steps)} rene triks på rad, men parken har bare ${park.kickers.length} hopp.`);
      }
    }
  } else if (type === 'perfectPops') {
    const count = n('count');
    if (count !== undefined && (count < 1 || count > park.kickers.length || !isWhole(count))) {
      errors.push(`${where}: "count" er ${count}. Den må være et helt tall fra 1 til ${park.kickers.length} (antall hopp i parken).`);
    }
  } else if (type === 'time') {
    const s = n('seconds');
    if (s !== undefined && s <= 0) errors.push(`${where}: "seconds" må være større enn 0.`);
  } else {
    const p = n('points');
    if (p !== undefined && p <= 0) errors.push(`${where}: "points" må være større enn 0.`);
  }
}

/**
 * Sjekker en utfordringsfil mot parken den hører til.
 * Gir en liste med feilmeldinger på norsk. Tom liste betyr at fila er gyldig.
 */
export function validateChallenges(data: unknown, park: ParkData): string[] {
  if (!isObject(data)) return ['Fila må være en gruppe { } med feltene "park" og "challenges".'];
  const errors: string[] = [];
  for (const key of Object.keys(data)) {
    if (key !== 'park' && key !== 'challenges') errors.push(`ukjent felt "${key}". Er det feilstavet?`);
  }
  if (!isText(data.park)) errors.push('mangler "park" (navnet på parkfila, f.eks. "testbakke").');
  if (!Array.isArray(data.challenges)) return [...errors, '"challenges" må være en liste [ ].'];
  const ids = new Set<string>();
  data.challenges.forEach((c, i) => {
    const where = `Utfordring nr. ${i + 1}`;
    if (!isObject(c)) { errors.push(`${where}: må være en gruppe { }.`); return; }
    checkOne(c, isText(c.id) ? `${where} («${c.id}»)` : where, park, errors);
    if (isText(c.id)) {
      if (ids.has(c.id)) errors.push(`To utfordringer har id «${c.id}». Gi dem forskjellige id-er.`);
      ids.add(c.id);
    }
  });
  return errors;
}

/** Sjekker fila og gir den tilbake med riktige typer. Kaster en feil med alle meldingene hvis noe er galt. */
export function loadChallenges(data: unknown, park: ParkData, file = 'utfordringsfila'): ChallengeFile {
  const errors = validateChallenges(data, park);
  if (errors.length > 0) throw new Error(`Feil i ${file}:\n- ${errors.join('\n- ')}`);
  return data as ChallengeFile;
}
