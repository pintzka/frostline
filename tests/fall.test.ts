import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame, skisOnSnow, stepGame, type Game } from '../src/core/game';
import { createSkier, speedOf, stepSkier } from '../src/physics/skier';
import { createCameraRig, type CameraPose } from '../src/camera/rig';
import { createTrail } from '../src/render/trail';
import { smoothSpeed } from '../src/ui/hud';
import { fadeAmount, fallBody, fallTotalTime, isFalling, landingWobble, respawnSpot } from '../src/tricks/fall';
import { heightAt, PARK, rampLength } from '../src/park/terrain';
import { spinCoast } from '../src/tricks/rotation';
import type { RawControls } from '../src/tricks/controls';

const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const medium = PARK.kickers[1];
const none: RawControls = { steer: 0, brake: 0, flip: 0, pop: false };

/** Spilleren spinner i lufta over det medium hoppet og slipper når spinnet akkurat når målet (grader). */
function spinTo(g: Game, goalDeg: number): RawControls {
  const s = g.skier, t = g.tricks;
  const near = s.z > medium.z - 5 && s.z < medium.z + 80;
  if (s.grounded || !near || goalDeg === 0) return none;
  const left = goalDeg * DEG - (t.spin + spinCoast(t.spinRate));
  return { ...none, steer: Math.abs(left) > 0.02 ? Math.sign(left) : 0 };
}

interface Frame { time: number; game: Game; cut: boolean }

/**
 * Kjører hele runden fra start til det medium hoppet, lander med gitt spinn, og fortsetter i `after` sekunder.
 * `mash` gir tastene som trykkes etter landingen (for å sjekke at de ikke virker under fallet).
 */
function ride(goalDeg: number, after: number, mash: (time: number) => RawControls = () => none, restartDuring = false) {
  const g = createGame();
  let landedAt = -1;
  let tookOff = false;
  const steps: Frame[] = [];
  let time = 0;
  for (let i = 0; i < 60 * CONFIG.physicsHz; i++) {
    const after0 = landedAt >= 0 ? time - landedAt : -1;
    const raw = landedAt < 0 ? spinTo(g, goalDeg) : mash(after0);
    const wasAir = !g.skier.grounded;
    const cut = stepGame(g, raw, restartDuring && landedAt >= 0, dt);
    time += dt;
    if (!g.skier.grounded && g.skier.z > medium.z - 5) tookOff = true;
    if (tookOff && landedAt < 0 && wasAir && g.skier.grounded) landedAt = time;
    steps.push({ time, game: structuredClone(g), cut });
    if (landedAt >= 0 && time - landedAt >= after) break;
  }
  return { g, landedAt, steps };
}

