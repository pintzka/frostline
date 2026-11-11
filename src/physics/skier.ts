import { CONFIG } from '../core/config';
import { heightAt, normalAt, PARK, rampLength } from '../park/terrain';

/**
 * Skiløperens fysikk. Ren logikk uten three.js, så den kan testes.
 * Arbeidsstrøm 1 (Kjernefysikk) eier denne fila.
 */
export interface SkierState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Retningen skiene peker (rad). 0 = rett ned bakken (+z). */
  heading: number;
  /** Hvor mye skiene står på kant, -1 (venstre) til 1 (høyre). Følger styringen mykt. */
  edge: number;
  /** Hvor mye skiløperen lener seg inn i svingen (rad). Positiv = mot høyre. */
  lean: number;
  /** Hvor fort leningen endrer seg (rad/s). Gjør at leningen starter rolig i stedet for å rykke. */
  leanRate: number;
  grounded: boolean;
  /** Sekunder i lufta i det siste (eller pågående) hoppet. */
  airTime: number;
  /** Hvor mye pop er ladet opp (0–1) mens pop-knappen holdes. */
  popCharge: number;
  /** Om pop-knappen var holdt forrige steg (for å merke når den slippes). */
  popHeld: boolean;
  /** Siste pop: '' (ingen ennå), 'pop' eller 'perfekt'. */
  lastPop: '' | 'pop' | 'perfekt';
  /** Sekunder siden siste pop (for visning på skjermen). */
  popAge: number;
  /** Sekunder siden siste landing (for fjæringen i kroppen). */
  sinceLanding: number;
}

export interface SkierInput {
  /** -1 (venstre) til 1 (høyre) */
  steer: number;
  /** 0–1, brems/plog */
  brake: number;
  /** Holdes for å lade pop, slippes for å sprette. */
  pop?: boolean;
}

export function createSkier(): SkierState {
  const z = 5;
  return { x: 0, y: heightAt(0, z), z, vx: 0, vy: 0, vz: 2, heading: 0, edge: 0, lean: 0, leanRate: 0, grounded: true, airTime: 0,
    popCharge: 0, popHeld: false, lastPop: '', popAge: 99, sinceLanding: 99 };
}

/** Er skiløperen akkurat foran kanten på et hopp (innenfor vinduet for perfekt pop)? */
function atLip(s: SkierState): boolean {
  const window = Math.max(1, s.vz) * CONFIG.popPerfectWindow;
  return PARK.kickers.some((k) => {
    const d = k.z - s.z;
    return d >= 0 && d <= window && Math.abs(s.x) < k.width / 2;
  });
}

/** Står skiløperen på rampen til et hopp? Der gjør rampen mesteparten av jobben, så pop er svakere. */
function onRamp(s: SkierState): boolean {
  return PARK.kickers.some((k) => {
    const u = s.z - k.z;
    return u >= -rampLength(k) && u <= 0.5 && Math.abs(s.x) < k.width / 2 + 1;
  });
}

/** Spretter opp fra bakken. Sterkere jo lenger du har ladet, og ekstra sterkt på kanten. */
function doPop(s: SkierState): void {
  const [nx, ny, nz] = normalAt(s.x, s.z);
  const perfect = atLip(s);
  const full = onRamp(s) ? CONFIG.popSpeedRamp : CONFIG.popSpeed;
  let strength = full * (CONFIG.popMinCharge + (1 - CONFIG.popMinCharge) * s.popCharge);
  if (perfect) strength *= CONFIG.popPerfectBoost;
  s.vx += nx * strength; s.vy += ny * strength; s.vz += nz * strength;
  s.grounded = false;
  s.airTime = 0;
  s.lastPop = perfect ? 'perfekt' : 'pop';
  s.popAge = 0;
}

/** Sant når skiløperen er så nær slutten av bakken at runden bør starte på nytt. */
export function reachedEnd(s: SkierState): boolean {
  return s.z > PARK.length - CONFIG.runEndMargin;
}

export function speedOf(s: SkierState): number {
  return Math.hypot(s.vx, s.vy, s.vz);
}

