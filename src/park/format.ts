import { CONFIG } from '../core/config';

/**
 * Parkformatet: en park er en JSON-fil i src/park/parks/.
 * Denne fila beskriver hva som skal stå i fila, og sjekker at tallene gir mening.
 * Ren logikk, ingen three.js. Se docs/PARK.md for en enkel guide.
 */
const DEG = Math.PI / 180;

/**
 * Et hopp: en rampe som bøyer seg mykt opp til en kant (lip), en kort bakside,
 * og lenger ned en landing der bakken blir brattere, så du lander langs bakken i stedet for rett inn i den.
 */
export interface Kicker {
  name: string;
  /** Hvor kanten står (m nedover bakken). */
  z: number;
  /** Kantens vinkel mot bakken (grader). Bestemmer mest hvor høyt og langt du flyr. */
  lipDeg: number;
  /** Rampens krumning (m). Større = lengre og mykere rampe, mindre spark oppover. */
  radius: number;
  /** Bredden på hoppet (m). */
  width: number;
  /** Hvor landingen begynner å bli brattere, målt fra kanten (m). */
  landingStart: number;
  /** Hvor mye brattere enn bakken den bratte delen av landingen er (grader). */
  landingDeg: number;
}

/** Hele parken slik den står i JSON-fila. */
export interface ParkData {
  /** Navnet på parken. */
  name: string;
  /** Bredden på bakken (m). */
  width: number;
  /** Lengden på bakken (m). */
  length: number;
  /** Svake bølger i bakken: høyde (m) og hvor tett de kommer nedover (along) og på tvers (across). */
  waves: { height: number; along: number; across: number };
  /** «Bollen» mot kantene: starter ved start · bredde fra midten, og blir brattere med styrken strength. */
  edge: { start: number; strength: number };
  /** Platået etter kanten: høyde i forhold til kanten (0–1), og hvor kort kanten ned til platået er (m). */
  deck: { height: number; drop: number };
  /** Landingens deler (m): kort kant inn, bratt del der du lander, og lang myk utkjøring. */
  landing: { knuckle: number; steep: number; runout: number };
  /** Hoppene, ovenfra og ned. */
  kickers: Kicker[];
}

/** Rampens lengde: en parabel med gitt krumning ender i riktig vinkel når lengde = radius · tan(vinkel). */
export function rampLength(k: Kicker): number {
  return k.radius * Math.tan(k.lipDeg * DEG);
}

/** Hvor høyt kanten står over bakken (m). */
export function lipHeight(k: Kicker): number {
  return (rampLength(k) * Math.tan(k.lipDeg * DEG)) / 2;
}

// Trygge grenser. Utenfor disse blir hoppet umulig eller farlig å kjøre.
const LIMITS = {
  lipDeg: [3, 40],
  landingDeg: [0, 30],
  radius: [5, 300],
};
/** Rampen må starte så langt ned at skiløperen (som starter ved z = 5) får litt fart først (m). */
const FIRST_RAMP_MIN_Z = 20;

type Shape = Record<string, 'string' | 'number' | 'object' | 'array'>;
const PARK_FIELDS: Shape = {
  name: 'string', width: 'number', length: 'number', waves: 'object', edge: 'object', deck: 'object', landing: 'object', kickers: 'array',
};
const GROUP_FIELDS: Record<string, Shape> = {
  waves: { height: 'number', along: 'number', across: 'number' },
  edge: { start: 'number', strength: 'number' },
  deck: { height: 'number', drop: 'number' },
  landing: { knuckle: 'number', steep: 'number', runout: 'number' },
};
const KICKER_FIELDS: Shape = {
  name: 'string', z: 'number', lipDeg: 'number', radius: 'number', width: 'number', landingStart: 'number', landingDeg: 'number',
};
const TYPE_NAMES = { string: 'tekst', number: 'et tall', object: 'en gruppe { }', array: 'en liste [ ]' };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeOk(v: unknown, t: Shape[string]): boolean {
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  if (t === 'array') return Array.isArray(v);
  if (t === 'object') return isObject(v);
  return typeof v === 'string' && v.trim() !== '';
}

/** Sjekker at alle felt finnes og har riktig type, og at det ikke er ukjente (feilstavede) felt. */
function checkShape(obj: Record<string, unknown>, shape: Shape, where: string, errors: string[]): boolean {
  let ok = true;
  for (const [key, t] of Object.entries(shape)) {
    if (!(key in obj)) {
      errors.push(`${where}: mangler feltet "${key}".`);
      ok = false;
    } else if (!typeOk(obj[key], t)) {
      errors.push(`${where}: "${key}" må være ${TYPE_NAMES[t]}${t === 'string' ? ' (ikke tom)' : ''}.`);
      ok = false;
    }
  }
  for (const key of Object.keys(obj)) {
    if (!(key in shape)) errors.push(`${where}: ukjent felt "${key}". Er det feilstavet?`);
  }
  return ok;
}

/** Hvor bratt del av landingen slutter, målt fra kanten (m). Etter dette kommer bare utkjøringen. */
function steepEnd(k: Kicker, p: ParkData): number {
  return k.landingStart + p.landing.knuckle + p.landing.steep;
}

/**
 * Sjekker en park (for eksempel lest fra en JSON-fil).
 * Gir en liste med feilmeldinger på norsk. Tom liste betyr at parken er gyldig.
 */
