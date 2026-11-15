import type { RawControls } from '../tricks/controls';
import { GRABS } from '../tricks/grabs';
import { createEdge, createKeyLatch, createSteerTouches, mergeSteer, padInUse, readPad, readPadTricks, type PadInput, type PadTricks } from './logic';

/**
 * Tastatur, gamepad og berøring. Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 * Tastatur: piltaster/A-D styrer, S/pil ned bremser, mellomrom lader pop (slipp for å sprette), R restart.
 *   I lufta: A-D/piltaster spinner, W/pil opp er frontflip, S/pil ned er backflip, J/K/L grabs (se tricks/controls.ts).
 * Gamepad: venstre stikke styrer, LT/B bremser, A pop, Y/Back restart, Start = pause.
 *   I lufta: stikka sidelengs spinner, opp/ned (eller piltastene opp/ned) flipper, X/RB/LB grabs.
 * Mobil: dra tommelen sidelengs på venstre halvdel, POP og BREMS nede til høyre. I lufta spinner tommelen.
 */

/** Knappene og styre-ringen på skjermen (lages i src/ui/touchControls.ts). */
export interface TouchSurface {
  pop: HTMLElement;
  brake: HTMLElement;
  show(): void;
  update(stick: { anchorX: number; y: number; x: number; radius: number } | null, popDown: boolean, brakeDown: boolean): void;
}

export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

const NO_PAD: PadInput = { steer: 0, brake: 0, pop: false, restart: false, pause: false };
const NO_PAD_TRICKS: PadTricks = { flip: 0, grab: 0 };

