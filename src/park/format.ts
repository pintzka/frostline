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
  /** Bredden på hoppet (m), den flate toppen i full høyde. */
  width: number;
  /** Hvor bred den myke skråningen ut til sidene er, på hver side (m). Større = slakere sider. */
  sideWidth: number;
  /** Hvor landingen begynner å bli brattere, målt fra kanten (m). */
  landingStart: number;
  /** Hvor mye brattere enn bakken den bratte delen av landingen er (grader). */
  landingDeg: number;
}

/**
 * En rail eller boks: et rett stykke du glir på, med en myk rampe opp fra snøen i starten.
 * Den følger bakken, med samme høyde over snøen hele veien.
 */
export interface Rail {
  name: string;
  /** "rail" (smalt rør) eller "box" (bred boks). */
  kind: 'rail' | 'box';
  /** Hvor starten (bunnen av rampen) står, i meter nedover bakken. */
  z: number;
  /** Hvor langt fra midten av bakken starten står (m). Positivt = til høyre når du kjører ned. */
  x: number;
  /** Hvor lang den er, med rampen (m). */
  length: number;
  /** Hvor høyt over snøen toppen er (m). */
  height: number;
  /** Hvor mye den skrår (grader). 0 = rett ned bakken, positivt = mot høyre. */
  angleDeg?: number;
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
  /**
   * Platået etter kanten: høyde i forhold til kanten (0–1), hvor kort kanten ned til platået er på midten (m),
   * og hvor mye lengre (slakere) den kanten blir helt ute på sidene av hoppet (m).
   */
  deck: { height: number; drop: number; sideDrop: number };
  /** Landingens deler (m): kort kant inn, bratt del der du lander, og lang myk utkjøring. */
  landing: { knuckle: number; steep: number; runout: number };
  /** Hoppene, ovenfra og ned. */
  kickers: Kicker[];
  /** Rails og bokser (kan sløyfes). */
  rails?: Rail[];
}

/** Rampens lengde: en parabel med gitt krumning ender i riktig vinkel når lengde = radius · tan(vinkel). */
export function rampLength(k: Kicker): number {
  return k.radius * Math.tan(k.lipDeg * DEG);
}

/** Hvor høyt kanten står over bakken (m). */
export function lipHeight(k: Kicker): number {
  return (rampLength(k) * Math.tan(k.lipDeg * DEG)) / 2;
}

/**
 * Hvor bratt den bratteste delen av sidene på hoppet er (grader).
 * Siden er en myk S-kurve (smoothstep), og den er brattest på midten: 1,5 · høyde / bredde.
 */
