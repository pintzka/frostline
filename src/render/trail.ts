import { CONFIG } from '../core/config';

/**
 * Hvor skisporene går: en liste med punkter bak skiløperen. Ren logikk uten three.js.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export interface TrailPoint {
  x: number; y: number; z: number;
  /** Sidevektor (lengde 1) vinkelrett på skiene, brukes til å plassere venstre og høyre spor. */
  rx: number; rz: number;
  /** Første punkt etter en landing: sporet skal ikke kobles til punktet før. */
  start?: boolean;
}

export function createTrail() {
  const max = CONFIG.trailMaxPoints;
  const ring: TrailPoint[] = [];
  let start = 0;
  let tip: TrailPoint | null = null;
  let airborne = false;

  function last(): TrailPoint | undefined {
    return ring.length ? ring[(start + ring.length - 1) % max] : undefined;
  }

  return {
    /**
     * x, y, z er midt under skiløperen. Sporet legges ved bakenden av skiene.
     * Kalles hvert bilde. Gir true når et nytt punkt ble lagt til.
     */
    update(cx: number, y: number, cz: number, heading: number, grounded = true): boolean {
      const back = CONFIG.skiLength / 2;
      const x = cx - Math.sin(heading) * back;
      const z = cz - Math.cos(heading) * back;
      // restart (R eller slutten av bakken): skiløperen hoppet langt på ett bilde, så start et helt nytt spor
      if (tip && Math.hypot(x - tip.x, z - tip.z) > CONFIG.camSnapDistance) { ring.length = 0; start = 0; airborne = false; }
      tip = { x, y, z, rx: Math.cos(heading), rz: -Math.sin(heading) };

      // i lufta blir det ikke spor; neste punkt på bakken starter et nytt stykke
      if (!grounded) { if (ring.length) airborne = true; return false; }

      const prev = last();
      if (prev && !airborne && Math.hypot(x - prev.x, z - prev.z) < CONFIG.trailSpacing) return false;
      const p: TrailPoint = { ...tip, start: airborne || undefined };
      airborne = false;
      if (ring.length < max) ring.push(p);
      else { ring[start] = p; start = (start + 1) % max; }
      return true;
    },
    /** Bakenden av skiene akkurat nå, så sporet går helt inntil skiene mellom de lagrede punktene. */
    tip(): TrailPoint {
      return tip ?? { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
    },
    /** Punktene fra eldste til nyeste. */
    points(): TrailPoint[] {
      const out: TrailPoint[] = [];
      for (let i = 0; i < ring.length; i++) out.push(ring[(start + i) % max]);
      return out;
    },
  };
}
