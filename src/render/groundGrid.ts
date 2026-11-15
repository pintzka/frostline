import { DECK, PARK } from '../park/terrain';
import { GROUND_HALF } from './sceneryLayout';

/**
 * Punktene i den preparerte bakken (meshen i scene.ts). Ren logikk uten three.js, så den kan testes.
 * Punktene står tett der bakken krummer mye (sidene av hoppene og kanten ned til platået),
 * og glissent der bakken er nesten rett. Da stemmer den synlige snøen med fysikkbakken (heightAt).
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */

/** Hvor den preparerte bakken begynner og slutter (m nedover). Slutten ligger godt forbi restart og utkjøringen. */
export const FINE = { zMin: -20, zMax: 600 };

/** Avstand mellom punktene (m). */
const STEP = { x: 2, xCenter: 1.5, xKickerSide: 0.2, z: 0.5, zLip: 0.25 };

/** Hopper over tall som ligger nesten oppå hverandre, og sorterer. */
function tidy(v: number[]): number[] {
  const s = [...v].sort((a, b) => a - b);
  return s.filter((x, i) => i === 0 || x - s[i - 1] > 1e-6);
}

/** Punkter fra a til b med høyst `step` mellom, og alltid med a og b. */
function fill(a: number, b: number, step: number): number[] {
  const n = Math.max(1, Math.ceil((b - a) / step - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** Punktene på tvers (x). Tett i overgangen der hoppene møter bakken på sidene. */
export function groundColumns(): number[] {
  // hoppene bøyer seg ned til bakken mellom halve bredden og halve bredden + 3 m (se terrain.ts)
  const sideMin = Math.min(...PARK.kickers.map((k) => k.width / 2));
  const sideMax = Math.max(...PARK.kickers.map((k) => k.width / 2 + 3));
  const half = [
    ...fill(0, sideMin, STEP.xCenter),
    ...fill(sideMin, sideMax, STEP.xKickerSide),
    ...fill(sideMax, GROUND_HALF, STEP.x),
  ];
  return tidy([...half.map((x) => -x), ...half]);
}

/** Punktene langs bakken (z). Tettere ved kanten ned til platået, og en rad akkurat på hver hoppkant. */
export function groundRows(): number[] {
  const rows = fill(FINE.zMin, FINE.zMax, STEP.z);
  for (const k of PARK.kickers) rows.push(...fill(k.z, k.z + DECK.drop, STEP.zLip));
  return tidy(rows);
}

/** Finn ruta (indeksen til punktet foran) som tallet ligger i. */
function cellOf(v: number[], x: number): number {
  let lo = 0, hi = v.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (v[mid] <= x) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/**
 * Høyden meshen faktisk viser i (x, z): hver rute er delt i to trekanter langs diagonalen
 * fra (x1, z0) til (x0, z1), akkurat som i scene.ts.
 */
export function meshHeight(xs: number[], zs: number[], h: (x: number, z: number) => number, x: number, z: number): number {
  const i = cellOf(xs, x), j = cellOf(zs, z);
  const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
  const s = (x - x0) / (x1 - x0), t = (z - z0) / (z1 - z0);
  const ha = h(x0, z0), hb = h(x1, z0), hc = h(x0, z1), hd = h(x1, z1);
  if (s + t <= 1) return ha + s * (hb - ha) + t * (hc - ha);
  return hd + (1 - s) * (hc - hd) + (1 - t) * (hb - hd);
}

/** Trekantene i rutenettet: rute (i, j) blir (a, c, b) og (b, c, d), så normalene peker opp. */
export function gridIndex(columns: number, rows: number): Uint32Array {
  const idx = new Uint32Array((columns - 1) * (rows - 1) * 6);
  let n = 0;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
    const a = j * columns + i, b = a + 1, c = a + columns, d = c + 1;
    idx[n++] = a; idx[n++] = c; idx[n++] = b;
    idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  return idx;
}
