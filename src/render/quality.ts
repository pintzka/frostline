import { LOOK } from './look';
import { makeRandom } from './sceneryLayout';

/**
 * Kvalitetsnivåene (Lav / Middels / Høy + Auto), FPS-snittet og Auto som senker nivået når det går tregt.
 * Ren logikk uten three.js og uten nettleseren, så den kan testes. Tallene ligger i look.ts (LOOK.quality).
 * scene.ts bruker innstillingene, ui/qualityUi.ts viser valget og lagrer det.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export type Level = keyof typeof LOOK.quality.levels;
export type Choice = Level | 'auto';
export type QualitySettings = (typeof LOOK.quality.levels)[Level];

/** Fra lavest til høyest. */
export const LEVELS: readonly Level[] = ['lav', 'middels', 'hoy'];
export const CHOICES: readonly Choice[] = ['auto', ...LEVELS];
export const CHOICE_NAME: Record<Choice, string> = { auto: 'Auto', lav: 'Lav', middels: 'Middels', hoy: 'Høy' };

export function settingsFor(level: Level): QualitySettings {
  return LOOK.quality.levels[level];
}

/** Leser et lagret valg trygt: alt ukjent blir Auto. */
export function parseChoice(v: unknown): Choice {
  return typeof v === 'string' && (CHOICES as readonly string[]).includes(v) ? (v as Choice) : 'auto';
}

/** Nivået spillet starter på. Auto: Middels på mobil, Høy på PC. */
export function startLevel(choice: Choice, mobile: boolean): Level {
  if (choice !== 'auto') return choice;
  return mobile ? LOOK.quality.auto.mobile : LOOK.quality.auto.desktop;
}

/** Ett nivå ned, eller null hvis vi alt er på Lav. */
export function lowerLevel(level: Level): Level | null {
  const i = LEVELS.indexOf(level);
  return i > 0 ? LEVELS[i - 1] : null;
}

/** Hvor mange av n trær som tegnes med denne tettheten (0–1). */
export function forestCount(n: number, density: number): number {
  return Math.max(0, Math.min(n, Math.round(n * density)));
}

/**
 * En fast blandet kopi av lista. Trærne legges i denne rekkefølgen, så når bare de første tegnes
 * (lavere tetthet), blir skogen tynnere jevnt over i stedet for at hele klynger forsvinner.
 */
export function spreadOrder<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rnd = makeRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * FPS-snitt over et helt vindu (sekunder). add() gir et nytt snitt når vinduet er fullt, ellers null.
 * Snittet er bilder delt på tid, så ett tregt bilde ikke får tallet til å hoppe. Bilder med dt 0 (pause) telles ikke.
 */
export function createFpsMeter(window: number = LOOK.quality.fpsWindow) {
  let frames = 0, time = 0, value = 0;
  return {
    add(dt: number): number | null {
      if (!(dt > 0)) return null;
      frames++;
      time += dt;
      if (time < window) return null;
      value = frames / time;
      frames = 0; time = 0;
      return value;
    },
    /** Glem det halve vinduet (f.eks. etter pause eller nivåbytte). */
    reset() { frames = 0; time = 0; },
    /** Siste snitt (0 før det første). */
    get value() { return value; },
  };
}

/**
 * Auto: får ett FPS-snitt om gangen og senker nivået ett hakk hvis det har vært tregt en stund.
 * Hysterese: under minFps teller tiden opp, over okFps nullstilles den, imellom står den stille.
 * Etter start, pause og bytte venter den `settle` sekunder (lasting og skjermkortet som varmer opp).
 * Den hever aldri nivået selv, så den kan ikke hoppe fram og tilbake.
 */
export function createAutoQuality(start: Level, opts = LOOK.quality.auto) {
  let level = start;
  let slow = 0;
  let settle: number = opts.settle;
  return {
    /** fps: snittet, seconds: hvor lang tid snittet dekker. Gir det nye nivået hvis det ble senket, ellers null. */
    update(fps: number, seconds: number): Level | null {
      if (settle > 0) { settle -= seconds; return null; }
      if (fps < opts.minFps) slow += seconds;
      else if (fps >= opts.okFps) slow = 0;
      if (slow < opts.slowFor - 1e-9) return null;
      const lower = lowerLevel(level);
      slow = 0;
      if (!lower) return null;
      level = lower;
      settle = opts.settle;
      return level;
    },
    /** Start innsvingningen på nytt (pause, eller nivået ble byttet). */
    hold() { slow = 0; settle = opts.settle; },
    get level() { return level; },
  };
}
