import { LOOK } from './look';

/**
 * Små regnestykker for miljøet: tåke, lykteglød, skygger og fjell. Ren logikk uten three.js, så de kan testes.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export type Vec3 = [number, number, number];

/**
 * Hvor mye tåke (0–1) noe har, ut fra avstanden til kameraet. Samme regel som shaderen bruker:
 * avstanden er rett linje fra kameraet (radial), så det ikke betyr noe hvor kameraet peker.
 */
export function fogAmount(distance: number): number {
  const { near, far } = LOOK.fog;
  return Math.min(1, Math.max(0, (distance - near) / (far - near)));
}

/** Hvor sterk lyktegløden er (0–1): full nært, borte litt lenger ute enn tåka. */
export function glowStrength(distance: number): number {
  const { near, far } = LOOK.fog;
  const end = far * LOOK.glow.fadeEndFactor;
  const t = Math.min(1, Math.max(0, (distance - near) / (end - near)));
  return 1 - t * t * (3 - 2 * t);
}

/** Korteste avstand fra et punkt til en boks (0 inne i boksen). */
export function distanceToBox(p: Vec3, min: Vec3, max: Vec3): number {
  let s = 0;
  for (let i = 0; i < 3; i++) {
    const d = Math.max(min[i] - p[i], 0, p[i] - max[i]);
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Er hele boksen så langt unna at den bare er tåke? Da trenger den ikke tegnes. */
export function hiddenByFog(cam: Vec3, min: Vec3, max: Vec3): boolean {
  return distanceToBox(cam, min, max) >= LOOK.fog.far;
}

/** Retningene skyggekameraet ser verden i: høyre, opp, og retningen mot sola (samme som three.js lookAt). */
function lightAxes(toSun: Vec3): [Vec3, Vec3, Vec3] {
  const l = Math.hypot(...toSun);
  const z: Vec3 = [toSun[0] / l, toSun[1] / l, toSun[2] / l];
  // høyre = opp × z
  let x: Vec3 = [z[2], 0, -z[0]];
  const xl = Math.hypot(...x);
  x = [x[0] / xl, x[1] / xl, x[2] / xl];
  const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [x, y, z];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Størrelsen på én skyggepiksel (m). */
export function shadowTexel(): number {
  return (2 * LOOK.shadow.half) / LOOK.shadow.mapSize;
}

/**
 * Flytter midtpunktet for skyggene til nærmeste hele skyggepiksel (sett fra sola).
 * Da står skyggepikslene stille i verden mens skiløperen beveger seg, og kantene flimrer ikke.
 */
export function snapShadowTarget(target: Vec3, toSun: Vec3, texel = shadowTexel()): Vec3 {
  const [x, y, z] = lightAxes(toSun);
  const a = Math.round(dot(target, x) / texel) * texel;
  const b = Math.round(dot(target, y) / texel) * texel;
  const c = dot(target, z);
  return [
    x[0] * a + y[0] * b + z[0] * c,
    x[1] * a + y[1] * b + z[1] * c,
    x[2] * a + y[2] * b + z[2] * c,
  ];
}

/** Brukes av testene: hvor punktet ligger sett fra sola (høyre, opp). */
export function lightPlaneCoords(p: Vec3, toSun: Vec3): [number, number] {
  const [x, y] = lightAxes(toSun);
  return [dot(p, x), dot(p, y)];
}

/**
 * Hvor midten av en fjellring skal stå. Ringen følger kameraet, men står `parallax` fast i verden
 * rundt et fast punkt (starten), så den glir sakte forbi uten å hoppe mye ved restart.
 */
export function ringCenter(cam: Vec3, anchor: Vec3, parallax: number): Vec3 {
  return [
    cam[0] + (anchor[0] - cam[0]) * parallax,
    cam[1],
    cam[2] + (anchor[2] - cam[2]) * parallax,
  ];
}
