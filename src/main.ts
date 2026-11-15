import { CONFIG } from './core/config';
import { createLoop } from './core/loop';
import { skisOnSnow, type Move } from './core/game';
import { speedOf } from './physics/skier';
import { createInput } from './input/input';
import { createChaseCamera } from './camera/chase';
import { createScene } from './render/scene';
import { createSkiTrails } from './render/trailMesh';
import { createSnowSpray } from './render/sprayMesh';
import { createSkierView } from './character/view';
import { fadeAmount } from './tricks/fall';
import { createHud } from './ui/hud';
import { createTouchControls } from './ui/touchControls';
import { createPauseUi } from './ui/pause';
import { createMenu } from './ui/menu';
import { createGame, stepGame, type GameInput } from './ui/flow';
import { backToResult, canReplay, createRecorder, createSession, exitPressed, nextCam, playerProgress, recordStep, setCam, stepPlayer, type ReplaySession } from './ui/replay';
import { createReplayUi } from './ui/replayUi';
import { createReplayCam, REPLAY_CAMS } from './camera/replayCam';
import { createAudio } from './audio/engine';

const root = document.getElementById('app')!;
const { renderer, scene, env, sunFollow } = createScene(root);
const chase = createChaseCamera(innerWidth / innerHeight);
addEventListener('resize', () => chase.resize(innerWidth / innerHeight));
const hud = createHud(root);
const input = createInput(renderer.domElement, createTouchControls(root));
const menu = createMenu(root);
const audio = createAudio();
const replayUi = createReplayUi(root);
const replayCam = createReplayCam();

const view = createSkierView(scene);
const trails = createSkiTrails(scene);
const spray = createSnowSpray(scene);

// startskjerm → kjører → resultat (ui/flow.ts); selve kjøringen, fall og poeng er core/game.ts
const game = createGame();
let prev = { ...game.skier };
let prevTricks = { ...game.tricks };
// om skiløperen ble flyttet siden forrige bilde: 'restart' (ny runde) eller 'respawn' (satt tilbake etter fall)
let moved: Move = 'restart';
const startZ = game.skier.z;
// reprise av siste runde (ui/replay.ts): opptaket av inputen, og avspillingen når den går
const recorder = createRecorder();
let replay: ReplaySession | null = null;

/** Skiløperen ble flyttet langt på ett steg: ingen utjevning, og lyden dukkes. */
function onMoved(m: Move, skier: typeof game.skier, tricks: typeof game.tricks) {
  if (moved !== 'restart') moved = m;
  prev = { ...skier };
  prevTricks = { ...tricks };
  view.moved(m);
  audio.newRun();
}

function startReplay() {
  replay = createSession(recorder.rec!, REPLAY_CAMS.length);
  onMoved('restart', replay.player.game.skier, replay.player.game.tricks);
}

/** Tilbake til resultatet: det gamle sporet blir liggende med et hull, og kameraet hopper rett tilbake. */
function endReplay() {
  replay = null;
  backToResult(game);
  onMoved('respawn', game.skier, game.tricks);
}

/** Ett steg av reprisen. Ekte taster leses (og kastes), så ingenting fra reprisen lekker inn i neste runde. */
function replayStep(r: ReplaySession, dt: number) {
  const real = input.read();
  menu.takeClick();
  input.takeRestart();
  const c = replayUi.takeCam();
  if (c === 'neste') nextCam(r, REPLAY_CAMS.length); else if (c !== null) setCam(r, c, REPLAY_CAMS.length);
  if (exitPressed(r, !!real.pop) || replayUi.takeExit()) { endReplay(); return; }
  const g = r.player.game;
  prev = { ...g.skier };
  prevTricks = { ...g.tricks };
  stepPlayer(r.player, dt);
  if (g.flow.move !== 'none') onMoved(g.flow.move, g.skier, g.tricks);
  audio.step(prev, g.skier, { steer: 0, brake: g.skier.brake, pop: false });
  if (r.player.done) endReplay();
}

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    if (replay) { replayStep(replay, dt); return; }
    prev = { ...game.skier };
    prevTricks = { ...game.tricks };
    // R (eller Y på gamepad) gir ny runde med en gang; mellomrom eller klikk starter fra start- og resultatskjermen
    const inp: GameInput = { raw: input.read(), click: menu.takeClick(), restart: input.takeRestart() };
    const ev = stepGame(game, inp, dt);
    recordStep(recorder, game, inp, ev);
    if (ev) menu.onEvent(ev, game);
    // flyttet langt: ingen utjevning mellom gammel og ny plass. Ny runde er viktigst (den tømmer også sporet)
    if (game.flow.move !== 'none') onMoved(game.flow.move, game.skier, game.tricks);
    // prev er satt på nytt etter en flytting, så det ikke høres ut som en landing
    audio.step(prev, game.skier, { steer: 0, brake: game.skier.brake, pop: false });
    // V eller knappen på resultatskjermen: se runden igjen
    if (replayUi.takeStart() && canReplay(recorder, game)) startReplay();
  },
  render(alpha, frameDt) {
    // under reprisen tegnes reprisens egen kopi av spillet
    const shown = replay?.player.game ?? game;
    const { skier, tricks } = shown;
    const { at, heading, normal } = view.update(shown, prev, prevTricks, alpha, frameDt);
    trails.update(at.x, at.y, at.z, heading, skisOnSnow(shown), moved);
    spray.update(skier, at, heading, skier.brake, normal, frameDt, chase.camera, renderer);
    sunFollow(at);

    // den ekte farten: landingene følger flybanen, så den holder seg når du lander
    const v = speedOf(skier);
    const camIn = { x: at.x, y: at.y, z: at.z, vx: skier.vx, vz: skier.vz, heading, speed: v, cut: moved !== 'none' };
    if (replay) chase.setPose(replayCam.update(REPLAY_CAMS[replay.cam].kind, camIn, frameDt));
    else chase.update(camIn, frameDt);
    hud.update({
      speed: v, distance: skier.z - startZ, airTime: skier.airTime, inAir: !skier.grounded,
      popCharge: skier.popCharge, lastPop: skier.lastPop, popAge: skier.popAge,
      landing: tricks.lastLanding, landingAge: tricks.landingAge, fade: fadeAmount(shown.fall),
      score: shown.score, best: shown.best, controls: input.device(), grab: tricks.grabs.held, grabTime: tricks.grabs.holdTime,
    }, frameDt);
    // under reprisen er resultatskjermen borte (også i halen etter målet i reprisen)
    hud.setOpacity(menu.update(replay ? { ...shown.flow, phase: 'kjorer' } : game.flow, frameDt));
    replayUi.update({
      available: canReplay(recorder, game) && !replay, active: !!replay,
      camName: replay ? REPLAY_CAMS[replay.cam].name : '', progress: replay ? playerProgress(replay.player) : 0,
    });
    moved = 'none';
    env.follow(chase.camera.position, performance.now() / 1000);
    audio.frame();
    renderer.render(scene, chase.camera);
  },
});
loop.start();

// pause: fysikken står, lyden tones ned, og R trykket på pause gir ikke ny runde når du fortsetter
const pausable = {
  pause() { loop.pause(); audio.suspend(); },
  resume() { input.takeRestart(); loop.resume(); audio.resume(); },
  toggle() { if (loop.isPaused()) pausable.resume(); else pausable.pause(); return loop.isPaused(); },
  isPaused: () => loop.isPaused(),
};
input.onPause(createPauseUi(root, pausable).toggle);
