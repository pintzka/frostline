import type { SkierInput } from '../physics/skier';

/**
 * Tastatur + berøring. Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 * Piltaster/A-D styrer, S/pil ned bremser. På mobil: venstre/høyre halvdel av skjermen.
 */
export function createInput(target: HTMLElement) {
  const keys = new Set<string>();
  let touchSteer = 0;
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const onTouch = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 0) { touchSteer = 0; return; }
    const t = e.touches[0];
    touchSteer = t.clientX < innerWidth / 2 ? -1 : 1;
  };
  target.addEventListener('touchstart', onTouch, { passive: false });
  target.addEventListener('touchmove', onTouch, { passive: false });
  target.addEventListener('touchend', onTouch, { passive: false });

  const state: SkierInput = { steer: 0, brake: 0 };
  return {
    read(): SkierInput {
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      state.steer = (right ? 1 : 0) - (left ? 1 : 0) || touchSteer;
      state.brake = keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0;
      return state;
    },
    pressed(code: string) { return keys.has(code); },
  };
}
