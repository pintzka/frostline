import { CONFIG } from './core/config';
import { createLoop } from './core/loop';
import { skisOnSnow, snowSkier, type Move } from './core/game';
import { speedOf } from './physics/skier';
import { railStyleName } from './physics/rail';
import { createInput } from './input/input';
import { createChaseCamera } from './camera/chase';
import { createReplayCam, REPLAY_CAMS } from './camera/replayCam';
import { createScene } from './render/scene';
import { createSkiTrails } from './render/trailMesh';
import { createSnowSpray } from './render/sprayMesh';
import { createSkierView } from './character/view';
import { fadeAmount } from './tricks/fall';
import { createHud } from './ui/hud';
import { createTouchControls } from './ui/touchControls';
import { createPauseUi } from './ui/pause';
import { createMenu } from './ui/menu';
import { createGame, resumeGame, soundSkier, stepGame, type Game, type GameInput } from './ui/flow';
import { backToResult, canReplay, createRecorder, createSession, exitPressed, nextCam, playerProgress, recordStep, setCam, stepPlayer, type ReplaySession } from './ui/replay';
import { createReplayUi } from './ui/replayUi';
import { createAudio } from './audio/engine';
import { createQualityUi } from './ui/qualityUi';
import { createAssistUi } from './ui/assistUi';
import { createChallengesUi } from './ui/challengesUi';
import { CURRENT_CHALLENGES } from './challenges/index';
import { CURRENT_PARK_ID } from './park/parks';
import { loadBest, saveBest } from './park/choice';
import { PARK } from './park/terrain';

const root = document.getElementById('app')!;
// grafikknivået (Lav / Middels / Høy / Auto) og FPS-måleren, valgt på startskjermen og i pausen
const quality = createQualityUi(root);
const { renderer, scene, env, sunFollow, applyQuality } = createScene(root, quality.settings);
const chase = createChaseCamera(innerWidth / innerHeight);
addEventListener('resize', () => chase.resize(innerWidth / innerHeight));
const hud = createHud(root);
const input = createInput(renderer.domElement, createTouchControls(root));
// landingshjelp På / Av (ui/assistUi.ts), også valgt på startskjermen og i pausen
const assist = createAssistUi();
/** Grafikkvalget og landingshjelpen under hverandre. */
function settingsBox(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:10px;align-items:center;';
  box.append(quality.picker(), assist.picker());
  return box;
}
const menu = createMenu(root, settingsBox());
const audio = createAudio();
const challenges = createChallengesUi(root, menu, CURRENT_PARK_ID, PARK, CURRENT_CHALLENGES);
const replayUi = createReplayUi(root);
const replayCam = createReplayCam();

const view = createSkierView(scene);
const trails = createSkiTrails(scene);
const spray = createSnowSpray(scene);

// startskjerm → kjører → resultat (ui/flow.ts); selve kjøringen, fall og poeng er core/game.ts
const game = createGame();
// beste runde huskes per park i nettleseren (bare fra ekte runder, aldri fra reprisen)
game.best = loadBest(CURRENT_PARK_ID);
let prev = { ...game.skier };
let prevTricks = { ...game.tricks };
// om skiløperen ble flyttet siden forrige bilde: 'restart' (ny runde) eller 'respawn' (satt tilbake etter fall)
let moved: Move = 'restart';
const startZ = game.skier.z;
// spilltid for himmelen: står stille på pause (loopen gir frameDt = 0 da)
let skyTime = 0;
// reprise av siste runde (ui/replay.ts): opptaket av inputen, og en egen kopi av spillet når den spilles av
const recorder = createRecorder();
let replay: ReplaySession | null = null;

/** Skiløperen ble flyttet langt på ett steg: ingen utjevning, og lyden dukkes. Ny runde er viktigst (den tømmer sporet). */
function onMoved(m: Move, g: Game) {
  if (moved !== 'restart') moved = m;
  prev = { ...g.skier };
  prevTricks = { ...g.tricks };
  view.moved(m);
  audio.newRun();
}

/** Lyden: prev er satt på nytt etter en flytting, så det ikke høres ut som en landing. */
function hear(g: Game) {
  const heard = soundSkier(g);
  audio.step(heard === g.skier ? prev : heard, heard, heard.brake, g.rail.on);
}

/** Tilbake til resultatet: mellomrom som holdes starter ikke ny runde, og kameraet hopper rett tilbake. */
function endReplay() {
  replay = null;
  backToResult(game);
  onMoved('respawn', game);
}

/**
 * Ett steg av reprisen. Ekte taster leses (og kastes), så ingenting lekker inn i neste runde.
 * Bare reprisens kopi kjøres: ingen utfordringer, beste runde eller lagring.
 */
