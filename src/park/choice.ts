/**
 * Parkvalget: hvilken park spilleren har valgt, husket i nettleseren (localStorage).
 * Ren logikk uten DOM og three.js, så den kan testes. Lagringen kan mangle eller være blokkert
 * (f.eks. i et privat vindu), så alt er pakket i try/catch og faller tilbake til standardparken.
 */

/** Nøkkelen valget lagres under i localStorage. */
export const PARK_KEY = 'frostline.park';
/** Parken du får hvis du ikke har valgt noe (eller valget er ukjent). */
export const DEFAULT_PARK = 'testbakke';

/** Det vi trenger fra localStorage. */
export interface ParkStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage i nettleseren, ellers null (f.eks. i testene, der det ikke finnes noe vindu). */
export function defaultStore(): ParkStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Gyldig lagret valg, ellers standardparken (eller den første i lista hvis standardparken ikke finnes). */
export function pickPark(ids: readonly string[], stored: string | null): string {
  if (stored && ids.includes(stored)) return stored;
  return ids.includes(DEFAULT_PARK) ? DEFAULT_PARK : ids[0];
}

/** Leser valget. Krasjer aldri. */
export function loadParkChoice(ids: readonly string[], store: ParkStore | null = defaultStore()): string {
  let stored: string | null = null;
  try {
    stored = store ? store.getItem(PARK_KEY) : null;
  } catch {
    stored = null;
  }
  return pickPark(ids, stored);
}

/** Husker valget. Gir false hvis det ikke gikk å lagre (da gjelder valget bare til siden lastes på nytt). */
export function saveParkChoice(id: string, store: ParkStore | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(PARK_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/** Neste (step = 1) eller forrige (step = -1) park i lista, rundt i ring. Ukjent park gir den første. */
export function nextPark(ids: readonly string[], current: string, step: number): string {
  const i = ids.indexOf(current);
  if (i < 0) return ids[0];
  return ids[(i + step + ids.length * 4) % ids.length];
}
