import { CONFIG } from '../core/config';

/**
 * Hvor skisporene går: en liste med punkter bak skiløperen. Ren logikk uten three.js.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export interface TrailPoint {
  x: number; y: number; z: number;
  /** Sidevektor (lengde 1) vinkelrett på skiene, brukes til å plassere venstre og høyre spor. */
  rx: number; rz: number;
}

export function createTrail() {
  const max = CONFIG.trailMaxPoints;
  const ring: TrailPoint[] = [];
  let start = 0;

  function last(): TrailPoint | undefined {
    return ring.length ? ring[(start + ring.length - 1) % max] : undefined;
  }

  return {
    /** Legger til et punkt hvis skiløperen har kjørt langt nok. Gir true når sporet endret seg. */
    update(x: number, y: number, z: number, heading: number): boolean {
      const prev = last();
      if (prev) {
        const d = Math.hypot(x - prev.x, z - prev.z);
        if (d > CONFIG.camSnapDistance) { ring.length = 0; start = 0; }
        else if (d < CONFIG.trailSpacing) return false;
      }
      const p: TrailPoint = { x, y, z, rx: Math.cos(heading), rz: -Math.sin(heading) };
      if (ring.length < max) ring.push(p);
      else { ring[start] = p; start = (start + 1) % max; }
      return true;
    },
    /** Punktene fra eldste til nyeste. */
    points(): TrailPoint[] {
      const out: TrailPoint[] = [];
      for (let i = 0; i < ring.length; i++) out.push(ring[(start + i) % max]);
      return out;
    },
  };
}
