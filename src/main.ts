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
import { createGame, resumeGame, stepGame } from './ui/flow';
import { createAudio } from './audio/engine';

const root = document.getElementById('app')!;
const { renderer, scene, env, sunFollow } = createScene(root);
const chase = createChaseCamera(innerWidth / innerHeight);
addEventListener('resize', () => chase.resize(innerWidth / innerHeight));
const hud = createHud(root);
const input = createInput(renderer.domElement, createTouchControls(root));
const menu = createMenu(root);
const audio = createAudio();

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

const loop = createLoop({
  hz: CONFIG.physicsHz,
  step(dt) {
    prev = { ...game.skier };
    prevTricks = { ...game.tricks };
    // R (eller Y på gamepad) gir ny runde med en gang; mellomrom eller klikk starter fra start- og resultatskjermen
    const ev = stepGame(game, { raw: input.read(), click: menu.takeClick(), restart: input.takeRestart() }, dt);
    if (ev) menu.onEvent(ev, game);
    const m = game.flow.move;
    if (m !== 'none') {
      // flyttet langt: ingen utjevning mellom gammel og ny plass. Ny runde er viktigst (den tømmer også sporet)
      if (moved !== 'restart') moved = m;
      prev = { ...game.skier };
      prevTricks = { ...game.tricks };
      view.moved(m);
      // lyden dukkes kort, så den ikke hopper
      audio.newRun();
    }
    // prev er satt på nytt etter en flytting, så det ikke høres ut som en landing
    audio.step(prev, game.skier, { steer: 0, brake: game.skier.brake, pop: false });
  },
  render(alpha, frameDt) {
    const { skier, tricks } = game;
    const { at, heading, normal } = view.update(game, prev, prevTricks, alpha, frameDt);
    trails.update(at.x, at.y, at.z, heading, skisOnSnow(game), moved);
    spray.update(skier, at, heading, skier.brake, normal, frameDt, chase.camera, renderer);
    sunFollow(at);

    // den ekte farten: landingene følger flybanen, så den holder seg når du lander
    const v = speedOf(skier);
    chase.update({ x: at.x, y: at.y, z: at.z, vx: skier.vx, vz: skier.vz, heading, speed: v, cut: moved !== 'none' }, frameDt);
    hud.update({
      speed: v, distance: skier.z - startZ, airTime: skier.airTime, inAir: !skier.grounded,
      popCharge: skier.popCharge, lastPop: skier.lastPop, popAge: skier.popAge,
      landing: tricks.lastLanding, landingAge: tricks.landingAge, fade: fadeAmount(game.fall),
      score: game.score, best: game.best, controls: input.device(), grab: tricks.grabs.held, grabTime: tricks.grabs.holdTime,
    }, frameDt);
    hud.setOpacity(menu.update(game.flow, frameDt));
    moved = 'none';
    env.follow(chase.camera.position, performance.now() / 1000);
    audio.frame();
    renderer.render(scene, chase.camera);
  },
});
loop.start();

// pause: fysikken står og lyden tones ned. Taster trykket eller holdt på pause (R, mellomrom) gir ingenting når du fortsetter
const pausable = {
  pause() { loop.pause(); audio.suspend(); },
  resume() { input.releaseAll(); resumeGame(game); loop.resume(); audio.resume(); },
  toggle() { if (loop.isPaused()) pausable.resume(); else pausable.pause(); return loop.isPaused(); },
  isPaused: () => loop.isPaused(),
};
input.onPause(createPauseUi(root, pausable).toggle);
