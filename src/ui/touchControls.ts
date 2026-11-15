/**
 * Knapper og styre-ring for berøringsskjerm. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 * Selve lesingen av fingrene ligger i src/input/input.ts. Her er bare det du ser.
 */

/** Hvor tommelen styrer fra, og hvor den er nå (CSS-piksler). */
export interface TouchStickView { anchorX: number; y: number; x: number; radius: number }

const BTN = 'position:fixed;display:flex;align-items:center;justify-content:center;border-radius:50%;'
  + 'color:#fff;font:800 15px system-ui,sans-serif;letter-spacing:1px;background:#ffffff26;border:2px solid #fff9;'
  + 'text-shadow:0 1px 3px #0008;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;'
  + '-webkit-tap-highlight-color:transparent;transition:background .06s,transform .06s;';

export function createTouchControls(root: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:none;';
  root.appendChild(wrap);

  // POP er størst og nærmest tommelen; BREMS sitter til venstre for den
  const pop = document.createElement('div');
  pop.textContent = 'POP';
  pop.style.cssText = BTN + 'width:96px;height:96px;right:calc(20px + env(safe-area-inset-right));bottom:calc(28px + env(safe-area-inset-bottom));';
  const brake = document.createElement('div');
  brake.textContent = 'BREMS';
  brake.style.cssText = BTN + 'width:72px;height:72px;font-size:12px;right:calc(130px + env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));';
  wrap.append(pop, brake);

  // ring der tommelen ble satt ned, og en prikk som viser hvor mye du svinger
  const ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;border-radius:999px;border:2px solid #fff6;pointer-events:none;display:none;';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:#fff8;pointer-events:none;display:none;';
  wrap.append(ring, knob);

  for (const el of [pop, brake]) el.addEventListener('contextmenu', (e) => e.preventDefault());
  // iPhone zoomer med to fingre selv om siden sier nei; dette stopper det
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  const setDown = (el: HTMLElement, down: boolean) => {
    el.style.background = down ? '#ffffff66' : '#ffffff26';
    el.style.transform = down ? 'scale(0.94)' : '';
  };

  return {
    pop,
    brake,
    /** Vis knappene (første gang noen tar på skjermen, eller med en gang på mobil). */
    show() { wrap.style.display = ''; },
    update(stick: TouchStickView | null, popDown: boolean, brakeDown: boolean) {
      setDown(pop, popDown);
      setDown(brake, brakeDown);
      if (!stick) { ring.style.display = knob.style.display = 'none'; return; }
      ring.style.display = knob.style.display = '';
      const r = stick.radius + 22;
      ring.style.left = `${stick.anchorX - r}px`;
      ring.style.top = `${stick.y - 24}px`;
      ring.style.width = `${2 * r}px`;
      ring.style.height = '48px';
      knob.style.left = `${stick.x}px`;
      knob.style.top = `${stick.y}px`;
    },
  };
}

export type TouchControls = ReturnType<typeof createTouchControls>;
