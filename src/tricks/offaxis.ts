import { CONFIG } from '../core/config';

/**
 * Off-axis (cork og rodeo): kroppens stilling i lufta som en kvaternion. Ren logikk uten three.js.
 * Arbeidsstrøm 3 (Triks og poeng) eier denne fila.
 *
 * Koordinater er figurens egne: x = venstre, y = opp, z = framover (som i character/placeholder.ts).
 *
 * Vanlig hopp: spinnet er rundt den loddrette aksen, flipen rundt kroppens egen sideakse
 *   (stilling = spinn · flip, samme som før).
 * Off-axis: kroppen snurrer rundt seg selv (hode til føtter) mens den tipper over på skrå, rundt en
 *   vannrett akse som er vridd offAxisTiltDeg fra sideaksen mot fartsretningen (stilling = skråflip · spinn).
 *   Hodet går framover/bakover og ut mot den siden du spinner. Det gir én skrå rotasjonsakse,
 *   ikke spinn og flip etter hverandre.
 *
 * Mellom de to blandes det mykt (blend 0 = vanlig, 1 = off-axis), så kroppen aldri hopper.
 */

/** Kvaternion [x, y, z, w]. */
export type Quat = [number, number, number, number];

const DEG = Math.PI / 180;

export function quatAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return [ax * s, ay * s, az * s, Math.cos(angle / 2)];
}

/** a · b: først b, så a. */
export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Roterer vektoren v med q. */
export function rotateVec(q: Quat, v: readonly [number, number, number]): [number, number, number] {
  const [x, y, z, w] = q;
  // v + 2w(q×v) + 2q×(q×v)
  const cx = y * v[2] - z * v[1], cy = z * v[0] - x * v[2], cz = x * v[1] - y * v[0];
  const dx = y * cz - z * cy, dy = z * cx - x * cz, dz = x * cy - y * cx;
  return [v[0] + 2 * (w * cx + dx), v[1] + 2 * (w * cy + dy), v[2] + 2 * (w * cz + dz)];
}

/** Myk blanding mellom to stillinger (korteste vei). */
export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b;
  let dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot; }
  let ka = 1 - t, kb = t;
  if (dot < 0.9995) {
    const th = Math.acos(dot), s = Math.sin(th);
    ka = Math.sin((1 - t) * th) / s; kb = Math.sin(t * th) / s;
  }
  const q: Quat = [ka * a[0] + kb * bx, ka * a[1] + kb * by, ka * a[2] + kb * bz, ka * a[3] + kb * bw];
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Vinkelen (rad) mellom to stillinger. */
export function quatAngle(a: Quat, b: Quat): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, dot));
}

/**
 * Stillingen til kroppen. spin og flip i rad (spinn positiv = mot høyre, flip positiv = framover).
 * blend: 0 = vanlig spinn og flip, 1 = off-axis.
 * side = spinnretning × flipretning (±1). Den vrir den skrå aksen slik at hodet alltid tipper ut mot den siden du spinner.
 */
export function bodyQuat(spin: number, flip: number, blend = 0, side = 1): Quat {
  // spinn mot høyre er negativ rotasjon rundt y, fordi x peker til venstre
  const qSpin = quatAxisAngle(0, 1, 0, -spin);
  const normal = quatMul(qSpin, quatAxisAngle(1, 0, 0, flip));
  if (blend <= 0) return normal;
  // skrå, vannrett akse: sideaksen (x) vridd mot fartsretningen (z), på den siden hodet skal tippe mot
  const b = CONFIG.offAxisTiltDeg * DEG;
  const off = quatMul(quatAxisAngle(Math.cos(b), 0, side * Math.sin(b), flip), qSpin);
  return blend >= 1 ? off : quatSlerp(normal, off, blend);
}

/**
 * Hvor kroppen faktisk står: tilt = vinkelen (grader) mellom kroppens «opp» og rett opp,
 * heading = hvilken vei brystet/skiene peker rundt den loddrette aksen (rad, samme fortegn som spinn).
 */
export function bodyStance(q: Quat): { tiltDeg: number; heading: number } {
  const up = rotateVec(q, [0, 1, 0]);
  const tiltDeg = Math.acos(Math.max(-1, Math.min(1, up[1]))) / DEG;
  // skiene peker langs z. Står kroppen på hodet, snus de, men da er det et fall uansett
  const fwd = rotateVec(q, [0, 0, 1]);
  const flipSign = up[1] < 0 ? -1 : 1;
  const heading = Math.atan2(-fwd[0] * flipSign, fwd[2] * flipSign);
  return { tiltDeg, heading };
}
