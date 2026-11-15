import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createGame, stepGame, type FlowEvent, type Game, type GameInput } from '../src/ui/flow';
import {
  backToResult, canReplay, cloneGame, createRecorder, createSession, exitPressed, nextCam, recordStep, setCam, stepPlayer,
  type Recorder,
} from '../src/ui/replay';
import { createReplayCam, REPLAY_CAMS, tvKicker, tvSpot } from '../src/camera/replayCam';
import { PARK, heightAt } from '../src/park/terrain';
import { spinCoast } from '../src/tricks/rotation';
import type { RawControls } from '../src/tricks/controls';

/** Reprise: opptak av inputen og avspilling skal gi nøyaktig samme runde. */
const dt = 1 / CONFIG.physicsHz;
const DEG = Math.PI / 180;
const none: RawControls = { steer: 0, brake: 0, flip: 0, pop: false, grab: 0 };
const idle = (over: Partial<GameInput> = {}): GameInput => ({ raw: { ...none }, click: false, restart: false, ...over });

/** Ett ekte steg, med opptak, slik main.ts gjør det. */
function realStep(g: Game, r: Recorder, inp: GameInput): FlowEvent {
  const ev = stepGame(g, inp, dt);
  recordStep(r, g, inp, ev);
  return ev;
}

/**
 * En hel runde med triks og fall: sikksakk i starten, pop ved første hopp med spinn og grab,
 * 90° (fall) på andre hopp første gang, R under fallet, og nye spinn etter respawn.
 */
function scriptedRun(g: Game, r: Recorder) {
  const tries = new Map<number, number>();
  let wasAir = false, falls = 0, tricks = 0, i = 0;
  for (; g.flow.phase === 'kjorer' && i < 200 * CONFIG.physicsHz; i++) {
    const s = g.skier, t = g.tricks, time = i * dt;
    const raw: RawControls = { ...none };
    // nærmeste hopp foran eller like bak
    const k = PARK.kickers.findIndex((kk) => s.z > kk.z - 25 && s.z < kk.z + 80);
    if (s.grounded) {
      if (time < 4) raw.steer = Math.sin(time * 3) > 0 ? 0.6 : -0.6;
      if (k >= 0 && s.z > PARK.kickers[k].z - 12 && s.z < PARK.kickers[k].z - 0.5) raw.pop = true;
    } else if (k >= 0) {
      const n = tries.get(k) ?? 0;
      const goal = k === 1 && n === 1 ? 90 : k % 2 === 0 ? 360 : 180;
      const left = goal * DEG - (t.spin + spinCoast(t.spinRate));
      raw.steer = Math.abs(left) > 0.02 ? Math.sign(left) : 0;
      if (k === 0 && s.airTime < 0.6) raw.grab = 1;
    }
    // R midt i fallet skal ikke gi ny runde (og skal tas opp likt)
    const restart = g.fall.time < 0.5;
    const ev = realStep(g, r, { raw, click: i % 997 === 0, restart });
    expect(ev).not.toBe('ny-runde');
    if (!wasAir && !g.skier.grounded && k >= 0) tries.set(k, (tries.get(k) ?? 0) + 1);
    if (wasAir && g.skier.grounded) {
      const q = g.tricks.lastLanding?.quality;
      if (q === 'fall') falls++;
      else if (g.tricks.lastLanding?.name) tricks++;
    }
    wasAir = !g.skier.grounded;
  }
  return { falls, tricks, steps: i };
}

/** Starter en runde fra startskjermen, kjører den ferdig, og gir spillet + opptaket. */
function recordedRun() {
  const g = createGame();
  const r = createRecorder();
  // en tidligere runde, så beste runde er med i starttilstanden
  g.best = 1234;
  expect(realStep(g, r, idle({ click: true }))).toBe('ny-runde');
  const info = scriptedRun(g, r);
  return { g, r, ...info };
}

/** Hele spillet som rene data (posisjon, fart, triks, poeng, fall, statistikk, flyt). */
function snapshot(g: Game) {
  return JSON.parse(JSON.stringify(g));
}

