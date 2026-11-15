import { heightAt, PARK } from '../park/terrain';
import { LOOK } from './look';
import { GROUND_HALF } from './sceneryLayout';

/**
 * Punktene i den preparerte bakken (meshen i scene.ts). Ren logikk uten three.js, så den kan testes.
 *
 * Punktene settes ut fra hvor mye bakken faktisk krummer (målt på heightAt): tett der hoppene
 * bøyer seg (rampe, kant, sider og landing), glissent der bakken er nesten rett. Da følger den
 * tette sonen hoppene av seg selv, også hvis hoppene blir bredere eller flyttes.
 * Hver rad kan ha sine egne punkter på tvers; radene sys sammen med trekanter uten hull.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */

/** Hvor den preparerte bakken begynner og slutter (m nedover). Slutten ligger godt forbi restart og utkjøringen. */
export const FINE = { zMin: -20, zMax: 600 };

const G = LOOK.ground;

/** Avstanden mellom punktene som holder avviket under toleransen der bakken krummer så mye. */
function spacingFor(curvature: number, max: number): number {
  if (curvature < 1e-9) return max;
  return Math.min(max, Math.max(G.minSpacing, Math.sqrt((8 * G.tolerance) / curvature)));
}

/**
 * Setter ut punkter fra a til b. `need[k]` er største tillatte avstand ved prøvepunkt k (hver `h` meter).
 * Punktene i `must` kommer alltid med (f.eks. hoppkanten, der rampen knekker).
 */
function place(a: number, b: number, h: number, need: number[], must: number[] = []): number[] {
  const minNeed = (p: number, q: number) => {
    let m = Infinity;
    const k0 = Math.max(0, Math.floor((p - a) / h)), k1 = Math.min(need.length - 1, Math.ceil((q - a) / h));
    for (let k = k0; k <= k1; k++) m = Math.min(m, need[k]);
    return m;
  };
  const out = [a];
  let p = a;
  while (b - p > 1e-6) {
    // ta så langt steg som mulig, men aldri lenger enn det tetteste kravet på veien
    let s = minNeed(p, p);
    for (let i = 0; i < 6; i++) {
      const s2 = minNeed(p, p + s);
      if (s2 >= s) break;
      s = s2;
    }
    let next = Math.min(b, p + s);
    for (const m of must) if (m > p + 1e-6 && m < next) next = m;
    out.push(next);
    p = next;
  }
  return out;
}

/** Høyden prøvd i et rutenett: rad for hver `hz` meter langs bakken, punkt for hver `hx` meter på tvers. */
function sampleRow(z: number, hx: number): number[] {
  const out: number[] = [];
  for (let x = -GROUND_HALF - hx; x <= GROUND_HALF + hx + 1e-9; x += hx) out.push(heightAt(x, z));
  return out;
}

/** Hvor mye bakken krummer, ut fra tre prøverader (før, her, etter). Kryssleddet merkes på skrå i trekantene. */
function bend(prev: number[], here: number[], next: number[], k: number, hx: number, hz: number) {
  return {
    xx: Math.abs(here[k + 1] - 2 * here[k] + here[k - 1]) / (hx * hx),
    zz: Math.abs(next[k] - 2 * here[k] + prev[k]) / (hz * hz),
    xz: Math.abs(next[k + 1] - next[k - 1] - prev[k + 1] + prev[k - 1]) / (4 * hx * hz),
  };
}

/** Radene langs bakken (z). */
export function groundRows(): number[] {
  const hz = 0.25, hx = 1;
  const need: number[] = [];
  let prev = sampleRow(FINE.zMin - hz, hx), here = sampleRow(FINE.zMin, hx);
  for (let z = FINE.zMin; z <= FINE.zMax + 1e-9; z += hz) {
    const next = sampleRow(z + hz, hx);
    let c = 0;
    for (let k = 1; k < here.length - 1; k++) {
      const b = bend(prev, here, next, k, hx, hz);
      // krumningen langs bakken og på skrå legges sammen: trekantene går på skrå over begge
      c = Math.max(c, b.zz + b.xz);
    }
    need.push(spacingFor(c, G.maxRowSpacing));
    prev = here; here = next;
  }
  // hoppkanten er en knekk (ikke en kurve), så den må ligge akkurat på en rad
  return place(FINE.zMin, FINE.zMax, hz, need, PARK.kickers.map((k) => k.z));
}

/** Kravet til avstand på tvers langs én rad, prøvd hver `h` meter. */
function columnNeed(z: number, h: number): number[] {
  const prev = sampleRow(z - h, h), here = sampleRow(z, h), next = sampleRow(z + h, h);
  const need: number[] = [];
  for (let k = 1; k < here.length - 1; k++) {
    const b = bend(prev, here, next, k, h, h);
    need.push(spacingFor(Math.max(b.xx, b.xz), G.maxColumnSpacing));
  }
  return need;
}

export interface GroundMesh {
  /** x, y, z for hvert punkt. */
  positions: Float32Array;
  /** Tre punkter per trekant. Normalene peker opp. */
  indices: Uint32Array;
  rows: number;
}

/** Bygger hele den preparerte bakken: punkter og trekanter. */
export function buildGroundMesh(): GroundMesh {
  const zs = groundRows();
  const h = 0.2;
  const needs = zs.map((z) => columnNeed(z, h));
  // hver rad bruker det strengeste kravet av seg selv og naboene, så trekantene mellom radene også holder
  const cols = zs.map((_, j) => {
    const own = needs[j], prev = needs[j - 1] ?? own, next = needs[j + 1] ?? own;
    const need = own.map((v, k) => Math.min(v, prev[k], next[k]));
    return place(-GROUND_HALF, GROUND_HALF, h, need);
  });

  const count = cols.reduce((s, c) => s + c.length, 0);
  const positions = new Float32Array(count * 3);
  const start: number[] = [];
  let n = 0;
  zs.forEach((z, j) => {
    start.push(n / 3);
    for (const x of cols[j]) { positions[n++] = x; positions[n++] = heightAt(x, z); positions[n++] = z; }
  });

  // sy sammen to og to rader: gå bortover begge samtidig og lag en trekant for hvert steg
  const idx: number[] = [];
  for (let j = 0; j < zs.length - 1; j++) {
    const A = cols[j], B = cols[j + 1], a0 = start[j], b0 = start[j + 1];
    let i = 0, k = 0;
    while (i < A.length - 1 || k < B.length - 1) {
      if (k === B.length - 1 || (i < A.length - 1 && A[i + 1] <= B[k + 1])) {
        idx.push(a0 + i, b0 + k, a0 + i + 1);
        i++;
      } else {
        idx.push(a0 + i, b0 + k, b0 + k + 1);
        k++;
      }
    }
  }
  return { positions, indices: new Uint32Array(idx), rows: zs.length };
}