export function sideAngle(k: Kicker): number {
  return Math.atan((1.5 * lipHeight(k)) / k.sideWidth) / DEG;
}
/** Brattere sider enn dette gir kraftspark når du kjører på siden av hoppet. */
const MAX_SIDE_DEG = 35;

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
  rails: 'array',
};
const GROUP_FIELDS: Record<string, Shape> = {
  waves: { height: 'number', along: 'number', across: 'number' },
  edge: { start: 'number', strength: 'number' },
  deck: { height: 'number', drop: 'number', sideDrop: 'number' },
  landing: { knuckle: 'number', steep: 'number', runout: 'number' },
};
const KICKER_FIELDS: Shape = {
  name: 'string', z: 'number', lipDeg: 'number', radius: 'number', width: 'number', sideWidth: 'number', landingStart: 'number', landingDeg: 'number',
};
const RAIL_FIELDS: Shape = {
  name: 'string', kind: 'string', z: 'number', x: 'number', length: 'number', height: 'number', angleDeg: 'number',
};
/** Felt som kan sløyfes. */
const OPTIONAL = new Set(['rails', 'angleDeg']);
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
    if (!(key in obj) && OPTIONAL.has(key)) continue;
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
  ((data.rails ?? []) as unknown[]).forEach((r, i) => {
    if (!isObject(r)) errors.push(`Rail nr. ${i + 1}: må være en gruppe { }.`);
    else checkShape(r, RAIL_FIELDS, `Rail nr. ${i + 1}${typeof r.name === 'string' ? ` («${r.name}»)` : ''}`, errors);
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
  if (p.deck.sideDrop < 0) errors.push('"deck.sideDrop" kan ikke være negativ.');
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
    if (k.sideWidth <= 0) {
      errors.push(`${who}: "sideWidth" må være større enn 0.`);
    } else {
      const sideDeg = sideAngle(k);
      if (sideDeg > MAX_SIDE_DEG) {
        const need = Math.ceil((1.5 * lipHeight(k)) / Math.tan(MAX_SIDE_DEG * DEG));
        errors.push(`${who}: sidene er ${sideDeg.toFixed(0)}° bratte (høyst ${MAX_SIDE_DEG}°), så de gir kraftspark. Sett "sideWidth" til minst ${need} m.`);
      }
    }
    if (k.width + 2 * k.sideWidth > p.width) {
      errors.push(`${who}: hoppet (${k.width} m + ${k.sideWidth} m skråning på hver side) er bredere enn bakken (${p.width} m).`);
    }
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
  checkRails(p, errors);
  return errors;
}

/** Hvor railen slutter (x, z), og hvor langt til siden den når på det meste. */
export function railEnd(r: Rail): { x: number; z: number } {
  const a = (r.angleDeg ?? 0) * DEG;
  return { x: r.x + r.length * Math.sin(a), z: r.z + r.length * Math.cos(a) };
}

/** Grenser for rails (se docs/PARK.md). */
const RAIL_LIMITS = { height: [0.2, 1.2], angleDeg: 30, maxLength: 80, minTop: 4, kickerGap: 2, railGap: 3 };

/** Sjekker rails og bokser: innenfor bakken, ikke på hoppene og ikke oppå hverandre. */
function checkRails(p: ParkData, errors: string[]): void {
  const rails = p.rails ?? [];
  const names = new Set<string>();
  const ramp = CONFIG.railRampLength;
  const span = (r: Rail) => {
    const e = railEnd(r);
    return { z0: Math.min(r.z, e.z), z1: Math.max(r.z, e.z), x0: Math.min(r.x, e.x), x1: Math.max(r.x, e.x) };
  };
  rails.forEach((r, i) => {
    const who = `Railen «${r.name}»`;
    if (names.has(r.name)) errors.push(`To rails heter «${r.name}». Gi dem forskjellige navn.`);
    names.add(r.name);
    if (r.kind !== 'rail' && r.kind !== 'box') errors.push(`${who}: "kind" er «${r.kind}». Den må være "rail" eller "box".`);
    const [hMin, hMax] = RAIL_LIMITS.height;
    if (r.height < hMin || r.height > hMax) errors.push(`${who}: "height" er ${r.height} m. Den må være mellom ${hMin} og ${hMax} m.`);
    if (r.length < ramp + RAIL_LIMITS.minTop || r.length > RAIL_LIMITS.maxLength) {
      errors.push(`${who}: "length" er ${r.length} m. Den må være mellom ${ramp + RAIL_LIMITS.minTop} m (rampen er ${ramp} m) og ${RAIL_LIMITS.maxLength} m.`);
    }
    const a = r.angleDeg ?? 0;
    if (Math.abs(a) > RAIL_LIMITS.angleDeg) errors.push(`${who}: "angleDeg" er ${a}°. Den kan skrå høyst ${RAIL_LIMITS.angleDeg}° til hver side.`);
    const s = span(r);
    const inside = p.width * p.edge.start - 1;
    if (Math.max(Math.abs(s.x0), Math.abs(s.x1)) > inside) {
      errors.push(`${who}: går ut til ${Math.max(Math.abs(s.x0), Math.abs(s.x1)).toFixed(1)} m fra midten, men må holde seg innenfor ${inside.toFixed(0)} m (før bollen mot kanten).`);
    }
    if (s.z0 < FIRST_RAMP_MIN_Z) errors.push(`${who}: starter ved ${s.z0} m, før skiløperen har fått fart. Den må starte etter ${FIRST_RAMP_MIN_Z} m.`);
    const stop = p.length - CONFIG.runEndMargin - 10;
    if (s.z1 > stop) errors.push(`${who}: slutter ved ${s.z1.toFixed(1)} m, men må slutte før ${stop} m.`);
    // ikke på hoppene: ikke på rampen, platået eller landingen, og ikke over kanten inn til landingen (der bøyer bakken seg)
    const gap = RAIL_LIMITS.kickerGap;
    for (const k of p.kickers) {
      const band = k.width / 2 + k.sideWidth + gap;
      const z0 = k.z - rampLength(k) - gap, z1 = k.z + steepEnd(k, p) + gap;
      const nearX = s.x0 < band && s.x1 > -band;
      if (nearX && s.z1 > z0 && s.z0 < z1) {
        errors.push(`${who} står på hoppet «${k.name}» (${z0.toFixed(0)}–${z1.toFixed(0)} m, ${band.toFixed(0)} m til hver side). Flytt den lenger ut til siden eller mellom hoppene.`);
        continue;
      }
      const k0 = k.z + k.landingStart - gap, k1 = k.z + k.landingStart + p.landing.knuckle + gap;
      if (s.z1 > k0 && s.z0 < k1) {
        errors.push(`${who} krysser kanten inn til landingen på «${k.name}» (${k0.toFixed(0)}–${k1.toFixed(0)} m), der bakken bøyer seg. Flytt den opp eller ned.`);
      }
    }
    // ikke oppå eller helt inntil en annen rail
    for (let j = 0; j < i; j++) {
      const o = span(rails[j]);
      const g = RAIL_LIMITS.railGap;
      if (s.z1 > o.z0 && s.z0 < o.z1 && s.x1 + g > o.x0 && s.x0 - g < o.x1) {
        errors.push(`${who} står for nær «${rails[j].name}». Det må være minst ${g} m mellom dem.`);
      }
    }
  });
}

/** Sjekker parken og gir den tilbake med riktige typer. Kaster en feil med alle meldingene hvis noe er galt. */
export function loadPark(data: unknown, file = 'parkfila'): ParkData {
  const errors = validatePark(data);
  if (errors.length > 0) throw new Error(`Feil i ${file}:\n- ${errors.join('\n- ')}`);
  return data as ParkData;
}