describe('reprise: opptak og avspilling', () => {
  it('en hel runde med triks og fall spilles av nøyaktig likt', () => {
    const { g, r, falls, tricks } = recordedRun();
    expect(g.flow.phase).toBe('resultat');
    expect(falls).toBeGreaterThanOrEqual(1);
    expect(tricks).toBeGreaterThanOrEqual(1);
    expect(g.score.total).toBeGreaterThan(0);
    expect(canReplay(r, g)).toBe(true);
    const rec = r.rec!;
    // kompakt: langt færre endringer enn steg
    expect(rec.changes.length).toBeLessThan(rec.steps / 10);

    const atFinish = snapshot(g);
    const session = createSession(rec, REPLAY_CAMS.length);
    const p = session.player;
    let finishEv = -1;
    for (let i = 0; i < rec.steps; i++) {
      const ev = stepPlayer(p, dt);
      expect(ev).not.toBe('ny-runde');
      if (ev === 'mål') finishEv = i;
    }
    // målet kommer på nøyaktig samme steg, og alt (posisjon, fart, poeng, triks, statistikk) er likt
    expect(finishEv).toBe(rec.steps - 1);
    expect(snapshot(p.game)).toEqual(atFinish);
    expect(p.game.skier.x).toBe(g.skier.x);
    expect(p.game.skier.z).toBe(g.skier.z);
    expect(p.game.score.total).toBe(g.score.total);
    expect(p.game.tricks.lastLanding).toEqual(g.tricks.lastLanding);
    expect(p.game.flow.stats.bestTrick).toEqual(g.flow.stats.bestTrick);
    // halen etter målet: skiløperen bremser, men ingen ny runde
    let n = 0;
    while (!p.done && n < 10 * CONFIG.physicsHz) { expect(stepPlayer(p, dt)).not.toBe('ny-runde'); n++; }
    expect(p.done).toBe(true);
    expect(p.game.flow.phase).toBe('resultat');
    expect(p.game.score.total).toBe(g.score.total);
  });

  it('reprisen rører ikke den ekte runden, og kan spilles flere ganger', () => {
    const { g, r } = recordedRun();
    const before = snapshot(g);
    const recBefore = JSON.stringify(r.rec);
    const a = createSession(r.rec!, 3), b = createSession(r.rec!, 3);
    while (!a.player.done) stepPlayer(a.player, dt);
    while (!b.player.done) stepPlayer(b.player, dt);
    expect(snapshot(a.player.game)).toEqual(snapshot(b.player.game));
    expect(snapshot(g)).toEqual(before);
    expect(JSON.stringify(r.rec)).toBe(recBefore);
    // poeng og beste runde i reprisen er reprisens egne; den ekte beste runden er uendret
    a.player.game.best = 99999;
    expect(g.best).toBe(1234);
  });

  it('R midt i runden starter et nytt opptak, og bare runder i mål kan spilles av', () => {
    const g = createGame();
    const r = createRecorder();
    realStep(g, r, idle({ click: true }));
    for (let i = 0; i < 2 * CONFIG.physicsHz; i++) realStep(g, r, idle({ raw: { ...none, steer: 0.5 } }));
    const first = r.rec;
    expect(first?.steps).toBe(2 * CONFIG.physicsHz);
    expect(canReplay(r, g)).toBe(false);
    expect(realStep(g, r, idle({ restart: true }))).toBe('ny-runde');
    expect(r.rec).not.toBe(first);
    expect(r.rec?.steps).toBe(0);
    expect(r.rec?.start.skier.z).toBe(g.skier.z);
  });

  it('ekte mellomrom: bare et nytt trykk går ut, og et holdt mellomrom starter ikke ny runde etterpå', () => {
    const { g, r } = recordedRun();
    const s = createSession(r.rec!, 3);
    expect(exitPressed(s, true)).toBe(false);
    expect(exitPressed(s, false)).toBe(false);
    expect(exitPressed(s, true)).toBe(true);
    // tilbake på resultatskjermen med mellomrom fortsatt holdt
    for (let i = 0; i < CONFIG.resultMinTime / dt + 10; i++) stepGame(g, idle(), dt);
    backToResult(g);
    expect(stepGame(g, idle({ raw: { ...none, pop: true } }), dt)).toBe(null);
    expect(g.flow.phase).toBe('resultat');
    // slipp og trykk igjen: nå starter ny runde
    stepGame(g, idle(), dt);
    expect(stepGame(g, idle({ raw: { ...none, pop: true } }), dt)).toBe('ny-runde');
  });

  it('kopien beholder delte objekter (samme landing i triks og statistikk)', () => {
    const { g } = recordedRun();
    expect(g.flow.stats.lastLanding).toBe(g.tricks.lastLanding);
    const c = cloneGame(g);
    expect(c.flow.stats.lastLanding).toBe(c.tricks.lastLanding);
    expect(c.tricks.lastLanding).not.toBe(g.tricks.lastLanding);
  });
});