export function createInput(target: HTMLElement, touch?: TouchSurface) {
  // tastene huskes til spillet har lest dem minst én gang, så raske tapp ikke forsvinner
  const keys = createKeyLatch();
  let device: InputDevice = 'keyboard';
  // restart skjer én gang per trykk; settes her og hentes av spillet med takeRestart()
  let restartPending = false;
  addEventListener('keydown', (e) => {
    keys.down(e.code);
    // tasten gjentar seg selv når den holdes; bare det første trykket teller
    if (e.code === 'KeyR' && !e.repeat) restartPending = true;
    device = 'keyboard';
    // mellomrom og piltaster skal styre spillet, ikke rulle siden
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.up(e.code));

  // --- berøring: én tommel styrer (en annen på venstre side tar over), knappene kan holdes samtidig ---
  const steer = createSteerTouches();
  // fingrene på knappene huskes på samme måte som tastene, så et raskt tapp på POP teller
  const popFingers = createKeyLatch();
  const brakeFingers = createKeyLatch();

  const usedTouch = () => { device = 'touch'; touch?.show(); };
  target.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    usedTouch();
    if (steer.down(e.pointerId, e.clientX, e.clientY, innerWidth)) target.setPointerCapture?.(e.pointerId);
  });
  target.addEventListener('pointermove', (e) => steer.move(e.pointerId, e.clientX, e.clientY));
  const endSteer = (e: PointerEvent) => steer.up(e.pointerId);
  target.addEventListener('pointerup', endSteer);
  target.addEventListener('pointercancel', endSteer);
  target.addEventListener('lostpointercapture', endSteer);

  /** En knapp er nede så lenge minst én finger holder på den. */
  function holdButton(el: HTMLElement, fingers: ReturnType<typeof createKeyLatch>) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      usedTouch();
      fingers.down(String(e.pointerId));
      el.setPointerCapture?.(e.pointerId);
    });
    const up = (e: PointerEvent) => { fingers.up(String(e.pointerId)); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  if (touch) {
    holdButton(touch.pop, popFingers);
    holdButton(touch.brake, brakeFingers);
    // på mobil vises knappene og mobil-hjelpeteksten med en gang
    if (matchMedia('(pointer: coarse)').matches) { device = 'touch'; touch.show(); }
  }

  // bytter du app eller fane, slippes alt, så ingenting henger fast
  const releaseAll = () => { keys.clear(); popFingers.clear(); brakeFingers.clear(); steer.clear(); };
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  // --- gamepad: leses hvert skjermbilde i egen løkke, så Start virker selv om spillet står på pause ---
  let pad: PadInput = NO_PAD;
  let padTricks: PadTricks = NO_PAD_TRICKS;
  const pauseEdge = createEdge();
  const restartEdge = createEdge();
  const pauseListeners: (() => void)[] = [];
  function pollPads() {
    let next: PadInput = NO_PAD;
    let nextTricks: PadTricks = NO_PAD_TRICKS;
    for (const gp of navigator.getGamepads?.() ?? []) {
      if (!gp || !gp.connected) continue;
      const p = readPad(gp.axes, gp.buttons, gp.mapping === 'standard');
      const t = readPadTricks(gp.axes, gp.buttons, gp.mapping === 'standard');
      nextTricks = { flip: nextTricks.flip || t.flip, grab: nextTricks.grab || t.grab };
      next = {
        steer: Math.abs(p.steer) > Math.abs(next.steer) ? p.steer : next.steer,
        brake: Math.max(next.brake, p.brake),
        pop: next.pop || p.pop,
        restart: next.restart || p.restart,
        pause: next.pause || p.pause,
      };
    }
    if (padInUse(next)) device = 'gamepad';
    // pause sendes én gang per trykk, ikke hele tiden mens knappen holdes
    if (pauseEdge(next.pause)) for (const fn of pauseListeners) fn();
    if (restartEdge(next.restart)) restartPending = true;
    pad = next;
    padTricks = nextTricks;

    touch?.update(steer.view(), popFingers.count() > 0, brakeFingers.count() > 0);
    requestAnimationFrame(pollPads);
  }
  requestAnimationFrame(pollPads);

  let steerSource = -1;
  const state: RawControls = { steer: 0, brake: 0, flip: 0, pop: false, grab: 0 };
  return {
    /** Tastene akkurat nå. På bakken styrer og bremser de, i lufta spinner, flipper og grabber de (tricks/controls.ts). */
    read(): RawControls {
      const has = (c: string) => keys.isDown(c);
      const left = has('ArrowLeft') || has('KeyA');
      const right = has('ArrowRight') || has('KeyD');
      const keySteer = (right ? 1 : 0) - (left ? 1 : 0);
      const merged = mergeSteer([keySteer, pad.steer, steer.value()], steerSource);
      steerSource = merged.source;
      state.steer = merged.value;
      const down = has('ArrowDown') || has('KeyS');
      const forward = has('ArrowUp') || has('KeyW');
      state.brake = Math.max(down ? 1 : 0, pad.brake, brakeFingers.count() > 0 ? 1 : 0);
      state.flip = (forward ? 1 : 0) - (down ? 1 : 0) || padTricks.flip;
      state.pop = has('Space') || pad.pop || popFingers.count() > 0;
      // holder du flere grab-taster, vinner den første i lista (J, så K, så L)
      const g = GRABS.findIndex((x) => has(x.key));
      state.grab = g >= 0 ? ((g + 1) as RawControls['grab']) : padTricks.grab;
      // raske tapp er nå lest; neste avlesning ser bare det som fortsatt holdes
      keys.endRead();
      popFingers.endRead();
      brakeFingers.endRead();
      return state;
    },
    /** Slipper alle taster og fingre (f.eks. når spillet fortsetter etter pause), så ingenting henger igjen. */
    releaseAll() { releaseAll(); restartPending = false; },
    /** Ble R (eller Y/Back på gamepad) trykket siden sist? Gir true én gang per trykk. */
    takeRestart(): boolean {
      const r = restartPending;
      restartPending = false;
      return r;
    },
    /** Kalles én gang hver gang Start trykkes på en gamepad. Selve pausen bygges et annet sted. */
    onPause(fn: () => void) { pauseListeners.push(fn); },
    /** Hva ble sist brukt, så hjelpeteksten kan vise riktige knapper. */
    device(): InputDevice { return device; },
  };
}
