import type { SkierInput } from '../physics/skier';
import { CONFIG } from '../core/config';
import { isSteerZone, mergeSteer, readPad, touchSteer, type PadInput } from './logic';

/**
 * Tastatur, gamepad og berøring. Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 * Tastatur: piltaster/A-D styrer, S/pil ned bremser, mellomrom lader pop (slipp for å sprette), R restart.
 * Gamepad: venstre stikke styrer, LT/B bremser, A pop, Y/Back restart, Start = pause.
 * Mobil: dra tommelen sidelengs på venstre halvdel, POP og BREMS nede til høyre.
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

export function createInput(target: HTMLElement, touch?: TouchSurface) {
  const keys = new Set<string>();
  let device: InputDevice = 'keyboard';
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    device = 'keyboard';
    // mellomrom skal lade pop, ikke rulle siden
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  // --- berøring: én tommel styrer, knappene kan holdes med andre fingre samtidig ---
  let steerId = -1, anchorX = 0, steerY = 0, steerX = 0, touchValue = 0;
  const popFingers = new Set<number>();
  const brakeFingers = new Set<number>();

  const usedTouch = () => { device = 'touch'; touch?.show(); };
  const endSteer = (e: PointerEvent) => {
    if (e.pointerId !== steerId) return;
    steerId = -1;
    touchValue = 0;
  };
  target.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    usedTouch();
    if (steerId >= 0 || !isSteerZone(e.clientX, innerWidth)) return;
    steerId = e.pointerId;
    anchorX = steerX = e.clientX;
    steerY = e.clientY;
    touchValue = 0;
    target.setPointerCapture?.(e.pointerId);
  });
  target.addEventListener('pointermove', (e) => {
    if (e.pointerId !== steerId) return;
    steerX = e.clientX;
    const r = touchSteer(anchorX, steerX);
    anchorX = r.anchor;
    touchValue = r.steer;
  });
  target.addEventListener('pointerup', endSteer);
  target.addEventListener('pointercancel', endSteer);
  target.addEventListener('lostpointercapture', endSteer);

  /** En knapp er nede så lenge minst én finger holder på den. */
  function holdButton(el: HTMLElement, fingers: Set<number>) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      usedTouch();
      fingers.add(e.pointerId);
      el.setPointerCapture?.(e.pointerId);
    });
    const up = (e: PointerEvent) => { fingers.delete(e.pointerId); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  if (touch) {
    holdButton(touch.pop, popFingers);
    holdButton(touch.brake, brakeFingers);
    // på mobil vises knappene med en gang
    if (matchMedia('(pointer: coarse)').matches) touch.show();
  }

  // bytter du app eller fane, slippes alt, så ingenting henger fast
  const releaseAll = () => { keys.clear(); popFingers.clear(); brakeFingers.clear(); steerId = -1; touchValue = 0; };
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  // --- gamepad: leses hvert skjermbilde i egen løkke, så Start virker selv om spillet står på pause ---
  let pad: PadInput = NO_PAD;
  let pauseWasDown = false;
  const pauseListeners: (() => void)[] = [];
  function pollPads() {
    let next: PadInput = NO_PAD;
    for (const gp of navigator.getGamepads?.() ?? []) {
      if (!gp || !gp.connected) continue;
      const p = readPad(gp.axes, gp.buttons);
      next = {
        steer: Math.abs(p.steer) > Math.abs(next.steer) ? p.steer : next.steer,
        brake: Math.max(next.brake, p.brake),
        pop: next.pop || p.pop,
        restart: next.restart || p.restart,
        pause: next.pause || p.pause,
      };
    }
    if (next.steer !== 0 || next.brake > 0 || next.pop || next.restart || next.pause) device = 'gamepad';
    // pause sendes én gang per trykk, ikke hele tiden mens knappen holdes
    if (next.pause && !pauseWasDown) for (const fn of pauseListeners) fn();
    pauseWasDown = next.pause;
    pad = next;

    const stick = steerId >= 0 ? { anchorX, y: steerY, x: steerX, radius: CONFIG.touchSteerRadius } : null;
    touch?.update(stick, popFingers.size > 0, brakeFingers.size > 0);
    requestAnimationFrame(pollPads);
  }
  requestAnimationFrame(pollPads);

  let steerSource = -1;
  const state: SkierInput = { steer: 0, brake: 0, pop: false };
  return {
    read(): SkierInput {
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      const keySteer = (right ? 1 : 0) - (left ? 1 : 0);
      const merged = mergeSteer([keySteer, pad.steer, touchValue], steerSource);
      steerSource = merged.source;
      state.steer = merged.value;
      const keyBrake = keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0;
      state.brake = Math.max(keyBrake, pad.brake, brakeFingers.size > 0 ? 1 : 0);
      state.pop = keys.has('Space') || pad.pop || popFingers.size > 0;
      return state;
    },
    /** R på tastaturet, eller Y/Back på gamepad. */
    restart(): boolean { return keys.has('KeyR') || pad.restart; },
    /** Kalles én gang hver gang Start trykkes på en gamepad. Selve pausen bygges et annet sted. */
    onPause(fn: () => void) { pauseListeners.push(fn); },
    /** Hva ble sist brukt, så hjelpeteksten kan vise riktige knapper. */
    device(): InputDevice { return device; },
    pressed(code: string) { return keys.has(code); },
  };
}