export function validatePark(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(data)) return ['Parken må være en gruppe { } med felt som "name", "width" og "kickers".'];
  if (!checkShape(data, PARK_FIELDS, 'Parken', errors)) return errors;
  for (const group of Object.keys(GROUP_FIELDS)) {
    checkShape(data[group] as Record<string, unknown>, GROUP_FIELDS[group], `"${group}"`, errors);
  }
  const list = data.kickers as unknown[];
  list.forEach((k, i) => {
    if (!isObject(k)) errors.push(`Hopp nr. ${i + 1}: må være en gruppe { }.`);
    else checkShape(k, KICKER_FIELDS, `Hopp nr. ${i + 1}${typeof k.name === 'string' ? ` («${k.name}»)` : ''}`, errors);
  });
  // Ingen vits i å regne på tallene før alle felt finnes.
  if (errors.length > 0) return errors;

  const p = data as unknown as ParkData;
  if (p.width < 20 || p.width > 300) errors.push(`"width" er ${p.width} m. Bakken må være mellom 20 og 300 m bred.`);
  if (p.length < 100 || p.length > 5000) errors.push(`"length" er ${p.length} m. Bakken må være mellom 100 og 5000 m lang.`);
  if (p.waves.height < 0 || p.waves.height > 2) errors.push(`"waves.height" er ${p.waves.height} m. Bølgene må være mellom 0 og 2 m høye.`);
  if (p.waves.along < 0 || p.waves.across < 0) errors.push('"waves.along" og "waves.across" kan ikke være negative.');
  if (p.edge.start <= 0 || p.edge.start > 0.5) errors.push(`"edge.start" er ${p.edge.start}. Den må være over 0 og høyst 0,5 (en halv bredde fra midten).`);
  if (p.edge.strength < 0) errors.push('"edge.strength" kan ikke være negativ.');
  if (p.deck.height < 0 || p.deck.height > 1) errors.push(`"deck.height" er ${p.deck.height}. Den må være mellom 0 og 1 (1 = like høyt som kanten).`);
  if (p.deck.drop <= 0) errors.push('"deck.drop" må være større enn 0.');
  for (const part of ['knuckle', 'steep', 'runout'] as const) {
    if (p.landing[part] <= 0) errors.push(`"landing.${part}" må være større enn 0.`);
  }

  const names = new Set<string>();
  p.kickers.forEach((k, i) => {
    const who = `Hoppet «${k.name}»`;
    if (names.has(k.name)) errors.push(`To hopp heter «${k.name}». Gi dem forskjellige navn.`);
    names.add(k.name);
    const [lipMin, lipMax] = LIMITS.lipDeg;
    if (k.lipDeg < lipMin || k.lipDeg > lipMax) {
      errors.push(`${who}: "lipDeg" er ${k.lipDeg}°. Kanten må ha mellom ${lipMin}° og ${lipMax}°, ellers blir hoppet umulig.`);
    }
    const [landMin, landMax] = LIMITS.landingDeg;
    if (k.landingDeg < landMin || k.landingDeg > landMax) {
      errors.push(`${who}: "landingDeg" er ${k.landingDeg}°. Landingen kan være mellom ${landMin}° og ${landMax}° brattere enn bakken.`);
    }
    const [rMin, rMax] = LIMITS.radius;
    if (k.radius < rMin || k.radius > rMax) errors.push(`${who}: "radius" er ${k.radius} m. Den må være mellom ${rMin} og ${rMax} m.`);
    if (k.width < 2) errors.push(`${who}: "width" er ${k.width} m. Hoppet må være minst 2 m bredt.`);
    // + 3 m myk overgang på hver side
    if (k.width + 6 > p.width) errors.push(`${who}: hoppet (${k.width} m + 3 m myk kant på hver side) er bredere enn bakken (${p.width} m).`);
    if (k.landingStart <= p.deck.drop) {
      errors.push(`${who}: landingen starter ${k.landingStart} m etter kanten, men platået slutter først etter ${p.deck.drop} m. "landingStart" må være større.`);
    }

    const start = k.z - rampLength(k);
    if (i === 0 && start < FIRST_RAMP_MIN_Z) {
      errors.push(`${who}: rampen starter ved ${start.toFixed(1)} m, før skiløperen har fått fart. Flytt hoppet lenger ned (rampen må starte etter ${FIRST_RAMP_MIN_Z} m).`);
    }
    const end = k.z + steepEnd(k, p);
    if (end > p.length - CONFIG.runEndMargin) {
      errors.push(`${who}: landingen slutter ved ${end.toFixed(1)} m, men kjøringen stopper ved ${p.length - CONFIG.runEndMargin} m. Flytt hoppet opp eller gjør bakken lengre.`);
    } else if (k.z + k.landingStart + p.landing.knuckle + p.landing.steep + p.landing.runout > p.length) {
      errors.push(`${who}: utkjøringen etter landingen går forbi slutten av bakken (${p.length} m).`);
    }

    const prev = p.kickers[i - 1];
    if (prev) {
      if (k.z <= prev.z) {
        errors.push(`${who} står ved ${k.z} m, men må stå lenger ned enn «${prev.name}» (${prev.z} m). Skriv hoppene ovenfra og ned.`);
      } else {
        const prevEnd = prev.z + steepEnd(prev, p);
        if (start < prevEnd) {
          errors.push(`${who} overlapper «${prev.name}»: rampen starter ved ${start.toFixed(1)} m, men landingen til «${prev.name}» er ikke ferdig før ${prevEnd.toFixed(1)} m.`);
        }
      }
    }
  });
  return errors;
}

/** Sjekker parken og gir den tilbake med riktige typer. Kaster en feil med alle meldingene hvis noe er galt. */
export function loadPark(data: unknown, file = 'parkfila'): ParkData {
  const errors = validatePark(data);
  if (errors.length > 0) throw new Error(`Feil i ${file}:\n- ${errors.join('\n- ')}`);
  return data as ParkData;
}