describe('fall', () => {
  const { landedAt, steps } = ride(90, 2.5);
  const landing = steps.find((f) => f.time === landedAt)!;
  const cutIndex = steps.findIndex((f) => f.cut);
  const cut = steps[cutIndex];

  it('et sidelengs spinn (90°) er et fall', () => {
    expect(landing.game.tricks.lastLanding?.quality).toBe('fall');
    expect(isFalling(landing.game.fall)).toBe(true);
  });

  it('setter deg tilbake før hoppet innen 1,5 s etter landingen', () => {
    expect(cutIndex).toBeGreaterThan(0);
    expect(cut.time - landedAt).toBeLessThan(1.5);
    // og skjermen er helt klar igjen innen 1,5 s
    expect(fallTotalTime()).toBeLessThan(1.5);
    const s = cut.game.skier;
    expect(s.z).toBeLessThan(medium.z - rampLength(medium) - 20);
    expect(s.x).toBe(0);
    expect(s.grounded).toBe(true);
    expect(s.y).toBeCloseTo(heightAt(s.x, s.z), 6);
    expect(speedOf(s)).toBeCloseTo(CONFIG.fallRespawnSpeed, 3);
    expect(cut.game.fall.respawnZ).toBe(s.z);
  });

  it('du sklir og bremser opp i snøen før du settes tilbake, uten å lette', () => {
    const fallSteps = steps.filter((f) => f.time > landedAt && f.time < cut.time);
    for (const f of fallSteps) expect(f.game.skier.grounded).toBe(true);
    const slid = steps[cutIndex - 1].game.skier.z - landing.game.skier.z;
    expect(slid).toBeGreaterThan(2);
    expect(slid).toBeLessThan(15);
    expect(speedOf(steps[cutIndex - 1].game.skier)).toBeLessThan(speedOf(landing.game.skier) * 0.3);
  });

  it('kroppen velter over og ligger på snøen midt i fallet, og står oppreist igjen før du settes tilbake', () => {
    const mid = steps.find((f) => f.time - landedAt > 0.45)!;
    expect(Math.abs(fallBody(mid.game.fall).roll)).toBeGreaterThan(1.2);
    expect(Math.abs(fallBody(steps[cutIndex - 1].game.fall).roll)).toBeLessThan(0.01);
    // spinnet retter seg til å se framover (ikke switch), så du kjører riktig vei etterpå
    expect(Math.cos(cut.game.tricks.spin)).toBeGreaterThan(0.999);
  });

  it('flyttingen skjer mens skjermen er helt bleket, og blekingen går mykt inn og ut', () => {
    expect(fadeAmount(cut.game.fall)).toBeGreaterThan(0.99);
    let biggest = 0;
    for (let i = 1; i < steps.length; i++) biggest = Math.max(biggest, Math.abs(fadeAmount(steps[i].game.fall) - fadeAmount(steps[i - 1].game.fall)));
    // maks ca. 2,5 % per fysikksteg = ca. 10 % per bilde i 60 fps
    expect(biggest).toBeLessThan(0.025);
    expect(fadeAmount(steps[steps.length - 1].game.fall)).toBe(0);
    expect(fadeAmount(landing.game.fall)).toBe(0);
  });

  it('ingen hopp per steg i kroppen: velting, synking, spinn, flip', () => {
    let roll = 0, drop = 0, pitch = 0, spin = 0, flip = 0;
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1].game, b = steps[i].game;
      const ba = fallBody(a.fall), bb = fallBody(b.fall);
      roll = Math.max(roll, Math.abs(bb.roll - ba.roll));
      drop = Math.max(drop, Math.abs(bb.drop - ba.drop));
      pitch = Math.max(pitch, Math.abs(bb.pitch - ba.pitch));
      if (!steps[i].cut) {
        spin = Math.max(spin, Math.abs(b.tricks.spin - a.tricks.spin));
        flip = Math.max(flip, Math.abs(b.tricks.flip - a.tricks.flip));
      }
    }
    // 60 fps = 4 steg per bilde: maks ca. 10° velting og 5 cm synking per bilde (som i pose-testen)
    expect(roll * 4).toBeLessThan(10 * DEG);
    expect(drop * 4).toBeLessThan(0.05);
    expect(pitch * 4).toBeLessThan(5 * DEG);
    expect(spin * 4).toBeLessThan(15 * DEG);
    expect(flip * 4).toBeLessThan(15 * DEG);
  });

  it('kameraet følger mykt uten å snurre, og hopper bare én gang, i det du settes tilbake', () => {
    const rig = createCameraRig();
    let last: CameraPose | null = null;
    let lastYaw = 0;
    let biggestMove = 0, biggestYaw = 0, biggestFov = 0, cuts = 0;
    let pendingCut = false;
    const start = steps.findIndex((f) => f.time > landedAt - 0.5);
    for (let i = start; i < steps.length; i++) {
      pendingCut ||= steps[i].cut;
      if ((i - start) % 4 !== 3) continue;
      const s = steps[i].game.skier;
      const p = { ...rig.update({ x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, heading: s.heading, speed: speedOf(s), cut: pendingCut }, 4 * dt) };
      const yaw = Math.atan2(p.lx - p.px, p.lz - p.pz);
      if (last && !pendingCut) {
        biggestMove = Math.max(biggestMove, Math.hypot(p.px - last.px, p.py - last.py, p.pz - last.pz));
        biggestYaw = Math.max(biggestYaw, Math.abs(Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw))));
        biggestFov = Math.max(biggestFov, Math.abs(p.fov - last.fov));
      }
      if (pendingCut) cuts++;
      pendingCut = false;
      last = p; lastYaw = yaw;
    }
    expect(cuts).toBe(1);
    // i 60 fps: maks ca. toppfart per bilde, maks 2° vridning og 0,5° synsfelt per bilde
    expect(biggestMove).toBeLessThan(CONFIG.maxSpeed / 60 * 1.3);
    expect(biggestYaw).toBeLessThan(2 * DEG);
    expect(biggestFov).toBeLessThan(0.5);
  });

  it('fartsmåleren hopper ikke når du settes tilbake', () => {
    let shown = speedOf(steps[0].game.skier);
    let biggest = 0;
    for (let i = 3; i < steps.length; i += 4) {
      const next = smoothSpeed(shown, speedOf(steps[i].game.skier), 4 * dt);
      biggest = Math.max(biggest, Math.abs(next - shown));
      shown = next;
    }
    // maks 4 km/t per bilde (uten utjevning ville den hoppet ca. 30 km/t)
    expect(biggest * 3.6).toBeLessThan(4);
  });

  it('skisporene tegner ingen strek fra fallstedet til der du settes tilbake', () => {
    const trail = createTrail();
    for (const f of steps) {
      const s = f.game.skier;
      trail.update(s.x, s.y, s.z, s.heading, skisOnSnow(f.game), f.cut);
    }
    const pts = trail.points();
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].start) continue;
      expect(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)).toBeLessThan(1);
    }
    // det nye sporet etter respawn er der
    expect(pts[pts.length - 1].z).toBeGreaterThan(cut.game.skier.z);
  });

  it('er deterministisk', () => {
    const again = ride(90, 2.5).steps;
    expect(again.length).toBe(steps.length);
    expect(again[again.length - 1].game).toEqual(steps[steps.length - 1].game);
  });
});