function replayStep(r: ReplaySession, dt: number) {
  const real = input.read();
  menu.takeClick();
  input.takeRestart();
  input.takePadReplay();
  const c = input.takePadCam() ? 'neste' : replayUi.takeCam();
  if (c === 'neste') nextCam(r, REPLAY_CAMS.length); else if (c !== null) setCam(r, c, REPLAY_CAMS.length);
  if (exitPressed(r, !!real.pop) || replayUi.takeExit()) { endReplay(); return; }
  const g = r.player.game;
  prev = { ...g.skier };
  prevTricks = { ...g.tricks };
  stepPlayer(r.player, dt);
  if (g.flow.move !== 'none') onMoved(g.flow.move, g);
  hear(g);
  if (r.player.done) endReplay();
}

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    if (replay) { replayStep(replay, dt); return; }
    prev = { ...game.skier };
    prevTricks = { ...game.tricks };
    // R (eller Y på gamepad) gir ny runde med en gang; mellomrom eller klikk starter fra start- og resultatskjermen
    const inp: GameInput = { raw: input.read(), click: menu.takeClick(), restart: input.takeRestart(), assist: assist.on };
    const ev = stepGame(game, inp, dt);
    recordStep(recorder, game, inp, ev);
    if (ev) { menu.onEvent(ev, game); saveBest(CURRENT_PARK_ID, Math.max(game.best, game.score.total)); }
    challenges.step(game, ev);
    if (game.tricks.justLanded) input.landed();
    if (game.flow.move !== 'none') onMoved(game.flow.move, game);
    hear(game);
    // V eller knappen på resultatskjermen: se runden igjen
    input.takePadCam();
    if ((replayUi.takeStart() || input.takePadReplay()) && canReplay(recorder, game)) {
      replay = createSession(recorder.rec!, REPLAY_CAMS.length);
      onMoved('restart', replay.player.game);
    }
  },
  render(alpha, frameDt) {
    // under reprisen tegnes reprisens egen kopi av spillet
    const shown = replay?.player.game ?? game;
    const { skier, tricks } = shown;
    // nivåbytter som gir et hakk venter til pause, startskjerm eller resultat (ikke midt i en reprise)
    const q = quality.frame(frameDt);
    quality.setWaiting(applyQuality(q, loop.isPaused() || (!replay && game.flow.phase !== 'kjorer')));
    spray.setAmount(q.spray);
    const { at, heading, normal } = view.update(shown, prev, prevTricks, alpha, frameDt);
    trails.update(at.x, at.y, at.z, heading, skisOnSnow(shown), moved);
    spray.update(snowSkier(shown), at, heading, skier.brake, normal, frameDt, chase.camera, renderer);
    sunFollow(at);

    // den ekte farten: landingene følger flybanen, så den holder seg når du lander
    const v = speedOf(skier);
    const camIn = { x: at.x, y: at.y, z: at.z, vx: skier.vx, vz: skier.vz, heading, speed: v, cut: moved !== 'none' };
    if (replay) chase.setPose(replayCam.update(REPLAY_CAMS[replay.cam].kind, { ...camIn, grounded: skier.grounded }, frameDt));
    else chase.update(camIn, frameDt);
    hud.update({
      speed: v, distance: skier.z - startZ, airTime: skier.airTime, inAir: !skier.grounded,
      popCharge: skier.popCharge, lastPop: skier.lastPop, popAge: skier.popAge,
      fade: fadeAmount(shown.fall),
      score: shown.score, best: shown.best, controls: input.device(), grab: tricks.grabs.held, grabTime: tricks.grabs.holdTime,
      rail: shown.rail.on ? { name: railStyleName(shown.rail.style), time: shown.rail.time, balance: shown.rail.balance } : null,
    }, frameDt);
    // under reprisen er resultatskjermen borte (også i halen etter målet i reprisen)
    const hudOpacity = menu.update(replay ? { ...shown.flow, phase: 'kjorer' } : game.flow, frameDt);
    hud.setOpacity(hudOpacity);
    challenges.update(frameDt, hudOpacity);
    replayUi.update({
      available: canReplay(recorder, game) && !replay, active: !!replay,
      camName: replay ? REPLAY_CAMS[replay.cam].name : '', progress: replay ? playerProgress(replay.player) : 0,
    });
    moved = 'none';
    skyTime += frameDt;
    env.follow(chase.camera.position, skyTime);
    audio.frame();
    renderer.render(scene, chase.camera);
  },
});
loop.start();

// pause: fysikken står og lyden tones ned. Taster trykket eller holdt på pause (R, mellomrom) gir ingenting når du fortsetter
const pausable = {
  pause() { loop.pause(); audio.suspend(); },
  resume() {
    input.releaseAll(); resumeGame(game);
    // i reprisen: mellomrom som holdes, går ikke ut av den
    if (replay) replay.popWas = true;
    loop.resume(); audio.resume();
  },
  toggle() { if (loop.isPaused()) pausable.resume(); else pausable.pause(); return loop.isPaused(); },
  isPaused: () => loop.isPaused(),
};
input.onPause(createPauseUi(root, pausable, settingsBox()).toggle);
