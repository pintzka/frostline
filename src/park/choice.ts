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

/** Navnet på parameteren i adressen (?park=nybegynner). Reserve når localStorage er blokkert. */
export const PARK_PARAM = 'park';

/** Parken i adressen (f.eks. «?park=nybegynner»), eller null. */
export function parkFromSearch(search: string): string | null {
  try {
    return new URLSearchParams(search).get(PARK_PARAM);
  } catch {
    return null;
  }
}

/** Adressen (search-delen) med parken satt, resten beholdes. */
export function searchWithPark(search: string, id: string): string {
  const q = new URLSearchParams(search);
  q.set(PARK_PARAM, id);
  return `?${q.toString()}`;
}

function defaultSearch(): string {
  try {
    return typeof location === 'undefined' ? '' : location.search;
  } catch {
    return '';
  }
}

/** Leser valget: først adressen (?park=), så localStorage. Krasjer aldri. */
export function loadParkChoice(ids: readonly string[], store: ParkStore | null = defaultStore(), search: string = defaultSearch()): string {
  const fromUrl = parkFromSearch(search);
  if (fromUrl && ids.includes(fromUrl)) return fromUrl;
  let stored: string | null = null;
  try {
    stored = store ? store.getItem(PARK_KEY) : null;
  } catch {
    stored = null;
  }
  return pickPark(ids, stored);
}

/** Nøkkelen beste runde lagres under, per park. */
export function bestKey(id: string): string {
  return `frostline.best.${id}`;
}

/** Beste runde i parken (0 hvis ingen, eller lagringen er blokkert). Krasjer aldri. */
export function loadBest(id: string, store: ParkStore | null = defaultStore()): number {
  try {
    const n = Number(store?.getItem(bestKey(id)) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

/** Husker beste runde i parken (bare hvis den er bedre enn den lagrede). Krasjer aldri. */
export function saveBest(id: string, points: number, store: ParkStore | null = defaultStore()): void {
  if (!store || !(points > loadBest(id, store))) return;
  try {
    store.setItem(bestKey(id), String(Math.round(points)));
  } catch {
    /* blokkert: beste runde gjelder bare til siden lastes på nytt */
  }
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
