import { heightAt, PARK } from '../park/terrain';
import { LOOK } from './look';

/**
 * Hvor trær, hoppmerker og fjell skal stå. Ren logikk uten three.js, så det kan testes.
 * Alt bruker et fast frø, så verden ser lik ut hver gang.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */

/** Den preparerte bakken (meshen i scene.ts) går hit ut til hver side (m). */
export const GROUND_HALF = PARK.width / 2 + 20;

/** Området rundt: hvor langt terrenget utenfor bakken går (m). */
export const WORLD = { halfWidth: 340, zMin: -260, zMax: 980 };

/** Trærne står minst så langt fra midten (m). Skiløperen kommer aldri lenger ut enn PARK.width / 2. */
export const TREE_MIN_X = PARK.width / 2 + LOOK.forest.edgeMargin;

// terrenget utenfor bakken: fortsetter "bollen", flater mykt ut og ender i en rygg
const OUTER_FAR_GRAD = 0.12;
const OUTER_BEND = 25;

/**
 * Høyden på bakken overalt, også utenfor løypa. Inne på den preparerte bakken er den
 * akkurat den samme som heightAt, så alt henger sammen uten kant.
 * Utenfor stiger lia opp til en bølgete rygg (ca. 110 m ut), og bak ryggen faller den bratt ned,
 * så kanten av verden aldri syns.
 */
export function groundAt(x: number, z: number): number {
  const ax = Math.abs(x);
  if (ax <= GROUND_HALF) return heightAt(x, z);
  const s = Math.sign(x);
  const t = ax - GROUND_HALF;
  // like bratt som bakken i kanten, så det ikke blir en knekk
  const edgeGrad = (heightAt(s * GROUND_HALF, z) - heightAt(s * (GROUND_HALF - 0.05), z)) / 0.05;
  const a = edgeGrad - OUTER_FAR_GRAD;
  const rise = OUTER_FAR_GRAD * t + a * OUTER_BEND * (1 - Math.exp(-t / OUTER_BEND));
  // ryggen ligger ulikt langt ut, så den ikke blir en rett strek
  const crest = 110 + 30 * Math.sin(z * 0.009 + s * 1.7) + 15 * Math.sin(z * 0.023 + s * 0.4);
  const behind = Math.max(0, t - crest);
  const bumps = 5 * Math.sin(z * 0.035 + x * 0.02) * (1 - Math.exp(-t / 30)) ** 2;
  return heightAt(s * GROUND_HALF, z) + rise + bumps - 0.012 * behind * behind;
}

/** Fast "tilfeldighet" (mulberry32): samme frø gir alltid de samme tallene. */
export function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Tree {
  x: number;
  /** Hvor foten av stammen står (litt ned i snøen, så treet aldri svever i en skråning). */
  y: number;
  z: number;
  /** Hele høyden (m). */
  height: number;
  /** Bredde i forhold til høyden (1 = vanlig). */
  girth: number;
  /** Vridning rundt seg selv (radianer). */
  turn: number;
  /** 0–1: litt ulik farge på hvert tre. */
  tint: number;
}

/** Stammens radius ved foten, i forhold til treets høyde. */
export const TRUNK_FRACTION = 0.03;

/** Hvor tykk stammen er ved foten (m). */
export function trunkRadius(t: { height: number; girth: number }): number {
  return t.height * t.girth * TRUNK_FRACTION;
}

/** Minste avstand mellom to trær (m). */
export const MIN_TREE_GAP = LOOK.forest.gap;

/** Ingen trær nærmere enn dette fra et hopp eller et hoppmerke (m). */
export const KICKER_CLEARANCE = 12;

/** Hvor langt fra kanten av et hopp (i x) og hvor langt opp og ned bakken (z) et hopp rekker. */
export function kickerZone(i: number) {
  const k = PARK.kickers[i];
  return { zMin: k.z - 60, zMax: k.z + 160, halfWidth: k.width / 2 + 3 };
}

function nearKicker(x: number, z: number): boolean {
  return PARK.kickers.some((_, i) => {
    const zone = kickerZone(i);
    const dx = Math.max(0, Math.abs(x) - zone.halfWidth);
    const dz = Math.max(0, zone.zMin - z, z - zone.zMax);
    return Math.hypot(dx, dz) < KICKER_CLEARANCE;
  });
}