describe('ingen taster virker under fallet', () => {
  const mash = (time: number): RawControls =>
    time < CONFIG.fallRespawnAt ? { steer: time % 0.2 < 0.1 ? 1 : -1, brake: 1, flip: 1, pop: time % 0.3 < 0.15 } : none;
  const calm = ride(90, 1.2);
  const wild = ride(90, 1.2, mash, true);

  it('styring, brems, pop, flip og R under fallet gir nøyaktig samme fall og samme respawn', () => {
    const a = calm.steps.findIndex((f) => f.cut), b = wild.steps.findIndex((f) => f.cut);
    expect(a).toBe(b);
    for (let i = 0; i <= a; i++) expect(wild.steps[i].game.skier).toEqual(calm.steps[i].game.skier);
    expect(wild.steps[a].game.tricks.spin).toBe(calm.steps[a].game.tricks.spin);
  });

  it('pop-knappen holdt fra fallet spretter ikke når du slipper den etter respawn', () => {
    const held = ride(90, 1.6, (time) => ({ ...none, pop: time < CONFIG.fallRespawnAt + 0.3 }));
    const s = held.g.skier;
    expect(s.lastPop).toBe('');
    expect(s.grounded).toBe(true);
  });

  it('etter respawn styrer du som vanlig', () => {
    const steer = ride(90, 1.8, (time) => ({ ...none, steer: time > CONFIG.fallRespawnAt ? 1 : 0 }));
    expect(steer.g.skier.heading).toBeLessThan(-0.2);
  });
});

