import { CONFIG } from '../core/config';

/**
 * Snøsprut: hvor mye snø som skal sprute, hvor den kastes og hvor lenge den lever.
 * Ren logikk uten three.js, så den kan testes. sprayMesh.ts tegner den.
 * Alle partiklene ligger i faste tall-lister (ingen nye objekter per bilde).
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export interface SprayFrame {
  /** Tid siden forrige bilde (s). */
  dt: number;
  /** Midt under skiløperen. */
  x: number; y: number; z: number;
  heading: number;
  vx: number; vy: number; vz: number;
  /** Kanten fra fysikken, -1 til 1. */
  edge: number;
  /** Bremseknappen, 0–1. */
  brake: number;
  grounded: boolean;
  sinceLanding: number;
  popAge: number;
  airTime: number;
  /** Bakkens normal under skiløperen. */
  nx: number; ny: number; nz: number;
  /** Siste pop: '' (ingen), 'pop' eller 'perfekt'. */
  lastPop: '' | 'pop' | 'perfekt';
  /** Hvor kameraet står, så sprut helt inntil det kan tones bort. */
  camX: number; camY: number; camZ: number;
}

type Kind = keyof typeof CONFIG.sprayLooks;

/** 0 under a, 1 over b, og en myk S-kurve imellom. */
function smooth(a: number, b: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Carving: partikler per sekund. Mer jo hardere kanten og jo høyere farten. */
export function carveRate(edge: number, speed: number): number {
  return CONFIG.sprayCarveRate * Math.abs(edge) ** CONFIG.sprayCarveCurve * smooth(CONFIG.sprayMinSpeed, CONFIG.sprayFullSpeed, speed);
}

/** Brems: partikler per sekund. level er hvor mye bremsen er inne (0–1, glir mykt). */
export function brakeRate(level: number, speed: number): number {
  return CONFIG.sprayBrakeRate * level * smooth(1, CONFIG.sprayBrakeFullSpeed, speed);
}

/** Landing: hvor mange partikler puffen får. impact er farten rett inn i bakken (m/s). */
export function landingCount(impact: number, speed: number): number {
  if (impact < CONFIG.sprayLandMinImpact) return 0;
  return Math.min(CONFIG.sprayLandMax, Math.round(CONFIG.sprayLandPerImpact * impact + CONFIG.sprayLandPerSpeed * speed));
}

export function createSpray(opts: { seed?: number; groundAt?: (x: number, z: number) => number } = {}) {
  const max = CONFIG.sprayMax;
  const ground = opts.groundAt;
  // fast frø: samme sprut hver gang (mulberry32)
  let seed = (opts.seed ?? 1) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (r: readonly number[]) => r[0] + (r[1] - r[0]) * rnd();

  // dette leser tegningen
  const positions = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const alphas = new Float32Array(max);
  /** Et fast tilfeldig tall per partikkel (0–1): gir litt ulik farge og vridning. */
  const seeds = new Float32Array(max);
  // dette trenger bare logikken
  const vel = new Float32Array(max * 3);
  const age = new Float32Array(max);
  const life = new Float32Array(max);
  const size0 = new Float32Array(max);
  const grow = new Float32Array(max);

  let count = 0;
  let emitted = 0;
  // brøkdeler av partikler som ikke ble sendt ut ennå, så mengden blir lik uansett fps
  let carveDebt = 0, brakeDebt = 0;
  let brakeLevel = 0;
  let lastX = NaN, lastZ = NaN;
  let lastSince = NaN, lastPopAge = NaN;
  // farten i siste bilde i lufta, for å vite hvor hardt du lander
  let airVx = 0, airVy = 0, airVz = 0, sawAir = false;

  /** Flytter én partikkel framover i tid: lett snø med luftbrems, som legger seg på bakken. */
  function move(i: number, dt: number) {
    const k = Math.exp(-CONFIG.sprayDrag * dt);
    const j = i * 3;
    vel[j] *= k; vel[j + 2] *= k;
    vel[j + 1] = vel[j + 1] * k - CONFIG.sprayGravity * dt;
    positions[j] += vel[j] * dt;
    positions[j + 1] += vel[j + 1] * dt;
    positions[j + 2] += vel[j + 2] * dt;
    age[i] += dt;
    if (onGround(i)) {
      // landet på snøen: blir liggende og glir litt ut
      vel[j + 1] = 0;
      const f = Math.exp(-CONFIG.spraySettleDrag * dt);
      vel[j] *= f; vel[j + 2] *= f;
    }
  }

  /** Hvor stor partikkelen er nå (m): vokser fort først, så roligere. */
  function sizeOf(i: number) {
    const t = Math.min(1, age[i] / life[i]);
    return size0[i] * (1 + (grow[i] - 1) * (1 - (1 - t) * (1 - t)));
  }

  /**
   * Holder partikkelen oppå snøen. Den løftes litt etter størrelsen, ellers kutter bakken
   * den nederste halvdelen av sky-bildet med en skarp strek. Sant hvis den ligger på bakken.
   */
  function onGround(i: number) {
    if (!ground) return false;
    const j = i * 3;
    const floor = ground(positions[j], positions[j + 2]) + CONFIG.sprayGroundLift * sizeOf(i);
    if (positions[j + 1] >= floor) return false;
    positions[j + 1] = floor;
    return true;
  }

  /** Lager én partikkel. preAge: hvor langt inn i bildet den egentlig ble laget (s). */
  function emit(kind: Kind, x: number, y: number, z: number, vx: number, vy: number, vz: number, preAge: number) {
    if (count >= max) return;
    const look = CONFIG.sprayLooks[kind];
    const i = count++;
    const j = i * 3;
    positions[j] = x; positions[j + 1] = y; positions[j + 2] = z;
    vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
    age[i] = 0;
    life[i] = range(look.life);
    size0[i] = range(look.size);
    grow[i] = look.grow;
    seeds[i] = rnd();
    emitted++;
    if (preAge > 0) move(i, preAge); else onGround(i);
  }

  /** Hvor fort bakken synker under skiløperen (m/s), så puffen følger helningen og ikke svever opp fra den. */
  function slopeVy(f: SprayFrame) {
    if (!ground) return 0;
    const e = 0.05;
    return (ground(f.x + f.vx * e, f.z + f.vz * e) - ground(f.x, f.z)) / e;
  }

  function groundY(x: number, z: number, fallback: number) {
    return (ground ? ground(x, z) : fallback) + CONFIG.spraySpawnLift;
  }

  return {
    positions, sizes, alphas, seeds,
    /** Hvor mange partikler som lever nå (de ligger først i listene). */
    get count() { return count; },
    /** Hvor mange partikler som er laget totalt (for tester). */
    get emitted() { return emitted; },

    update(f: SprayFrame) {
      const dt = Math.max(0, f.dt);
      const speed = Math.hypot(f.vx, f.vy, f.vz);
      // retninger: fram langs skiene, og ut til siden (yttersiden av svingen når edge > 0)
      const fx = Math.sin(f.heading), fz = Math.cos(f.heading);
      const sx = Math.cos(f.heading), sz = -Math.sin(f.heading);

      // restart eller første bilde: ikke dra sprut fra gammel plass
      if (!(Math.hypot(f.x - lastX, f.z - lastZ) < CONFIG.camSnapDistance)) { lastX = f.x; lastZ = f.z; }

      // 1) flytt og bleik de som lever; døde byttes ut med den siste i lista
      for (let i = 0; i < count; ) {
        move(i, dt);
        if (age[i] >= life[i]) {
          const last = --count;
          if (i !== last) {
            const a = i * 3, b = last * 3;
            for (let c = 0; c < 3; c++) { positions[a + c] = positions[b + c]; vel[a + c] = vel[b + c]; }
            age[i] = age[last]; life[i] = life[last]; size0[i] = size0[last]; grow[i] = grow[last]; seeds[i] = seeds[last];
          }
          continue;
        }
        i++;
      }

      // 2) bremsen glir mykt inn og ut, selv om tasten bare er av/på
      const before = brakeLevel;
      brakeLevel += (f.brake - brakeLevel) * (1 - Math.exp(-CONFIG.sprayBrakeResponse * dt));
      const brakeAvg = (before + brakeLevel) / 2;

      // 3) jevn sprut fra skiene, bare på bakken
      if (f.grounded) {
        carveDebt += carveRate(f.edge, speed) * dt;
        brakeDebt += brakeRate(brakeAvg, speed) * dt;
      } else {
        carveDebt = 0; brakeDebt = 0;
      }
      const inh = CONFIG.sprayInherit;
      const sf = smooth(CONFIG.sprayMinSpeed, CONFIG.sprayFullSpeed, speed);
      const half = CONFIG.skiLength / 2;
      const SP = CONFIG.spraySpread;

      while (carveDebt >= 1) {
        carveDebt -= 1;
        // spredt utover hele bildet, langs veien skiløperen kjørte
        const u = rnd();
        const out = f.edge < 0 ? -1 : 1;
        const along = half * range(SP.carve.along);
        const side = out * (CONFIG.skiGap / 2 + range(SP.carve.side));
        const x = lastX + (f.x - lastX) * u + fx * along + sx * side;
        const z = lastZ + (f.z - lastZ) * u + fz * along + sz * side;
        // i lav fart kastes snøen kortere
        const slow = SP.carve.slowThrow;
        const t = CONFIG.sprayLooks.carve.throw * (slow + (1 - slow) * sf) * range(SP.carve.throwMul);
        const back = -SP.carve.back * rnd();
        const [u0, u1] = SP.carve.up;
        const jit = SP.carve.jitter;
        emit('carve', x, groundY(x, z, f.y), z,
          f.vx * inh + sx * out * t + fx * back + (rnd() - 0.5) * jit,
          f.vy * inh + u0 + (u1 - u0) * sf * rnd(),
          f.vz * inh + sz * out * t + fz * back + (rnd() - 0.5) * jit,
          (1 - u) * dt);
      }

      while (brakeDebt >= 1) {
        brakeDebt -= 1;
        // plog: halene skyves ut til begge sider, snøen kastes fram og ut
        const u = rnd();
        const out = rnd() < 0.5 ? -1 : 1;
        const along = half * range(SP.brake.along);
        const side = out * (CONFIG.skiGap / 2 + range(SP.brake.side));
        const x = lastX + (f.x - lastX) * u + fx * along + sx * side;
        const z = lastZ + (f.z - lastZ) * u + fz * along + sz * side;
        const t = CONFIG.sprayLooks.brake.throw * range(SP.brake.throwMul);
        const fwd = range(SP.brake.forward);
        const bi = inh + SP.brake.extraInherit;
        emit('brake', x, groundY(x, z, f.y), z,
          f.vx * bi + sx * out * t + fx * fwd,
          f.vy * inh + range(SP.brake.up),
          f.vz * bi + sz * out * t + fz * fwd,
          (1 - u) * dt);
      }

      // 4) landing: en puff rundt skiene, større jo hardere og raskere
      if (!f.grounded) { airVx = f.vx; airVy = f.vy; airVz = f.vz; sawAir = true; }
      if (f.sinceLanding < lastSince && f.grounded && sawAir && f.airTime >= CONFIG.sprayLandMinAir) {
        const impact = -(airVx * f.nx + airVy * f.ny + airVz * f.nz);
        const n = landingCount(impact, speed);
        const LS = CONFIG.sprayLandStrength;
        const strength = Math.min(LS.max, LS.base + impact * LS.perImpact);
        const vyg = slopeVy(f) * inh;
        for (let k = 0; k < n; k++) {
          const a = rnd() * Math.PI * 2;
          const r = range(SP.land.radius);
          const cx = Math.cos(a), cz = Math.sin(a);
          const x = f.x + cx * r, z = f.z + cz * r;
          const t = CONFIG.sprayLooks.land.throw * strength * range(SP.land.throwMul);
          const [u0, u1] = SP.land.up;
          emit('land', x, groundY(x, z, f.y), z,
            f.vx * inh + cx * t, vyg + u0 + (u1 - u0) * strength * rnd(), f.vz * inh + cz * t, rnd() * dt);
        }
      }
      if (f.grounded) sawAir = false;

      // 5) pop: litt fokk bak skiene der du sparket fra
      if (f.popAge < lastPopAge) {
        const vyg = slopeVy(f) * inh;
        const n = Math.round(CONFIG.sprayPopCount * (f.lastPop === 'perfekt' ? CONFIG.sprayPopPerfect : 1));
        const jit = SP.pop.jitter;
        for (let k = 0; k < n; k++) {
          const along = -half * range(SP.pop.along);
          const side = (rnd() - 0.5) * (CONFIG.skiGap + SP.pop.side);
          const x = f.x + fx * along + sx * side, z = f.z + fz * along + sz * side;
          const t = CONFIG.sprayLooks.pop.throw * range(SP.pop.throwMul);
          emit('pop', x, groundY(x, z, f.y), z,
            f.vx * inh - fx * t + (rnd() - 0.5) * jit, vyg + range(SP.pop.up), f.vz * inh - fz * t + (rnd() - 0.5) * jit, rnd() * dt);
        }
      }

      lastSince = f.sinceLanding;
      lastPopAge = f.popAge;
      lastX = f.x; lastZ = f.z;

      // 6) størrelse og synlighet for tegningen: tones inn, vokser og blekner mykt bort,
      //    og tones bort helt inntil kameraet, så en puff ikke dekker hele skjermen
      const [n0, n1] = CONFIG.sprayNearFade;
      for (let i = 0; i < count; i++) {
        const t = age[i] / life[i];
        const fadeIn = Math.min(1, age[i] / (CONFIG.sprayFadeIn * life[i]));
        const fadeOut = 1 - smooth(CONFIG.sprayFadeOut, 1, t);
        const j = i * 3;
        const d = Math.hypot(positions[j] - f.camX, positions[j + 1] - f.camY, positions[j + 2] - f.camZ);
        alphas[i] = CONFIG.sprayOpacity * fadeIn * fadeOut * smooth(n0, n1, d);
        sizes[i] = sizeOf(i);
      }
    },
  };
}
