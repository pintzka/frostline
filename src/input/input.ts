import type { RawControls } from '../tricks/controls';
import { GRABS } from '../tricks/grabs';

/**
 * Tastatur + berøring. Arbeidsstrøm 2 (Kamera og input) eier denne fila.
 * Piltaster/A-D styrer, S/pil ned bremser, mellomrom lader pop (slipp for å sprette). På mobil: venstre/høyre halvdel av skjermen.
 * I lufta: A-D/piltaster spinner, W/pil opp er frontflip, S/pil ned er backflip, J/K/L grabs (se tricks/controls.ts og tricks/grabs.ts).
 */
export function createInput(target: HTMLElement) {
  const keys = new Set<string>();
  let touchSteer = 0;
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    // mellomrom og piltaster skal styre spillet, ikke rulle siden
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
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

  const state: RawControls = { steer: 0, brake: 0, flip: 0, pop: false, grab: 0 };
  return {
    read(): RawControls {
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      state.steer = (right ? 1 : 0) - (left ? 1 : 0) || touchSteer;
      const down = keys.has('ArrowDown') || keys.has('KeyS');
      const forward = keys.has('ArrowUp') || keys.has('KeyW');
      state.brake = down ? 1 : 0;
      state.flip = (forward ? 1 : 0) - (down ? 1 : 0);
      state.pop = keys.has('Space');
      // holder du flere grab-taster, vinner den første i lista (J, så K, så L)
      const g = GRABS.findIndex((x) => keys.has(x.key));
      state.grab = (g + 1) as RawControls['grab'];
      return state;
    },
    pressed(code: string) { return keys.has(code); },
  };
}
