/**
 * Fremgangen (hvilke utfordringer du har klart) som rene data, per park.
 * Lagres som tekst (JSON) i nettleseren av ui/challengesUi.ts. Ingen DOM her, så det kan testes.
 */
export type Progress = Record<string, string[]>;

/** Leser lagret tekst. Tåler at den mangler eller er ødelagt: da starter du bare på nytt. */
export function parseProgress(text: string | null): Progress {
  if (!text) return {};
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
    const out: Progress = {};
    for (const [park, ids] of Object.entries(data)) {
      if (Array.isArray(ids)) out[park] = ids.filter((id): id is string => typeof id === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeProgress(p: Progress): string {
  return JSON.stringify(p);
}

/** Har du noen gang klart denne utfordringen i denne parken? */
export function isCleared(p: Progress, park: string, id: string): boolean {
  return (p[park] ?? []).includes(id);
}

/** Merker id-er som klart. Gir de som er nye (aldri klart før). Endrer ikke p, men gir en ny kopi. */
export function markCleared(p: Progress, park: string, ids: readonly string[]): { progress: Progress; added: string[] } {
  const had = p[park] ?? [];
  const added = ids.filter((id, i) => !had.includes(id) && ids.indexOf(id) === i);
  if (added.length === 0) return { progress: p, added };
  return { progress: { ...p, [park]: [...had, ...added] }, added };
}