describe('slurvete og ren landing', () => {
  const clean = ride(360, 1.5);
  const sloppy = ride(400, 1.5);

  it('400° (40° for mye) er slurvete og gir ikke fall', () => {
    expect(sloppy.g.tricks.lastLanding?.quality).toBe('slurvete');
    for (const f of sloppy.steps) expect(isFalling(f.game.fall)).toBe(false);
    expect(sloppy.steps.some((f) => f.cut)).toBe(false);
  });

  it('slurvete: du mister litt fart, mykt over noen steg', () => {
    const at = sloppy.steps.findIndex((f) => f.time === sloppy.landedAt);
    // spinnet påvirker ikke fysikken, så samme tur med bare fysikken er turen uten straff
    const free = createSkier();
    const n = at + Math.round(CONFIG.sloppyLossTime / dt) + 2;
    for (let i = 0; i <= n; i++) stepSkier(free, { steer: 0, brake: 0 }, dt);
    const lost = 1 - speedOf(sloppy.steps[n].game.skier) / speedOf(free);
    // bakken drar deg litt opp igjen mens straffen virker, så litt under hele straffen er riktig
    expect(lost).toBeGreaterThan(CONFIG.sloppySpeedLoss * 0.6);
    expect(lost).toBeLessThan(CONFIG.sloppySpeedLoss * 1.05);
    // aldri mer enn 0,5 % av farten på ett steg
    let biggest = 0;
    for (let i = at; i < at + 100; i++) biggest = Math.max(biggest, 1 - speedOf(sloppy.steps[i + 1].game.skier) / speedOf(sloppy.steps[i].game.skier));
    expect(biggest).toBeLessThan(0.005);
  });

  it('slurvete: kroppen vakler tydelig, mykt, og roer seg', () => {
    const wob = sloppy.steps.map((f) => landingWobble(f.game.fall));
    expect(Math.max(...wob.map((w) => Math.abs(w.roll)))).toBeGreaterThan(0.15);
    let biggest = 0;
    for (let i = 1; i < wob.length; i++) biggest = Math.max(biggest, Math.abs(wob[i].roll - wob[i - 1].roll), Math.abs(wob[i].pitch - wob[i - 1].pitch));
    expect(biggest * 4).toBeLessThan(6 * DEG);
    expect(Math.abs(wob[wob.length - 1].roll)).toBeLessThan(0.01);
  });

  it('ren landing gir ingen straff: nøyaktig som fysikken alene', () => {
    expect(clean.g.tricks.lastLanding?.quality).toBe('ren');
    expect(clean.g.tricks.lastLanding?.name).toBe('360');
    // samme tur med bare fysikken (spinnet påvirker ikke fysikken)
    const s = createSkier();
    for (let i = 0; i < clean.steps.length; i++) stepSkier(s, { steer: 0, brake: 0 }, dt);
    expect(clean.g.skier).toEqual(s);
    for (const f of clean.steps) {
      expect(landingWobble(f.game.fall).roll).toBe(0);
      expect(fallBody(f.game.fall).roll).toBe(0);
    }
  });
});

describe('hvor du settes tilbake', () => {
  it('før rampen på hoppet du falt på, aldri på en rampe, og på start før det første hoppet', () => {
    for (const k of PARK.kickers) {
      for (const fallZ of [k.z + 20, k.z + 60]) {
        const spot = respawnSpot(fallZ);
        expect(spot.z).toBeLessThan(k.z - rampLength(k));
        for (const other of PARK.kickers) {
          const onRamp = spot.z > other.z - rampLength(other) - 5 && spot.z < other.z + 2;
          expect(onRamp).toBe(false);
        }
      }
    }
    expect(respawnSpot(100)).toEqual({ x: 0, z: 5 });
  });

  it('fra respawn rekker du å få opp farten: du letter først på kanten av samme hopp, med nesten vanlig lufttid', () => {
    const normal = [1.18, 1.97, 2.52];
    PARK.kickers.forEach((k, n) => {
      const g = createGame();
      g.fall.respawnZ = respawnSpot(k.z + 30).z;
      g.fall.time = CONFIG.fallRespawnAt - dt / 2;
      g.fall.respawned = false;
      stepGame(g, none, false, dt);
      let takeoffZ = -1, air = 0;
      for (let i = 0; i < 20 * CONFIG.physicsHz; i++) {
        stepGame(g, none, false, dt);
        if (!g.skier.grounded) { if (takeoffZ < 0) takeoffZ = g.skier.z; air += dt; }
        else if (takeoffZ >= 0) break;
      }
      expect(Math.abs(takeoffZ - k.z)).toBeLessThan(3);
      expect(air).toBeGreaterThan(normal[n] * 0.75);
    });
  });
});