describe('reprise: kameravinkler', () => {
  it('bytter mellom 2–3 vinkler', () => {
    expect(REPLAY_CAMS.length).toBeGreaterThanOrEqual(2);
    expect(REPLAY_CAMS.length).toBeLessThanOrEqual(3);
    const s = createSession({ start: createGame(), changes: [], steps: 0, finished: true }, 3);
    expect(s.cam).toBe(0);
    nextCam(s, 3); expect(s.cam).toBe(1);
    nextCam(s, 3); nextCam(s, 3); expect(s.cam).toBe(0);
    setCam(s, 2, 3); expect(s.cam).toBe(2);
    setCam(s, 7, 3); expect(s.cam).toBe(2);
  });

  it('TV-kameraet står fast ved hoppet foran, og bytter når skiløperen er godt forbi', () => {
    const k0 = PARK.kickers[0];
    expect(tvKicker(CONFIG.startZ)).toBe(0);
    expect(tvKicker(k0.z + 10)).toBe(0);
    expect(tvKicker(k0.z + CONFIG.replayTvSwitchAfter + 1)).toBe(Math.min(1, PARK.kickers.length - 1));
    expect(tvKicker(1e6)).toBe(PARK.kickers.length - 1);
    const cam = createReplayCam();
    const at = (z: number) => ({ x: 0, y: heightAt(0, z), z, vx: 0, vz: 15, heading: 0, speed: 15 });
    const a = { ...cam.update('tv', at(k0.z - 20), dt) };
    const b = { ...cam.update('tv', at(k0.z + 5), dt) };
    // samme plass, men ser og zoomer etter skiløperen
    expect([b.px, b.py, b.pz]).toEqual([a.px, a.py, a.pz]);
    expect(b.lz).not.toBe(a.lz);
    expect(b.fov).toBeGreaterThan(a.fov);
    expect(b.fov).toBeLessThanOrEqual(CONFIG.replayTvFovMax);
    const spot = tvSpot(0);
    expect(spot.y).toBeGreaterThan(heightAt(spot.x, spot.z));
    expect(Math.abs(spot.x)).toBeLessThan(PARK.width / 2);
  });

  it('det høye kameraet er høyt over og bak skiløperen, og bak-kameraet følger som i spillet', () => {
    const cam = createReplayCam();
    const z = 100, y = heightAt(0, z);
    const inp = { x: 0, y, z, vx: 0, vz: 15, heading: 0, speed: 15 };
    const h = { ...cam.update('hoy', inp, dt) };
    expect(h.py).toBeCloseTo(y + CONFIG.replayHighUp, 6);
    expect(h.pz).toBeCloseTo(z - CONFIG.replayHighBack, 6);
    expect(h.lz).toBe(z);
    const back = cam.update('bak', inp, dt);
    expect(back.pz).toBeLessThan(z);
    expect(back.py).toBeGreaterThan(y);
    for (const v of Object.values(back)) expect(Number.isFinite(v)).toBe(true);
  });
});