/** Hvor bratt bakken er i punktet (høydeendring per meter). */
function steepness(x: number, z: number): number {
  const e = 0.25;
  const dx = (groundAt(x + e, z) - groundAt(x - e, z)) / (2 * e);
  const dz = (groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

/** Kan et tre stå her? Utenfor løypa, inne i verden og ikke ved et hopp. */
export function treeAllowed(x: number, z: number): boolean {
  const ax = Math.abs(x);
  if (ax < TREE_MIN_X || ax > WORLD.halfWidth - 20) return false;
  if (z < WORLD.zMin + 20 || z > WORLD.zMax - 20) return false;
  return !nearKicker(x, z);
}

/**
 * Trær i grupper langs begge sider. Tett ved løypa (der de suser forbi), glissent lenger ut.
 * Hver gruppe er en klynge rundt et midtpunkt, så det blir skog og lysninger, ikke rutenett.
 */
export function planTrees(seed: number = LOOK.forest.seed): Tree[] {
  const F = LOOK.forest;
  const rnd = makeRandom(seed);
  const trees: Tree[] = [];
  // rutenett bare for å finne naboer fort og holde avstand, ikke for plassering
  const cell = MIN_TREE_GAP;
  const cellTrees = new Map<string, Tree[]>();
  const key = (cx: number, cz: number) => `${cx},${cz}`;
  const free = (x: number, z: number) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const near = cellTrees.get(key(cx + i, cz + j));
      if (near && near.some((t) => Math.hypot(t.x - x, t.z - z) < cell)) return false;
    }
    return true;
  };

  const addTree = (x: number, z: number, big: number) => {
    if (!treeAllowed(x, z) || !free(x, z)) return;
    const height = (F.height.min + rnd() * F.height.range) * big;
    const girth = 0.85 + rnd() * 0.3;
    // sett foten så dypt at hele stammen står i snøen, også i bratte lier
    const y = groundAt(x, z) - 0.3 - steepness(x, z) * trunkRadius({ height, girth }) * 1.5;
    const t: Tree = { x, y, z, height, girth, turn: rnd() * Math.PI * 2, tint: rnd() };
    trees.push(t);
    const k = key(Math.floor(x / cell), Math.floor(z / cell));
    const list = cellTrees.get(k);
    if (list) list.push(t); else cellTrees.set(k, [t]);
  };

  // nær løypa: små klynger tett i tett (de suser forbi). Lenger ut: større, glisnere skogholt opp i liene.
  const bands = [
    { ...F.near, scale: 1, stretch: 1.6 },
    { ...F.far, scale: F.height.farScale, stretch: 1.4 },
  ];
  for (const side of [-1, 1]) for (const b of bands) {
    for (let z = WORLD.zMin + 20; z < WORLD.zMax - 20; z += b.step[0] + rnd() * b.step[1]) {
      const cx = TREE_MIN_X + b.out[0] + rnd() * b.out[1];
      const n = b.count[0] + Math.floor(rnd() * b.count[1]);
      const spread = b.spread[0] + rnd() * b.spread[1];
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = spread * Math.sqrt(rnd());
        addTree(side * (cx + Math.cos(a) * r), z + Math.sin(a) * r * b.stretch, b.scale);
      }
    }
  }
  return trees;
}

export interface ForestChunk {
  trees: Tree[];
  /** Boksen rundt alle trærne i biten (hjørnene). */
  min: [number, number, number];
  max: [number, number, number];
}

/** Deler skogen i biter langs bakken og på hver side, med en boks rundt hver bit (for å skjule bitene i tåka). */
export function forestChunks(trees: Tree[]): ForestChunk[] {
  const map = new Map<string, ForestChunk>();
  for (const t of trees) {
    const k = `${Math.floor(t.z / LOOK.forest.chunk)},${t.x > 0 ? 1 : 0}`;
    let c = map.get(k);
    if (!c) { c = { trees: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; map.set(k, c); }
    c.trees.push(t);
    // kronen er omtrent en tredel av høyden bred til hver side
    const r = t.height * t.girth * 0.3;
    const lo = [t.x - r, t.y, t.z - r], hi = [t.x + r, t.y + t.height, t.z + r];
    for (let i = 0; i < 3; i++) { c.min[i] = Math.min(c.min[i], lo[i]); c.max[i] = Math.max(c.max[i], hi[i]); }
  }
  return [...map.values()];
}

export interface Marker {
  x: number;
  y: number;
  z: number;
}

/** To stolper med lykt ved kanten av hvert hopp, så hoppene syns på lang avstand. */
export function planMarkers(): Marker[] {
  const out: Marker[] = [];
  for (const k of PARK.kickers) {
    for (const side of [-1, 1]) {
      const x = side * (k.width / 2 + 5);
      const z = k.z - 2;
      out.push({ x, y: groundAt(x, z) - 0.3, z });
    }
  }
  return out;
}

/**
 * En fjellrygg rundt hele horisonten: høyden (som vinkel over horisonten, i grader) for
 * hver av `count` retninger. Summen av noen bølger med fast frø gir topper og skar.
 */
export function ridgeProfile(seed: number, count: number, low: number, high: number): number[] {
  const rnd = makeRandom(seed);
  // "rygget" bølger (1 - |sin|) gir skarpe topper og runde skar, som ekte fjell
  const waves = [3, 5, 9, 16, 29, 51].map((f, i) => ({
    f: f + Math.floor(rnd() * 3),
    p: rnd() * Math.PI * 2,
    a: 1 / (1 + i * 0.75),
  }));
  const total = waves.reduce((s, w) => s + w.a, 0);
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    let v = 0;
    for (const w of waves) v += w.a * (1 - Math.abs(Math.sin(ang * w.f + w.p))) ** 1.5;
    raw.push(v / total);
  }
  // strekk ut så laveste skar er `low` og høyeste topp er `high`
  const min = Math.min(...raw), max = Math.max(...raw);
  return raw.map((v) => low + (high - low) * ((v - min) / (max - min)) ** 1.3);
}