export function stepSkier(s: SkierState, inp: SkierInput, dt: number): void {
  const g = CONFIG.gravity;

  // kanten bygges opp og slippes mykt, selv om tastaturet bare er av/på
  s.edge += (inp.steer - s.edge) * (1 - Math.exp(-CONFIG.edgeResponse * dt));
  // i høy fart begrenses svingen av hvor hardt kanten kan presse; i lufta har kanten ingenting å ta i
  const turnRate = s.grounded ? Math.min(CONFIG.turnRate, CONFIG.carveAccel / Math.max(speedOf(s), 1e-3)) : 0;
  s.heading += -s.edge * turnRate * dt;

  // len inn i svingen like mye som svingen presser (som en ekte skiløper), men aldri mer enn maks
  const sideAccel = speedOf(s) * s.edge * turnRate;
  const wantLean = Math.max(-CONFIG.maxLean, Math.min(CONFIG.maxLean, Math.atan(sideAccel / g)));
  // myk fjær (kritisk dempet): starter rolig, glir på plass og skyter ikke over
  const w = CONFIG.leanSpeed;
  s.leanRate += (w * w * (wantLean - s.lean) - 2 * w * s.leanRate) * dt;
  s.lean = Math.max(-CONFIG.maxLean, Math.min(CONFIG.maxLean, s.lean + s.leanRate * dt));

  // pop: lad mens knappen holdes på bakken, sprett når den slippes (i lufta skjer ingenting)
  s.popAge += dt;
  s.sinceLanding += dt;
  const holding = !!inp.pop;
  if (holding) {
    if (s.grounded) s.popCharge = Math.min(1, s.popCharge + dt / CONFIG.popChargeTime);
  } else {
    if (s.popHeld && s.grounded && s.popCharge > 0) doPop(s);
    s.popCharge = 0;
  }
  s.popHeld = holding;

  // letter vi? Faller bakken rett foran bort raskere enn vi ville falt i fritt fall (kanten på et hopp),
  // flyr vi videre med farten vi har, før helningen på baksiden får bøye farten nedover
  if (s.grounded) {
    const aheadY = heightAt(s.x + s.vx * dt, s.z + s.vz * dt);
    const flyY = s.y + s.vy * dt - 0.5 * g * dt * dt;
    if (flyY - aheadY > CONFIG.takeoffGap) { s.grounded = false; s.airTime = 0; }
  }

  if (s.grounded) {
    const [nx, ny, nz] = normalAt(s.x, s.z);
    // tyngdekraftens komponent langs bakken, forsterket så det føles raskt
    const gDotN = -g * ny;
    const ax = -gDotN * nx * CONFIG.slopeAccel;
    const ay = (-g - gDotN * ny) * CONFIG.slopeAccel;
    const az = -gDotN * nz * CONFIG.slopeAccel;

    // skienes retning projisert på bakken
    let fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    let fy = -(nx * fx + nz * fz) / ny;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;

    // carving: skiene vrir farten inn i sin egen retning og beholder den
    const vAlong = s.vx * fx + s.vy * fy + s.vz * fz;
    const sx = s.vx - vAlong * fx, sy = s.vy - vAlong * fy, sz = s.vz - vAlong * fz;
    const side = Math.hypot(sx, sy, sz);
    const keep = Math.exp(-CONFIG.edgeGrip * dt);
    const newSide = side * keep;
    const newAlong = (vAlong < 0 ? -1 : 1) * Math.sqrt(vAlong * vAlong + side * side - newSide * newSide);
    s.vx = newAlong * fx + sx * keep;
    s.vy = newAlong * fy + sy * keep;
    s.vz = newAlong * fz + sz * keep;

    s.vx += ax * dt; s.vy += ay * dt; s.vz += az * dt;

    // friksjon + luftmotstand + skrens + brems kan bare stoppe deg, aldri dytte deg bakover
    const v = speedOf(s);
    if (v > 0) {
      const drag = CONFIG.dragCoef * v * v + CONFIG.snowFriction * g + CONFIG.skidFriction * side + inp.brake * CONFIG.brakeDecel;
      const k = Math.max(0, v - drag * dt) / v;
      s.vx *= k; s.vy *= k; s.vz *= k;
    }

    // hold farten langs bakken
    const vn = s.vx * nx + s.vy * ny + s.vz * nz;
    s.vx -= vn * nx; s.vy -= vn * ny; s.vz -= vn * nz;

    // toppfart (bare på bakken; i lufta bestemmer tyngdekraften). Er du over, f.eks. etter et hopp,
    // tas farten mykt ned over et par sekunder i stedet for å kuttes med en gang
    const vt = speedOf(s);
    if (vt > CONFIG.maxSpeed) {
      const want = CONFIG.maxSpeed + (vt - CONFIG.maxSpeed) * Math.exp(-dt / CONFIG.overspeedFade);
      const k = want / vt;
      s.vx *= k; s.vy *= k; s.vz *= k;
    }
  } else {
    // i lufta: vanlig tyngdekraft, ingen forsterkning
    s.vy -= g * dt;
    s.airTime += dt;
  }

  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;

  // hold deg innenfor parken
  const half = PARK.width / 2;
  if (s.x < -half) { s.x = -half; s.vx = Math.abs(s.vx) * 0.3; }
  if (s.x > half) { s.x = half; s.vx = -Math.abs(s.vx) * 0.3; }

  const h = heightAt(s.x, s.z);
  if (s.grounded) {
    if (s.y - h > CONFIG.takeoffGap) {
      // bakken forsvant under skiene (kanten på et hopp): nå flyr du
      s.grounded = false;
      s.airTime = 0;
    } else {
      s.y = h;
    }
  } else if (s.y <= h) {
    // landing: farten rett inn i bakken tas opp av beina, farten langs bakken beholdes
    s.y = h;
    s.grounded = true;
    s.sinceLanding = 0;
    const [nx, ny, nz] = normalAt(s.x, s.z);
    const vn = s.vx * nx + s.vy * ny + s.vz * nz;
    if (vn < 0) { s.vx -= vn * nx; s.vy -= vn * ny; s.vz -= vn * nz; }
  }
}
